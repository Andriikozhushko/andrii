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
  if (score >= 100) return { score, label: "Perfect",   color: "text-teal-400" };
  if (score >= 90)  return { score, label: "Excellent", color: "text-accent"   };
  if (score >= 77)  return { score, label: "Good",      color: "text-accent/70" };
  return              { score, label: "Moderate",  color: "text-warning-text" };
}

const PW_LABELS = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];

export default function SecurityReport({
  result, passwordAnalysis, compressionLabel, onDone, onCreateAnother,
}: SecurityReportProps) {
  const [showTech, setShowTech] = useState(false);
  const [copied, setCopied] = useState(false);

  const { score, label, color } = computeScore(passwordAnalysis?.score ?? null);
  const archiveName = result.output_path.replace(/\\/g, "/").split("/").pop() ?? result.output_path;
  const isWeak = passwordAnalysis !== null && passwordAnalysis.score <= 1;

  const saved = result.total_original_size > 0
    ? Math.round((1 - result.total_compressed_size / result.total_original_size) * 100)
    : 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(result.output_path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="canvas animate-fade-in">
      <div className="canvas-center px-10 py-8">
        {/* Score */}
        <div className="text-center mb-10">
          <div className={`text-8xl font-bold leading-none tabular-nums ${color}`}>{score}</div>
          <div className="mt-2 text-xs font-semibold tracking-[0.2em] text-text-secondary uppercase">{label}</div>
        </div>

        <div className="w-full max-w-sm space-y-5">
          {/* Archive info */}
          <div
            className="flex items-center gap-2 text-xs text-text-muted cursor-pointer hover:text-text-secondary transition-colors"
            onClick={handleCopy}
            title="Click to copy path"
          >
            <span className="font-mono text-text-secondary truncate flex-1">{archiveName}</span>
            <span className="shrink-0">
              {result.file_count} file{result.file_count !== 1 ? "s" : ""}
              {saved > 0 ? ` · ${saved}% smaller` : ""}
            </span>
            {copied
              ? <CheckCheck size={13} className="text-accent shrink-0" />
              : <Copy size={13} className="shrink-0 opacity-40" />}
          </div>

          <div className="divider my-4" />

          {/* Protection checks */}
          <div className="space-y-1">
            <ProtRow text="File contents encrypted" />
            <ProtRow text="File names hidden inside archive" />
            <ProtRow text="Integrity sealed — tamper-evident" />
          </div>

          {/* Password section */}
          {passwordAnalysis && (
            <div className="space-y-1.5 text-2xs pt-1">
              <div className="report-stat">
                <span className="text-text-muted">Password strength</span>
                <span className={`font-medium ${isWeak ? "text-warning-text" : "text-text-secondary"}`}>
                  {PW_LABELS[passwordAnalysis.score] ?? "Unknown"}
                </span>
              </div>
              <div className="report-stat">
                <span className="text-text-muted">Without protection</span>
                <span className="font-mono text-danger-text">{passwordAnalysis.gpu_crack_time}</span>
              </div>
              <div className="report-stat">
                <span className="text-text-muted">With ANDRII KDF</span>
                <span className={`font-mono ${isWeak ? "text-warning-text" : "text-accent"}`}>
                  {isWeak ? "Still not recommended" : passwordAnalysis.estimated_crack_time}
                </span>
              </div>
              {isWeak && passwordAnalysis.suggestions[0] && (
                <p className="text-warning-text leading-relaxed pt-1">{passwordAnalysis.suggestions[0]}</p>
              )}
            </div>
          )}

          {/* Technical details */}
          <div>
            <button
              onClick={() => setShowTech(!showTech)}
              className="flex items-center gap-1 text-2xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <ChevronRight size={12} className={`transition-transform ${showTech ? "rotate-90" : ""}`} />
              Technical details
            </button>
            {showTech && (
              <div className="mt-2 space-y-1 pl-4 animate-fade-in">
                <TechRow k="Encryption"     v="XChaCha20-Poly1305" />
                <TechRow k="Key derivation" v="Argon2id  (64 MiB · 3 passes · 4 lanes)" />
                <TechRow k="Integrity"      v="BLAKE3  (per-file + archive)" />
                <TechRow k="Compression"    v={`Zstd · ${compressionLabel}`} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bottom-bar">
        <button onClick={onCreateAnother} className="btn-ghost text-text-muted">
          Encrypt another
        </button>
        <button onClick={onDone} className="btn-primary px-6">
          Done
        </button>
      </div>
    </div>
  );
}

function ProtRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <CheckCircle2 size={13} className="text-accent shrink-0" />
      <span className="text-xs text-text-secondary">{text}</span>
    </div>
  );
}

function TechRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 text-2xs">
      <span className="text-text-muted w-28 shrink-0">{k}</span>
      <span className="font-mono text-text-secondary">{v}</span>
    </div>
  );
}
