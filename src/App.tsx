import { useEffect, useRef, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Shield, FolderOpen, ShieldCheck, Lock } from "lucide-react";

import TitleBar from "./components/TitleBar";
import SecurityReport from "./components/SecurityReport";
import CreateArchive from "./pages/CreateArchive";
import OpenArchive, { UnlockedArchive } from "./pages/OpenArchive";
import VerifyArchive from "./pages/VerifyArchive";

import type {
  CanvasState, CreateArchiveResponse, PasswordStrengthResult,
  CompressionLevel, OpenArchiveResponse,
} from "./types";

function isAndrii(path: string) { return path.toLowerCase().endsWith(".andrii"); }

/* ── Idle Canvas — create flow ──────────────────────────────────────────── */
function IdleCanvas({
  isDragging, onBrowseFiles, onBrowseFolder, onBrowseArchive,
}: {
  isDragging: boolean;
  onBrowseFiles: () => void;
  onBrowseFolder: () => void;
  onBrowseArchive: () => void;
}) {
  return (
    <div className="canvas">
      <div className="flex-1 p-6">
        <div className={`drop-zone h-full ${isDragging ? "drop-zone-active" : ""}`}>
          <div className="flex flex-col items-center text-center max-w-sm mx-auto gap-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-200
              ${isDragging ? "bg-accent text-white" : "bg-accent/10 text-accent"}`}>
              <Shield size={32} strokeWidth={1.5} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-text-primary tracking-tight">
                {isDragging ? "Drop to protect" : "Drop files or folders here"}
              </h2>
              {!isDragging && (
                <p className="text-sm text-text-muted leading-relaxed">
                  Files become encrypted <span className="font-mono">.andrii</span> archives.<br />
                  Only you can open them.
                </p>
              )}
            </div>

            {!isDragging && (
              <>
                <div className="flex items-center gap-3">
                  <button onClick={onBrowseFiles} className="btn-secondary text-sm px-5 py-2.5">
                    Add Files
                  </button>
                  <button onClick={onBrowseFolder} className="btn-secondary text-sm px-5 py-2.5">
                    Add Folder
                  </button>
                </div>

                <button
                  onClick={onBrowseArchive}
                  className="text-[12px] text-text-muted hover:text-text-secondary underline underline-offset-2 transition-colors"
                >
                  or open an existing .andrii archive
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Open idle canvas ───────────────────────────────────────────────────── */
function OpenIdleCanvas({
  isDragging, onBrowseArchive,
}: {
  isDragging: boolean;
  onBrowseArchive: () => void;
}) {
  return (
    <div className="canvas">
      <div className="flex-1 p-6">
        <div className={`drop-zone h-full ${isDragging ? "drop-zone-active" : ""}`}>
          <div className="flex flex-col items-center text-center max-w-sm mx-auto gap-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-200
              ${isDragging ? "bg-accent text-white" : "bg-elevated text-text-secondary"}`}>
              <FolderOpen size={32} strokeWidth={1.5} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-text-primary tracking-tight">
                {isDragging ? "Drop to open" : "Open an archive"}
              </h2>
              {!isDragging && (
                <p className="text-sm text-text-muted">
                  Drop a <span className="font-mono">.andrii</span> archive or browse.
                </p>
              )}
            </div>

            {!isDragging && (
              <button onClick={onBrowseArchive} className="btn-secondary text-sm px-5 py-2.5">
                Browse archive
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Verify idle canvas ─────────────────────────────────────────────────── */
function VerifyIdleCanvas({
  isDragging, onBrowseArchive,
}: {
  isDragging: boolean;
  onBrowseArchive: () => void;
}) {
  return (
    <div className="canvas">
      <div className="flex-1 p-6">
        <div className={`drop-zone h-full ${isDragging ? "drop-zone-active" : ""}`}>
          <div className="flex flex-col items-center text-center max-w-sm mx-auto gap-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-200
              ${isDragging ? "bg-accent text-white" : "bg-elevated text-text-secondary"}`}>
              <ShieldCheck size={32} strokeWidth={1.5} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-text-primary tracking-tight">
                {isDragging ? "Drop to verify" : "Verify an archive"}
              </h2>
              {!isDragging && (
                <p className="text-sm text-text-muted leading-relaxed">
                  No password needed.<br />
                  Checks that the archive has not been tampered with.
                </p>
              )}
            </div>

            {!isDragging && (
              <button onClick={onBrowseArchive} className="btn-secondary text-sm px-5 py-2.5">
                Browse archive
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Drop overlay ───────────────────────────────────────────────────────── */
function DropOverlay() {
  return (
    <div className="fixed inset-0 z-50 bg-accent/8 pointer-events-none animate-fade-in">
      <div className="absolute inset-4 border-2 border-dashed border-accent/50 rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <Lock size={36} className="text-accent/70 mx-auto mb-3" />
          <p className="text-base font-semibold text-accent">Drop to protect</p>
        </div>
      </div>
    </div>
  );
}

/* ── App ────────────────────────────────────────────────────────────────── */
export default function App() {
  const [canvas, setCanvas]         = useState<CanvasState>({ mode: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef                   = useRef<CanvasState>({ mode: "idle" });

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

  // File drag-and-drop via Rust on_window_event → custom events
  // (bypasses WebView2 JS-level DnD which doesn't forward OS file drops)
  useEffect(() => {
    const unlistens: Array<() => void> = [];

    const handlePaths = (paths: string[]) => {
      if (!paths.length) return;
      const cur = canvasRef.current;

      if (paths.length === 1 && isAndrii(paths[0])) {
        if (cur.mode === "verify" || cur.mode === "verified") {
          setState({ mode: "verify", archivePath: paths[0] });
        } else {
          setState({ mode: "open", archivePath: paths[0] });
        }
        return;
      }

      if (cur.mode === "create") {
        const existing = new Set(cur.files);
        const fresh    = paths.filter(p => !existing.has(p));
        if (fresh.length) setState({ mode: "create", files: [...cur.files, ...fresh] });
      } else {
        setState({ mode: "create", files: paths });
      }
    };

    listen<string[]>("dnd-drop",  e => { setIsDragging(false); handlePaths(e.payload); }).then(f => unlistens.push(f));
    listen<string[]>("dnd-enter", e => { void e; setIsDragging(true); }).then(f => unlistens.push(f));
    listen<null>    ("dnd-leave", () => { setIsDragging(false); }).then(f => unlistens.push(f));

    return () => unlistens.forEach(f => f());
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

  const browseFolder = async () => {
    const picked = await open({ multiple: false, directory: true });
    if (!picked) return;
    const p = Array.isArray(picked) ? picked[0] : picked;
    if (p) setState({ mode: "create", files: [p] });
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

  const browseVerifyArchive = async () => {
    const picked = await open({
      multiple: false,
      filters: [{ name: "ANDRII Archive", extensions: ["andrii"] }],
    });
    if (!picked) return;
    const p = Array.isArray(picked) ? picked[0] : picked;
    if (p) setState({ mode: "verify", archivePath: p });
  };

  const canvasKey = canvas.mode === "open" && !canvas.archivePath ? "open-idle"
    : canvas.mode === "verify" && !canvas.archivePath ? "verify-idle"
    : canvas.mode;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      <TitleBar canvasState={canvas} onNavigate={handleNavigate} />

      {isDragging && <DropOverlay />}

      <div key={canvasKey} className="flex-1 overflow-hidden animate-fade-in">
        {canvas.mode === "idle" && (
          <IdleCanvas
            isDragging={isDragging}
            onBrowseFiles={browseFiles}
            onBrowseFolder={browseFolder}
            onBrowseArchive={browseArchive}
          />
        )}

        {canvas.mode === "create" && (
          <CreateArchive
            files={canvas.files}
            isDragging={isDragging}
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
          <OpenIdleCanvas isDragging={isDragging} onBrowseArchive={browseArchive} />
        )}

        {canvas.mode === "unlocked" && (
          <UnlockedArchive
            archivePath={canvas.archivePath}
            password={canvas.password}
            info={canvas.info}
            onClose={() => setState({ mode: "idle" })}
          />
        )}

        {(canvas.mode === "verify" || canvas.mode === "verified") && canvas.archivePath && (
          <VerifyArchive
            archivePath={canvas.archivePath}
            onBack={() => setState({ mode: "idle" })}
          />
        )}

        {canvas.mode === "verify" && !canvas.archivePath && (
          <VerifyIdleCanvas isDragging={isDragging} onBrowseArchive={browseVerifyArchive} />
        )}
      </div>
    </div>
  );
}
