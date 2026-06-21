import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useT } from "../i18n";
import type { CanvasState } from "../types";

export type NavTarget = "create" | "open" | "verify" | "settings";

interface TitleBarProps {
  canvasState: CanvasState;
  activeSettings: boolean;
  onNavigate: (target: NavTarget) => void;
}

const NAV = [
  { mode: "create" as const, key: "nav.newArchive" },
  { mode: "open"   as const, key: "nav.openArchive" },
  { mode: "verify" as const, key: "nav.verify" },
];

function modeGroup(mode: CanvasState["mode"]): "create" | "open" | "verify" {
  if (mode === "created")  return "create";
  if (mode === "unlocked") return "open";
  if (mode === "verified") return "verify";
  if (mode === "idle")     return "create";
  return mode as "create" | "open" | "verify";
}

export default function TitleBar({ canvasState, activeSettings, onNavigate }: TitleBarProps) {
  const t = useT();
  const [maximized, setMaximized] = useState(false);
  const win = getCurrentWindow();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    win.isMaximized().then(setMaximized);
    win.onResized(() => win.isMaximized().then(setMaximized)).then(f => { unlisten = f; });
    return () => unlisten?.();
  }, []);

  const handleDragRegionMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select")) return;
    win.startDragging();
  };

  const active = activeSettings ? "settings" : modeGroup(canvasState.mode);

  return (
    <div className="title-bar" onMouseDown={handleDragRegionMouseDown}>
      {/* hand-drawn logo (black ink on white → multiply onto parchment) */}
      <div className="flex items-center pl-4 pr-5 h-full cursor-move">
        <img
          src="/andrii-logo.png"
          alt="ANDRII"
          draggable={false}
          className="h-9 w-auto mix-blend-multiply pointer-events-none select-none"
        />
      </div>

      {/* text nav */}
      <nav className="flex items-center gap-1 h-full">
        {NAV.map(({ mode, key }) => (
          <button
            key={mode}
            onClick={() => onNavigate(mode)}
            className={`relative h-full px-3.5 text-[13px] font-medium transition-colors duration-150
              ${active === mode ? "text-accent-text" : "text-ink-faint hover:text-ink"}`}
          >
            {t(key)}
            {active === mode && <span className="absolute left-3 right-3 bottom-2 h-[2.5px] rounded-full bg-accent" />}
          </button>
        ))}
      </nav>

      <div className="flex-1 cursor-move h-full" />

      {/* settings */}
      <button
        onClick={() => onNavigate("settings")}
        className={`px-3 text-[12px] transition-colors h-full ${active === "settings" ? "text-accent-text" : "text-ink-faint hover:text-ink"}`}
      >
        {t("nav.settings")}
      </button>

      {/* window controls */}
      <div className="flex items-center h-full border-l border-border ml-2">
        <WinBtn onClick={() => win.minimize()} label="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1"><line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.4" /></svg>
        </WinBtn>
        <WinBtn onClick={() => win.toggleMaximize()} label={maximized ? "Restore" : "Maximize"}>
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="2" y="0" width="8" height="8" stroke="currentColor" strokeWidth="1.4" />
              <rect x="0" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.4" fill="rgb(var(--c-bg))" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="0.7" y="0.7" width="8.6" height="8.6" stroke="currentColor" strokeWidth="1.4" /></svg>
          )}
        </WinBtn>
        <WinBtn onClick={() => win.close()} label="Close" isClose>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.4" />
            <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </WinBtn>
      </div>
    </div>
  );
}

function WinBtn({
  children, onClick, label, isClose = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  isClose?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-11 h-full flex items-center justify-center text-ink-soft transition-colors duration-100
        ${isClose ? "hover:bg-wax hover:text-white" : "hover:bg-hover hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
