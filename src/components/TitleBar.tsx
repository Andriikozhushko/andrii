import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Archive, FolderOpen, ShieldCheck } from "lucide-react";
import type { CanvasState } from "../types";

interface TitleBarProps {
  canvasState: CanvasState;
  onNavigate: (mode: "create" | "open" | "verify") => void;
}

const NAV = [
  { mode: "create" as const, icon: Archive,     title: "New Archive"  },
  { mode: "open"   as const, icon: FolderOpen,  title: "Open Archive" },
  { mode: "verify" as const, icon: ShieldCheck, title: "Verify"       },
] as const;

function modeGroup(mode: CanvasState["mode"]): "create" | "open" | "verify" {
  if (mode === "created")  return "create";
  if (mode === "unlocked") return "open";
  if (mode === "verified") return "verify";
  if (mode === "idle")     return "create";
  return mode as "create" | "open" | "verify";
}

function stateLabel(mode: CanvasState["mode"]): string {
  switch (mode) {
    case "create":   return "New archive";
    case "created":  return "Protected";
    case "open":     return "Open archive";
    case "unlocked": return "Unlocked";
    case "verify":   return "Verify";
    case "verified": return "Verified";
    default:         return "";
  }
}

export default function TitleBar({ canvasState, onNavigate }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);
  const win = getCurrentWindow();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    win.isMaximized().then(setMaximized);
    win.onResized(() => win.isMaximized().then(setMaximized)).then((f) => { unlisten = f; });
    return () => unlisten?.();
  }, []);

  const activeGroup = modeGroup(canvasState.mode);
  const label = stateLabel(canvasState.mode);

  return (
    <div className="title-bar">
      {/* drag region — left side + center */}
      <div
        className="flex-1 flex items-center gap-3 px-5 h-full"
        data-tauri-drag-region
      >
        <span
          className="text-xs font-semibold tracking-[0.1em] text-text-primary"
          data-tauri-drag-region
        >
          ANDRII
        </span>
        {label && canvasState.mode !== "idle" && (
          <span className="text-2xs text-text-muted tabular-nums" data-tauri-drag-region>
            {label}
          </span>
        )}
      </div>

      {/* navigation icons */}
      <div className="flex items-center gap-0.5 px-3">
        {NAV.map(({ mode, icon: Icon, title }) => (
          <button
            key={mode}
            onClick={() => onNavigate(mode)}
            title={title}
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors duration-100
              ${activeGroup === mode
                ? "text-accent"
                : "text-text-muted hover:text-text-secondary hover:bg-elevated"
              }`}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>

      {/* window controls */}
      <div className="flex items-center border-l border-border/60 h-full">
        <WinBtn onClick={() => win.minimize()} label="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1">
            <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </WinBtn>
        <WinBtn onClick={() => win.toggleMaximize()} label={maximized ? "Restore" : "Maximize"}>
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="2" y="0" width="8" height="8" stroke="currentColor" strokeWidth="1.2" />
              <rect x="0" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.2" fill="rgb(var(--c-bg))" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.6" y="0.6" width="8.8" height="8.8" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </WinBtn>
        <WinBtn onClick={() => win.close()} label="Close" isClose>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
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
      className={`w-11 h-full flex items-center justify-center text-text-muted transition-colors duration-100
        ${isClose ? "hover:bg-danger hover:text-white" : "hover:bg-elevated hover:text-text-secondary"}`}
    >
      {children}
    </button>
  );
}
