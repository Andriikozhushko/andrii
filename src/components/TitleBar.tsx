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

function stateLabel(state: CanvasState): string {
  switch (state.mode) {
    case "created":  return "Protected";
    case "unlocked": return "Unlocked";
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
    win.onResized(() => win.isMaximized().then(setMaximized)).then(f => { unlisten = f; });
    return () => unlisten?.();
  }, []);

  // Explicit startDragging — more reliable than data-tauri-drag-region in Tauri v2
  const handleDragRegionMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't drag if clicking an interactive element
    if (target.closest("button, a, input, select")) return;
    win.startDragging();
  };

  const activeGroup = modeGroup(canvasState.mode);
  const statusLabel = stateLabel(canvasState);

  return (
    <div className="title-bar">
      {/* drag region — wordmark + spacer */}
      <div
        className="flex items-center gap-2 pl-4 pr-3 h-full flex-1 cursor-move"
        onMouseDown={handleDragRegionMouseDown}
      >
        <span className="w-[6px] h-[6px] rounded-sm bg-accent inline-block shrink-0 pointer-events-none" />
        <span className="text-[11px] font-bold tracking-[0.18em] text-text-primary uppercase pointer-events-none">
          ANDRII
        </span>
        {statusLabel && (
          <span className="text-[11px] text-text-muted pointer-events-none">
            · {statusLabel}
          </span>
        )}
      </div>

      {/* navigation */}
      <div className="flex items-center gap-0.5 px-2">
        {NAV.map(({ mode, icon: Icon, title }) => (
          <button
            key={mode}
            onClick={() => onNavigate(mode)}
            title={title}
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors duration-100
              ${activeGroup === mode
                ? "text-accent bg-accent/10"
                : "text-text-muted hover:text-text-secondary hover:bg-elevated"
              }`}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>

      {/* window controls */}
      <div className="flex items-center ml-2 h-full border-l border-border">
        <WinBtn onClick={() => win.minimize()} label="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1">
            <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </WinBtn>
        <WinBtn onClick={() => win.toggleMaximize()} label={maximized ? "Restore" : "Maximize"}>
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="2" y="0" width="8" height="8" stroke="currentColor" strokeWidth="1.2" />
              <rect x="0" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.2"
                fill="rgb(var(--c-surface))" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.6" y="0.6" width="8.8" height="8.8" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </WinBtn>
        <WinBtn onClick={() => win.close()} label="Close" isClose>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" />
            <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" />
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
        ${isClose
          ? "hover:bg-red-500 hover:text-white"
          : "hover:bg-elevated hover:text-text-secondary"
        }`}
    >
      {children}
    </button>
  );
}
