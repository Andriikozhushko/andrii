import { useState } from "react";
import { ShieldCheck, FileArchive, X, Copy, CheckCircle2, ChevronDown, AlertTriangle } from "lucide-react";
import type { CreateArchiveResponse, PasswordStrengthResult } from "../types";

interface SecurityReportProps {
  result: CreateArchiveResponse;
  password: PasswordStrengthResult | null;
  compressionLabel: string;
  onClose: () => void;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function computeScore(pwScore: number | null): {
  score: number;
  label: string;
  note: string;
  barColor: string;
  textColor: string;
} {
  const contrib = pwScore === null ? 15 : ([0, 7, 14, 22, 30][pwScore] ?? 0);
  const score = 70 + contrib;
  if (score >= 100) return { score, label: "Perfect", note: "Maximum achievable protection", barColor: "bg-teal-500", textColor: "text-teal-600" };
  if (score >= 90) return { score, label: "Excellent", note: "Your archive is extremely secure", barColor: "bg-success", textColor: "text-success-text" };
  if (score >= 77) return { score, label: "Good", note: "Strong — use a longer password for maximum score", barColor: "bg-accent", textColor: "text-accent" };
  return { score, label: "Moderate", note: "Use a stronger password for better protection", barColor: "bg-warning", textColor: "text-warning-text" };
}

const PW_SCORE_LABELS = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];

export default function SecurityReport({ result, password, compressionLabel, onClose }: SecurityReportProps) {
  const [copied, setCopied] = useState(false);
  const [showTech, setShowTech] = useState(false);

  const { score, label, note, barColor, textColor } = computeScore(password?.score ?? null);
  const isWeakPassword = password !== null && password.score <= 1;

  const compressionPct = result.compression_ratio > 0
    ? `${(result.compression_ratio * 100).toFixed(1)}% smaller`
    : "no size reduction";

  const handleCopy = () => {
    navigator.clipboard.writeText(result.output_path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm mx-4 bg-bg-surface border border-border rounded-xl shadow-lg overflow-hidden animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={16} className="text-success" />
            <h2 className="text-sm font-semibold text-text-primary">Archive Created Successfully</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-elevated transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Score */}
          <div className="flex items-center gap-4 px-4 py-3 rounded-md bg-bg-base border border-border">
            {/* Circular score */}
            <div className="relative shrink-0">
              <svg width="64" height="64" className="-rotate-90">
                <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-bg-elevated" />
                <circle
                  cx="32" cy="32" r="26" fill="none" strokeWidth="5"
                  className={barColor.replace("bg-", "stroke-")}
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 2 * Math.PI * 26} ${2 * Math.PI * 26}`}
                />
              </svg>
              <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${textColor}`}>
                {score}
              </span>
            </div>
            <div>
              <p className={`text-base font-bold ${textColor} leading-none`}>{label}</p>
              <p className="text-2xs text-text-muted mt-1 leading-relaxed">{note}</p>
            </div>
          </div>

          {/* Archive info */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-bg-base border border-border">
            <FileArchive size={14} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">
                {result.output_path.replace(/\\/g, "/").split("/").pop()}
              </p>
              <p className="text-2xs text-text-muted">
                {result.file_count} file{result.file_count !== 1 ? "s" : ""} · {formatBytes(result.total_compressed_size)} ({compressionPct})
              </p>
            </div>
            <button onClick={handleCopy} className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0" title="Copy path">
              {copied ? <CheckCircle2 size={13} className="text-success" /> : <Copy size={13} />}
            </button>
          </div>

          {/* Protection summary */}
          <div className="space-y-1.5">
            <ProtectionRow text="File contents encrypted with a 256-bit key" />
            <ProtectionRow text="File names and metadata hidden" />
            <ProtectionRow text="Archive integrity protected against tampering" />
          </div>

          {/* Password section */}
          {password && (
            <div className={`px-3 py-2.5 rounded-md border text-2xs ${
              isWeakPassword
                ? "bg-warning-muted border-warning/20"
                : "bg-success-muted border-success/20"
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={isWeakPassword ? "text-warning-text font-medium" : "text-success-text font-medium"}>
                  Password: {PW_SCORE_LABELS[password.score] ?? "Unknown"}
                </span>
                {isWeakPassword && <AlertTriangle size={12} className="text-warning" />}
              </div>
              <div className="space-y-0.5 text-text-muted">
                <div className="flex justify-between">
                  <span>Without ANDRII protection</span>
                  <span className="font-mono text-danger-text">{password.gpu_crack_time}</span>
                </div>
                <div className="flex justify-between">
                  <span>With ANDRII KDF</span>
                  <span className={`font-mono ${isWeakPassword ? "text-warning-text" : "text-success-text"}`}>
                    {isWeakPassword ? "Still not recommended" : password.estimated_crack_time}
                  </span>
                </div>
              </div>
              {isWeakPassword && password.suggestions[0] && (
                <p className="mt-1.5 text-warning-text leading-relaxed">{password.suggestions[0]}</p>
              )}
            </div>
          )}

          {/* Technical details (collapsed) */}
          <div className="border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setShowTech(!showTech)}
              className="w-full flex items-center justify-between px-3.5 py-2 bg-bg-base hover:bg-bg-elevated transition-colors text-left"
            >
              <span className="text-2xs text-text-muted font-medium">Technical details</span>
              <ChevronDown size={12} className={`text-text-muted transition-transform ${showTech ? "rotate-180" : ""}`} />
            </button>
            {showTech && (
              <div className="px-3.5 py-2.5 border-t border-border space-y-1.5 bg-bg-base animate-fade-in">
                <TechRow label="Encryption" value="XChaCha20-Poly1305" />
                <TechRow label="Key derivation" value="Argon2id (64 MiB, 3 passes, 4 lanes)" />
                <TechRow label="Integrity" value="BLAKE3 (archive + per-file)" />
                <TechRow label="Compression" value={`Zstd · ${compressionLabel}`} />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button onClick={onClose} className="btn-primary w-full">Done</button>
        </div>
      </div>
    </div>
  );
}

function ProtectionRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 size={13} className="text-success shrink-0 mt-0.5" />
      <span className="text-2xs text-text-secondary">{text}</span>
    </div>
  );
}

function TechRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xs text-text-muted w-28 shrink-0">{label}</span>
      <span className="text-2xs text-text-secondary font-mono">{value}</span>
    </div>
  );
}
