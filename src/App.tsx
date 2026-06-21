import { useEffect, useRef, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import TitleBar, { type NavTarget } from "./components/TitleBar";
import { ArchiveBox, PaperBundle, SealInspector, InkAddFiles, InkFolder, InkLens } from "./components/art";
import SecurityReport from "./components/SecurityReport";
import Onboarding from "./components/Onboarding";
import Settings from "./components/Settings";
import RecentArchives from "./components/RecentArchives";
import CreateArchive from "./pages/CreateArchive";
import OpenArchive, { UnlockedArchive } from "./pages/OpenArchive";
import VerifyArchive from "./pages/VerifyArchive";
import { useT } from "./i18n";
import { isOnboarded, getRecents, removeRecent, type RecentArchive } from "./lib/storage";

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
    <div className="flex-1 p-7 min-h-0">
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
              <p className="text-[15px] text-ink-soft leading-relaxed max-w-sm mx-auto">{subtitle}</p>
            )}
          </div>
          {!isDragging && children && (
            <div className="flex flex-col items-center gap-4 pt-1">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Create mode — home (Create only; Open/Verify are secondary links) ──── */
function IdleCanvas({
  isDragging, onBrowseFiles, onBrowseFolder, onGoOpen, onGoVerify,
}: {
  isDragging: boolean;
  onBrowseFiles: () => void;
  onBrowseFolder: () => void;
  onGoOpen: () => void;
  onGoVerify: () => void;
}) {
  const t = useT();
  return (
    <div className="canvas">
      <Hero
        art={<ArchiveBox variant="open" />}
        isDragging={isDragging}
        title={t("create.dropTitle")}
        dragTitle={t("create.dropDrag")}
        subtitle={<>{t("create.dropSub")}</>}
      >
        <div className="flex items-center gap-3">
          <button onClick={onBrowseFiles} className="btn-primary"><InkAddFiles /> {t("create.addFiles")}</button>
          <button onClick={onBrowseFolder} className="btn-secondary"><InkFolder /> {t("create.addFolder")}</button>
        </div>
        <div className="flex items-center gap-2.5 text-[13px] text-ink-faint">
          <button onClick={onGoOpen} className="hover:text-accent-text transition-colors">{t("nav.openArchive")}</button>
          <span className="text-border-strong">·</span>
          <button onClick={onGoVerify} className="hover:text-accent-text transition-colors">{t("nav.verify")}</button>
        </div>
      </Hero>
    </div>
  );
}

/* ── Open mode — entry (choose + recents) ───────────────────────────────── */
function OpenIdleCanvas({
  isDragging, onBrowseArchive, recents, onOpenRecent, onRemoveRecent,
}: {
  isDragging: boolean;
  onBrowseArchive: () => void;
  recents: RecentArchive[];
  onOpenRecent: (r: RecentArchive) => void;
  onRemoveRecent: (path: string) => void;
}) {
  const t = useT();
  return (
    <div className="canvas">
      <Hero
        art={<PaperBundle />}
        isDragging={isDragging}
        title={t("open.title")}
        dragTitle={t("open.dragTitle")}
        subtitle={<>{t("open.sub")}</>}
      >
        <button onClick={onBrowseArchive} className="btn-primary"><InkLens /> {t("open.choose")}</button>
      </Hero>
      {!isDragging && <RecentArchives items={recents} onOpen={onOpenRecent} onRemove={onRemoveRecent} />}
    </div>
  );
}

function VerifyIdleCanvas({ isDragging, onBrowseArchive }: { isDragging: boolean; onBrowseArchive: () => void }) {
  const t = useT();
  return (
    <div className="canvas">
      <Hero
        art={<SealInspector />}
        isDragging={isDragging}
        title={t("verify.title")}
        dragTitle={t("verify.dragTitle")}
        subtitle={t("verify.sub")}
      >
        <button onClick={onBrowseArchive} className="btn-primary"><InkLens /> {t("verify.choose")}</button>
      </Hero>
    </div>
  );
}

function DropOverlay() {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 pointer-events-none animate-fade-in">
      <div className="absolute inset-0 bg-accent/10" />
      <div className="absolute inset-5 rounded-4xl border-2 border-dashed border-accent bg-accent-soft/40 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-scale-in">
          <ArchiveBox variant="open" size={150} />
          <p className="font-serif text-[24px] font-semibold text-accent-text">{t("create.dropDrag")}</p>
        </div>
      </div>
    </div>
  );
}

/* ── App ────────────────────────────────────────────────────────────────── */
export default function App() {
  const [canvas, setCanvas]         = useState<CanvasState>({ mode: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboarded());
  const [recents, setRecents]       = useState<RecentArchive[]>(() => getRecents());
  const canvasRef                   = useRef<CanvasState>({ mode: "idle" });

  const setState = useCallback((next: CanvasState | ((prev: CanvasState) => CanvasState)) => {
    setCanvas(prev => {
      const resolved = typeof next === "function" ? next(prev) : next;
      canvasRef.current = resolved;
      return resolved;
    });
  }, []);

  // Recents live in Open mode — refresh when entering Create home or Open.
  useEffect(() => {
    if (canvas.mode === "idle" || canvas.mode === "open") setRecents(getRecents());
  }, [canvas.mode]);

  // Startup file-association path
  useEffect(() => {
    invoke<string | null>("get_startup_archive_path").then(path => {
      if (path) setState({ mode: "open", archivePath: path });
    }).catch(() => {});
  }, [setState]);

  // Native drag-drop
  useEffect(() => {
    const unlistens: Array<() => void> = [];
    const handlePaths = (paths: string[]) => {
      if (!paths.length) return;
      const cur = canvasRef.current;
      if (paths.length === 1 && isAndrii(paths[0])) {
        if (cur.mode === "verify" || cur.mode === "verified") setState({ mode: "verify", archivePath: paths[0] });
        else setState({ mode: "open", archivePath: paths[0] });
        return;
      }
      if (cur.mode === "create") {
        const existing = new Set(cur.files);
        const fresh = paths.filter(p => !existing.has(p));
        if (fresh.length) setState({ mode: "create", files: [...cur.files, ...fresh] });
      } else {
        setState({ mode: "create", files: paths });
      }
    };
    listen<{ paths: string[] }>("tauri://drag-drop",  e => { setIsDragging(false); handlePaths(e.payload.paths); }).then(f => unlistens.push(f));
    listen<{ paths: string[] }>("tauri://drag-enter", e => { void e; setIsDragging(true); }).then(f => unlistens.push(f));
    listen                     ("tauri://drag-leave", () => { setIsDragging(false); }).then(f => unlistens.push(f));
    return () => unlistens.forEach(f => f());
  }, [setState]);

  const handleNavigate = useCallback((target: NavTarget) => {
    if (target === "create")   setState({ mode: "idle" });
    if (target === "open")     setState({ mode: "open", archivePath: "" });
    if (target === "verify")   setState({ mode: "verify" });
    if (target === "settings") setState({ mode: "settings" });
  }, [setState]);

  const openRecent = (r: RecentArchive) => setState({ mode: "open", archivePath: r.path });
  const dropRecent = (path: string) => { removeRecent(path); setRecents(getRecents()); };

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
    const picked = await open({ multiple: false, filters: [{ name: "ANDRII Archive", extensions: ["andrii"] }] });
    if (!picked) return;
    const p = Array.isArray(picked) ? picked[0] : picked;
    if (p) setState({ mode: "open", archivePath: p });
  };
  const browseVerifyArchive = async () => {
    const picked = await open({ multiple: false, filters: [{ name: "ANDRII Archive", extensions: ["andrii"] }] });
    if (!picked) return;
    const p = Array.isArray(picked) ? picked[0] : picked;
    if (p) setState({ mode: "verify", archivePath: p });
  };

  const canvasKey = canvas.mode === "open" && !canvas.archivePath ? "open-idle"
    : canvas.mode === "verify" && !canvas.archivePath ? "verify-idle"
    : canvas.mode;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}

      <TitleBar canvasState={canvas} activeSettings={canvas.mode === "settings"} onNavigate={handleNavigate} />

      {isDragging && canvas.mode !== "settings" && <DropOverlay />}

      <div key={canvasKey} className="flex-1 overflow-hidden animate-fade-in">
        {canvas.mode === "idle" && (
          <IdleCanvas
            isDragging={isDragging}
            onBrowseFiles={browseFiles}
            onBrowseFolder={browseFolder}
            onGoOpen={() => handleNavigate("open")}
            onGoVerify={() => handleNavigate("verify")}
          />
        )}

        {canvas.mode === "create" && (
          <CreateArchive
            files={canvas.files}
            isDragging={isDragging}
            onFilesChange={files => setState({ mode: "create", files })}
            onCreated={(result: CreateArchiveResponse, analysis: PasswordStrengthResult | null, compression: CompressionLevel) =>
              setState({ mode: "created", result, passwordAnalysis: analysis, compressionLabel: compression })}
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
              setState({ mode: "unlocked", archivePath: canvas.archivePath as string, password, info })}
            onBack={() => setState({ mode: "idle" })}
          />
        )}

        {canvas.mode === "open" && !canvas.archivePath && (
          <OpenIdleCanvas
            isDragging={isDragging}
            onBrowseArchive={browseArchive}
            recents={recents}
            onOpenRecent={openRecent}
            onRemoveRecent={dropRecent}
          />
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
          <VerifyArchive archivePath={canvas.archivePath} onBack={() => setState({ mode: "idle" })} />
        )}

        {canvas.mode === "verify" && !canvas.archivePath && (
          <VerifyIdleCanvas isDragging={isDragging} onBrowseArchive={browseVerifyArchive} />
        )}

        {canvas.mode === "settings" && (
          <Settings onBack={() => setState({ mode: "idle" })} onReplayOnboarding={() => setShowOnboarding(true)} />
        )}
      </div>
    </div>
  );
}
