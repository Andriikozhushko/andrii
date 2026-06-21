import { useState } from "react";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { ArchiveBox } from "./art";
import type { CreateArchiveResponse, PasswordStrengthResult, CompressionLevel } from "../types";

interface SecurityReportProps {
  result: CreateArchiveResponse;
  passwordAnalysis: PasswordStrengthResult | null;
  compressionLabel: CompressionLevel;
  onDone: () => void;
  onCreateAnother: () => void;
}

function formatBytes(b: number): string {
  if (b < 1024)       return `${b} B`;
  if (b < 1048576)    return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

export default function SecurityReport({
  result, compressionLabel, onDone, onCreateAnother,
}: SecurityReportProps) {
  const [copied, setCopied] = useState(false);

  const normalized  = result.output_path.replace(/\\/g, "/");
  const archiveName = normalized.split("/").pop() ?? result.output_path;
  const archiveDir  = normalized.slice(0, normalized.length - archiveName.length - 1);
  const fileWord    = result.file_count === 1 ? "file" : "files";
  const saved = result.total_original_size > 0
    ? Math.round((1 - result.total_compressed_size / result.total_original_size) * 100)
    : 0;

  const copyPath = () => {
    navigator.clipboard.writeText(result.output_path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const showInFolder = async () => { try { await shellOpen(archiveDir); } catch { /* ignore */ } };

  return (
    <div className="canvas animate-fade-in">
      <div className="canvas-center px-10 gap-6">
        <div className="animate-stamp-in"><ArchiveBox variant="sealed" size={176} /></div>

        <div className="text-center space-y-2">
          <h2 className="font-serif text-[34px] font-semibold tracking-tight text-ink leading-none">
            Archive sealed
          </h2>
          <p className="text-[15px] text-ink-soft max-w-xs mx-auto leading-relaxed">
            Only the password can open it. There is no recovery.
          </p>
        </div>

        {/* the sealed box, as a real object with its details */}
        <div className="w-full max-w-sm rounded-2xl border border-border-strong bg-surface shadow-card overflow-hidden">
          <div className="px-4 py-3.5">
            <p className="font-mono text-sm font-medium text-ink truncate">{archiveName}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-faint">
              <span>{result.file_count} {fileWord}</span>
              <span>{formatBytes(result.total_compressed_size)}</span>
              {saved > 0 && <span>{saved}% smaller</span>}
            </div>
          </div>
          <div className="flex border-t border-border divide-x divide-border">
            <button onClick={showInFolder} className="flex-1 py-2.5 text-[12px] text-ink-soft hover:bg-hover transition-colors">
              Show in folder
            </button>
            <button onClick={copyPath} className="flex-1 py-2.5 text-[12px] text-ink-soft hover:bg-hover transition-colors">
              {copied ? "Copied" : "Copy path"}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-ink-faint">
          XChaCha20-Poly1305 · Argon2id · BLAKE3 · Zstd {compressionLabel.toLowerCase()}
        </p>
      </div>

      <div className="bottom-bar">
        <button onClick={onCreateAnother} className="btn-ghost text-sm">Seal another</button>
        <button onClick={onDone} className="btn-primary">Done</button>
      </div>
    </div>
  );
}
