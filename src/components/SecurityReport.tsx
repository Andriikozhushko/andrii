import { useState } from "react";
import { CheckCircle2, ChevronRight, Copy, CheckCheck } from "lucide-react";
import type { CreateArchiveResponse, PasswordStrengthResult, CompressionLevel } from "../types";

interface SecurityReportProps {
  result: CreateArchiveResponse;
  passwordAnalysis: PasswordStrengthResult | null;
  compressionLabel: CompressionLevel;
  onDone: () => void;
  onCreateAnother: () => void;
}

function computeScore(pwScore: number | null) {
  const contrib = pwScore === null ? 15 : ([0, 7, 14, 22, 30][pwScore] ?? 0);
  const score = 70 + contrib;
  if (score >= 100) return { score, label: "Perfect",   color: "text-success-text"  };
  if (score >= 90)  return { score, label: "Excellent", color: "text-accent"         };
  if (score >= 77)  return { score, label: "Good",      color: "text-accent"         };
  return              { score, label: "Moderate",  color: "text-warning-text"  };
}

const PW_LABELS = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
const PW_COLORS = [
  "text-danger-text", "text-warning-text", "text-yellow-600",
  "text-accent",      "text-success-text",
];

function kdfDisplayTime(score: number, actual: string): { text: string; color: string } {
  if (score === 0) return { text: "Seconds to minutes", color: "text-danger-text" };
  if (score === 1) return { text: "Minutes to hours",   color: "text-warning-text" };
  return { text: actual, color: "text-accent" };
}

export default function SecurityReport({
  result, passwordAnalysis, compressionLabel, onDone, onCreateAnother,
}: SecurityReportProps) {
  const [showTech, setShowTech] = useState(false);
  const [copied, setCopied]     = useState(false);

  const { score, label, color } = computeScore(passwordAnalysis?.score ?? null);
  const archiveName = result.output_path.replace(/\\/g, "/").split("/").pop() ?? result.output_path;

  const saved = result.total_original_size > 0
    ? Math.round((1 - result.total_compressed_size / result.total_original_size) * 100)
    : 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(result.output_path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="canvas animate-fade-in bg-surface">
      <div className="canvas-center px-10 py-8">
        {/* Score */}
        <div className="text-center mb-10">
          <div className={`text-[80px] font-bold leading-none tabular-nums ${color}`}>{score}</div>
          <div className="mt-2 text-[11px] font-bold tracking-[0.22em] text-text-muted uppercase">{label}</div>
        </div>

        <div className="w-full max-w-sm space-y-5">
          {/* Archive info */}
          <button
            className="flex items-center gap-2 w-full text-left group"
            onClick={handleCopy}
            title="Click to copy full path"
          >
            <span className="font-mono text-sm text-text-secondary truncate flex-1">{archiveName}</span>
            <span className="text-xs text-text-muted shrink-0">
              {result.file_count} file{result.file_count !== 1 ? "s" : ""}
              {saved > 0 ? ` · ${saved}% smaller` : ""}
            </span>
            {copied
              ? <CheckCheck size={13} className="text-accent shrink-0" />
              : <Copy size={13} className="text-text-muted opacity-50 group-hover:opacity-100 shrink-0 transition-opacity" />}
          </button>

          <hr className="border-border" />

          {/* Protection checks */}
          <div className="space-y-0.5">
            <ProtRow text="File contents encrypted" />
            <ProtRow text="File names hidden inside archive" />
            <ProtRow text="Integrity sealed — tamper-evident" />
          </div>

          {/* Password section */}
          {passwordAnalysis && (() => {
            const kdf = kdfDisplayTime(passwordAnalysis.score, passwordAnalysis.estimated_crack_time);
            return (
              <div className="space-y-0 border border-border rounded-xl overflow-hidden">
                <div className="report-stat px-4">
                  <span className="text-text-muted">Password strength</span>
                  <span className={`font-medium ${PW_COLORS[passwordAnalysis.score] ?? ""}`}>
                    {PW_LABELS[passwordAnalysis.score] ?? "Unknown"}
                  </span>
                </div>
                <div className="report-stat px-4">
                  <span className="text-text-muted">Without protection</span>
                  <span className="font-mono text-danger-text">{passwordAnalysis.gpu_crack_time}</span>
                </div>
                <div className="report-stat px-4">
                  <span className="text-text-muted">With ANDRII KDF</span>
                  <span className={`font-mono ${kdf.color}`}>{kdf.text}</span>
                </div>
              </div>
            );
          })()}

          {/* Technical details */}
          <div>
            <button
              onClick={() => setShowTech(!showTech)}
              className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
            >
              <ChevronRight size={12} className={`transition-transform duration-150 ${showTech ? "rotate-90" : ""}`} />
              Technical details
            </button>
            {showTech && (
              <div className="mt-2.5 space-y-1 pl-4 animate-fade-in">
                <TechRow k="Encryption"     v="XChaCha20-Poly1305" />
                <TechRow k="Key derivation" v="Argon2id  (64 MiB · 3 passes · 4 lanes)" />
                <TechRow k="Integrity"      v="BLAKE3  (per-file + archive)" />
                <TechRow k="Compression"    v={`Zstd · ${compressionLabel}`} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bottom-bar">
        <button onClick={onCreateAnother} className="btn-ghost text-sm text-text-muted">
          Encrypt another
        </button>
        <button onClick={onDone} className="btn-primary">
          Done →
        </button>
      </div>
    </div>
  );
}

function ProtRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <CheckCircle2 size={14} className="text-accent shrink-0" />
      <span className="text-sm text-text-secondary">{text}</span>
    </div>
  );
}

function TechRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 text-[11px]">
      <span className="text-text-muted w-28 shrink-0">{k}</span>
      <span className="font-mono text-text-secondary">{v}</span>
    </div>
  );
}
