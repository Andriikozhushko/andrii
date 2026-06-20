import { useEffect, useRef, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Archive } from "lucide-react";

import TitleBar from "./components/TitleBar";
import SecurityReport from "./components/SecurityReport";
import CreateArchive from "./pages/CreateArchive";
import OpenArchive, { UnlockedArchive } from "./pages/OpenArchive";
import VerifyArchive from "./pages/VerifyArchive";

import type {
  CanvasState, CreateArchiveResponse, PasswordStrengthResult,
  CompressionLevel, OpenArchiveResponse,
} from "./types";

/* ── helpers ────────────────────────────────────────────────────────────── */
function isAndrii(path: string) { return path.toLowerCase().endsWith(".andrii"); }

/* ── Idle canvas ────────────────────────────────────────────────────────── */
function IdleCanvas({ onBrowseFiles, onBrowseArchive }: {
  onBrowseFiles: () => void;
  onBrowseArchive: () => void;
}) {
  return (
    <div className="canvas">
      <div className="canvas-center px-10">
        <div className="w-full max-w-lg">
          {/* drop zone */}
          <div className="border border-dashed border-border rounded animate-drop-pulse py-16 px-8 text-center mb-6">
            <p className="text-base text-text-secondary font-medium mb-1">
              Drop anything here
            </p>
            <p className="text-2xs text-text-muted">
              Files and folders encrypt.&nbsp;&nbsp;Archives unlock.
            </p>
          </div>

          {/* browse links */}
          <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
            <button
              onClick={onBrowseFiles}
              className="hover:text-text-secondary underline underline-offset-2 transition-colors"
            >
              Browse files
            </button>
            <span className="opacity-30">·</span>
            <button
              onClick={onBrowseArchive}
              className="hover:text-text-secondary underline underline-offset-2 transition-colors"
            >
              Open archive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Drop overlay ───────────────────────────────────────────────────────── */
function DropOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none animate-fade-in">
      <div className="border-2 border-dashed border-accent/40 absolute inset-4 rounded-lg" />
      <Archive size={24} className="text-accent/60 mb-3" />
      <p className="text-sm text-text-secondary">Drop to add</p>
    </div>
  );
}

/* ── App ────────────────────────────────────────────────────────────────── */
export default function App() {
  const [canvas, setCanvas]         = useState<CanvasState>({ mode: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter                 = useRef(0);
  const canvasRef                   = useRef<CanvasState>({ mode: "idle" });

  // Keep ref in sync
  const setState = useCallback((next: CanvasState | ((prev: CanvasState) => CanvasState)) => {
    setCanvas(prev => {
      const resolved = typeof next === "function" ? next(prev) : next;
      canvasRef.current = resolved;
      return resolved;
    });
  }, []);

  // Startup file-association path
  useEffect(() => {
    invoke<string | null>("get_startup_archive_path").then(path => {
      if (path) setState({ mode: "open", archivePath: path });
    }).catch(() => {});
  }, [setState]);

  // Global drag-and-drop
  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (dragCounter.current === 1) setIsDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current === 0) setIsDragging(false);
    };
    const onOver = (e: DragEvent) => { e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      const paths: string[] = [];
      for (const file of Array.from(e.dataTransfer?.files ?? [])) {
        const p = (file as unknown as { path?: string }).path;
        if (p) paths.push(p);
      }
      if (!paths.length) return;

      const cur = canvasRef.current;

      // Single .andrii → open flow
      if (paths.length === 1 && isAndrii(paths[0])) {
        // If in verify mode, run verify instead
        if (cur.mode === "verify" || cur.mode === "verified") {
          setState({ mode: "verify", archivePath: paths[0] });
        } else {
          setState({ mode: "open", archivePath: paths[0] });
        }
        return;
      }

      // Non-archive files → create flow
      if (cur.mode === "create") {
        const existing = new Set(cur.files);
        const fresh    = paths.filter(p => !existing.has(p));
        if (fresh.length) setState({ mode: "create", files: [...cur.files, ...fresh] });
      } else {
        setState({ mode: "create", files: paths });
      }
    };

    document.addEventListener("dragenter", onEnter);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("dragover",  onOver);
    document.addEventListener("drop",      onDrop);
    return () => {
      document.removeEventListener("dragenter", onEnter);
      document.removeEventListener("dragleave", onLeave);
      document.removeEventListener("dragover",  onOver);
      document.removeEventListener("drop",      onDrop);
    };
  }, [setState]);

  /* ── nav handler ── */
  const handleNavigate = useCallback((mode: "create" | "open" | "verify") => {
    if (mode === "create") setState({ mode: "idle" });
    if (mode === "open")   setState({ mode: "open", archivePath: "" });
    if (mode === "verify") setState({ mode: "verify" });
  }, [setState]);

  /* ── browse helpers ── */
  const browseFiles = async () => {
    const picked = await open({ multiple: true, directory: false });
    if (!picked) return;
    const paths = (Array.isArray(picked) ? picked : [picked]).filter(Boolean) as string[];
    if (paths.length) setState({ mode: "create", files: paths });
  };

  const browseArchive = async () => {
    const picked = await open({
      multiple: false,
      filters: [{ name: "ANDRII Archive", extensions: ["andrii"] }],
    });
    if (!picked) return;
    const p = Array.isArray(picked) ? picked[0] : picked;
    if (p) setState({ mode: "open", archivePath: p });
  };

  /* ── canvas key for fade transitions ── */
  const canvasKey = canvas.mode;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      <TitleBar canvasState={canvas} onNavigate={handleNavigate} />

      {/* drag overlay */}
      {isDragging && <DropOverlay />}

      {/* canvas — keyed so each mode transition fades in */}
      <div key={canvasKey} className="flex-1 overflow-hidden animate-fade-in">
        {canvas.mode === "idle" && (
          <IdleCanvas onBrowseFiles={browseFiles} onBrowseArchive={browseArchive} />
        )}

        {canvas.mode === "create" && (
          <CreateArchive
            files={canvas.files}
            onFilesChange={files => setState({ mode: "create", files })}
            onCreated={(result: CreateArchiveResponse, analysis: PasswordStrengthResult | null, compression: CompressionLevel) =>
              setState({ mode: "created", result, passwordAnalysis: analysis, compressionLabel: compression })
            }
            onClear={() => setState({ mode: "idle" })}
          />
        )}

        {canvas.mode === "created" && (
          <SecurityReport
            result={canvas.result}
            passwordAnalysis={canvas.passwordAnalysis}
            compressionLabel={canvas.compressionLabel}
            onDone={() => setState({ mode: "idle" })}
            onCreateAnother={() => setState({ mode: "idle" })}
          />
        )}

        {canvas.mode === "open" && canvas.archivePath && (
          <OpenArchive
            archivePath={canvas.archivePath}
            onUnlocked={(password: string, info: OpenArchiveResponse) =>
              setState({ mode: "unlocked", archivePath: canvas.archivePath as string, password, info })
            }
            onBack={() => setState({ mode: "idle" })}
          />
        )}

        {canvas.mode === "open" && !canvas.archivePath && (
          <IdleCanvas onBrowseFiles={browseFiles} onBrowseArchive={browseArchive} />
        )}

        {canvas.mode === "unlocked" && (
          <UnlockedArchive
            archivePath={canvas.archivePath}
            password={canvas.password}
            info={canvas.info}
            onClose={() => setState({ mode: "idle" })}
          />
        )}

        {canvas.mode === "verify" && (
          <VerifyArchive
            archivePath={canvas.archivePath}
            onBack={() => setState({ mode: "idle" })}
          />
        )}

        {canvas.mode === "verified" && (
          <VerifyArchive
            archivePath={canvas.archivePath}
            onBack={() => setState({ mode: "idle" })}
          />
        )}
      </div>
    </div>
  );
}
