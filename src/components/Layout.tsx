import type { ReactNode } from "react";
import type { Screen } from "../types";
import { ShieldCheck, ChevronLeft, Lock } from "lucide-react";

const SCREEN_TITLES: Record<Screen, string> = {
  home: "",
  create: "Create Archive",
  open: "Open Archive",
  verify: "Verify Archive",
};

interface LayoutProps {
  children: ReactNode;
  screen: Screen;
  onNavigate: (s: Screen) => void;
}

export default function Layout({ children, screen, onNavigate }: LayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-bg-base overflow-hidden">
      {/* Titlebar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-bg-surface/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          {screen !== "home" && (
            <button
              onClick={() => onNavigate("home")}
              className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors"
              title="Back to Home"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <ShieldCheck size={15} className="text-accent" />
            </div>
            <span className="text-sm font-semibold tracking-widest text-text-primary uppercase">
              ANDRII
            </span>
          </div>
          {screen !== "home" && SCREEN_TITLES[screen] && (
            <>
              <span className="text-border-strong text-xs">›</span>
              <span className="text-xs text-text-secondary">{SCREEN_TITLES[screen]}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="badge badge-accent">v0.1.0</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="animate-fade-in h-full">{children}</div>
      </main>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-6 py-1.5 border-t border-border/30 bg-bg-surface/50 shrink-0">
        <div className="flex items-center gap-2">
          <Lock size={10} className="text-success" />
          <span className="text-2xs text-text-muted">End-to-end encrypted</span>
        </div>
        <span className="text-2xs text-text-muted">Format v1</span>
      </footer>
    </div>
  );
}
