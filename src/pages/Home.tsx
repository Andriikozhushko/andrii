import { useCallback, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Archive, FolderOpen, ShieldCheck, ArrowRight } from "lucide-react";
import type { Screen } from "../types";

interface HomeProps {
  onNavigate: (s: Screen) => void;
  onNavigateWithFiles?: (files: string[]) => void;
}

export default function Home({ onNavigate, onNavigateWithFiles }: HomeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Tauri drag-drop: listen for files dropped on the home screen
  const setupDropListener = useCallback(() => {
    const unlisten = listen<{ paths: string[] }>("tauri://drag-drop", (e) => {
      const paths = e.payload?.paths ?? [];
      if (paths.length > 0 && onNavigateWithFiles) {
        onNavigateWithFiles(paths);
      }
    });
    return unlisten;
  }, [onNavigateWithFiles]);

  // Track drag state for visual feedback
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const paths: string[] = [];
    for (const item of Array.from(e.dataTransfer.files)) {
      if ((item as unknown as { path?: string }).path) {
        paths.push((item as unknown as { path: string }).path);
      }
    }
    if (paths.length > 0 && onNavigateWithFiles) {
      onNavigateWithFiles(paths);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void setupDropListener;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-full px-8 py-10"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag-to-create overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/90 backdrop-blur-sm border-2 border-dashed border-accent/60 animate-fade-in pointer-events-none">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-4">
              <Archive size={36} className="text-accent" />
            </div>
            <p className="text-lg font-semibold text-text-primary mb-1">Drop to create archive</p>
            <p className="text-sm text-text-muted">Files will be encrypted immediately</p>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="text-center mb-10 animate-slide-up">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-glow">
            <ShieldCheck size={32} className="text-accent" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight mb-2">
          ANDRII
        </h1>
        <p className="text-text-muted text-sm max-w-xs mx-auto leading-relaxed">
          Secure your files with encryption that can't be broken.
        </p>
      </div>

      {/* Primary CTA — Create Archive */}
      <div className="w-full max-w-sm mb-4 animate-slide-up" style={{ animationDelay: "0.05s" }}>
        <button
          onClick={() => onNavigate("create")}
          className="w-full group flex items-center gap-4 px-6 py-5 rounded-2xl border bg-accent/10 border-accent/30 hover:bg-accent/18 hover:border-accent/50 hover:shadow-glow transition-all duration-200 text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 group-hover:bg-accent/28 transition-colors">
            <Archive size={22} className="text-accent" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-accent mb-0.5">Create Archive</p>
            <p className="text-2xs text-text-muted">Encrypt and compress your files</p>
          </div>
          <ArrowRight size={16} className="text-accent/50 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>

      {/* Secondary actions — Open and Verify */}
      <div
        className="w-full max-w-sm grid grid-cols-2 gap-3 animate-slide-up"
        style={{ animationDelay: "0.08s" }}
      >
        <button
          onClick={() => onNavigate("open")}
          className="group flex flex-col items-start gap-2 px-4 py-4 rounded-xl border bg-bg-surface border-border hover:bg-bg-elevated hover:border-border-strong transition-all duration-200 text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-bg-elevated border border-border flex items-center justify-center group-hover:border-border-strong transition-colors">
            <FolderOpen size={16} className="text-text-secondary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-primary">Open Archive</p>
            <p className="text-2xs text-text-muted mt-0.5">Decrypt and extract</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate("verify")}
          className="group flex flex-col items-start gap-2 px-4 py-4 rounded-xl border bg-bg-surface border-border hover:bg-bg-elevated hover:border-border-strong transition-all duration-200 text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-bg-elevated border border-border flex items-center justify-center group-hover:border-border-strong transition-colors">
            <ShieldCheck size={16} className="text-text-secondary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-primary">Verify Archive</p>
            <p className="text-2xs text-text-muted mt-0.5">Check integrity</p>
          </div>
        </button>
      </div>

      {/* Drop hint */}
      <p
        className="mt-6 text-2xs text-text-muted animate-slide-up"
        style={{ animationDelay: "0.12s" }}
      >
        Or drag files here to create an archive instantly
      </p>
    </div>
  );
}
