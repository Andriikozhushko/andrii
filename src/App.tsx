import { useEffect, useRef, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import TitleBar from "./components/TitleBar";
import { ArchiveBox, PaperBundle, SealInspector, InkAddFiles, InkFolder, InkLens } from "./components/art";
import SecurityReport from "./components/SecurityReport";
import CreateArchive from "./pages/CreateArchive";
import OpenArchive, { UnlockedArchive } from "./pages/OpenArchive";
import VerifyArchive from "./pages/VerifyArchive";

import type {
  CanvasState, CreateArchiveResponse, PasswordStrengthResult,
  CompressionLevel, OpenArchiveResponse,
} from "./types";

function isAndrii(path: string) { return path.toLowerCase().endsWith(".andrii"); }

/* ── Shared hero (idle / drop target) ───────────────────────────────────── */
function Hero({
  art, title, dragTitle, subtitle, isDragging, children,
}: {
  art: React.ReactNode;
  title: string;
  dragTitle: string;
  subtitle?: React.ReactNode;
  isDragging: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="canvas">
      <div className="flex-1 p-7">
        <div className={`drop-zone h-full ${isDragging ? "drop-zone-active" : ""}`}>
          <div className="flex flex-col items-center text-center max-w-md mx-auto gap-6 px-6">
            <div className={`transition-transform duration-300 ease-out ${isDragging ? "scale-110 -translate-y-1" : ""}`}>
              {art}
            </div>

            <div className="space-y-2.5">
              <h2 className="font-serif text-[34px] font-semibold tracking-tight text-ink leading-[1.05]">
                {isDragging ? dragTitle : title}
              </h2>
              {!isDragging && subtitle && (
                <p className="text-[15px] text-ink-soft leading-relaxed max-w-sm mx-auto">
                  {subtitle}
                </p>
              )}
            </div>

            {!isDragging && children && (
              <div className="flex flex-col items-center gap-4 pt-1">{children}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <Hero
      art={<ArchiveBox variant="open" />}
      isDragging={isDragging}
      title="Drop files to seal"
      dragTitle="Release to seal"
      subtitle={<>Create a private <span className="font-mono text-ink">.andrii</span> archive only your password can open.</>}
    >
      <div className="flex items-center gap-3">
        <button onClick={onBrowseFiles} className="btn-primary"><InkAddFiles /> Add files</button>
        <button onClick={onBrowseFolder} className="btn-secondary"><InkFolder /> Add folder</button>
      </div>
      <button
        onClick={onBrowseArchive}
        className="text-[13px] text-ink-faint hover:text-accent-text transition-colors"
      >
        or open an existing archive
      </button>
    </Hero>
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
    <Hero
      art={<PaperBundle />}
      isDragging={isDragging}
      title="Open an archive"
      dragTitle="Release to open"
      subtitle={<>Drop a <span className="font-mono text-ink">.andrii</span> archive here, or choose one to unlock.</>}
    >
      <button onClick={onBrowseArchive} className="btn-primary"><InkLens /> Choose archive</button>
    </Hero>
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
    <Hero
      art={<SealInspector />}
      isDragging={isDragging}
      title="Check an archive seal"
      dragTitle="Release to check"
      subtitle="Verify that the archive was not modified after creation."
    >
      <button onClick={onBrowseArchive} className="btn-primary"><InkLens /> Choose archive</button>
    </Hero>
  );
}

/* ── Drop overlay ───────────────────────────────────────────────────────── */
function DropOverlay() {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none animate-fade-in">
      <div className="absolute inset-0 bg-accent/10" />
      <div className="absolute inset-5 rounded-4xl border-2 border-dashed border-accent bg-accent-soft/40 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-scale-in">
          <ArchiveBox variant="open" size={150} />
          <p className="font-serif text-[24px] font-semibold text-accent-text">Drop to seal</p>
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

    // Native Tauri/WRY drag-drop — payloads carry absolute paths cross-platform.
    listen<{ paths: string[] }>("tauri://drag-drop",  e => { setIsDragging(false); handlePaths(e.payload.paths); }).then(f => unlistens.push(f));
    listen<{ paths: string[] }>("tauri://drag-enter", e => { void e; setIsDragging(true); }).then(f => unlistens.push(f));
    listen                     ("tauri://drag-leave", () => { setIsDragging(false); }).then(f => unlistens.push(f));

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
    <div className="flex flex-col h-screen overflow-hidden">
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
