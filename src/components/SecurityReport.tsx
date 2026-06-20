import { ShieldCheck, FileArchive, X, Copy, CheckCircle2, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { CreateArchiveResponse, PasswordStrengthResult } from "../types";

interface SecurityReportProps {
  result: CreateArchiveResponse;
  password: PasswordStrengthResult | null;
  compressionLabel: string;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function computeSecurityScore(passwordScore: number | null): {
  score: number;
  label: "Perfect" | "Excellent" | "Good" | "Moderate";
  color: string;
  ringColor: string;
  note: string;
} {
  // Crypto base: XChaCha20-Poly1305 + Argon2id + BLAKE3 = 70 points
  // Password adds 0-30 points
  const pwContrib = passwordScore === null ? 15
    : [0, 7, 14, 22, 30][passwordScore] ?? 0;
  const score = 70 + pwContrib;

  if (score >= 100) return { score, label: "Perfect", color: "text-teal-300", ringColor: "stroke-teal-400", note: "Maximum achievable security" };
  if (score >= 90) return { score, label: "Excellent", color: "text-success-text", ringColor: "stroke-success", note: "Your archive is extremely secure" };
  if (score >= 77) return { score, label: "Good", color: "text-accent", ringColor: "stroke-accent", note: "Strong protection — consider a longer password" };
  return { score, label: "Moderate", color: "text-warning-text", ringColor: "stroke-warning", note: "Use a stronger password for maximum security" };
}

function CircleScore({ score, color, ringColor }: { score: number; color: string; ringColor: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="100" height="100" className="-rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-bg-base" />
      <circle
        cx="50" cy="50" r={r} fill="none" strokeWidth="7"
        className={ringColor}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text
        x="50" y="50" textAnchor="middle" dominantBaseline="middle"
        className={`rotate-90 fill-current ${color} font-bold text-[18px]`}
        style={{ fontSize: 18, fontFamily: "inherit" }}
        transform="rotate(90 50 50)"
      >
        {score}
      </text>
    </svg>
  );
}

export default function SecurityReport({
  result,
  password,
  compressionLabel,
  onClose,
}: SecurityReportProps) {
  const [copied, setCopied] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  const compressionPct = result.compression_ratio > 0
    ? `${(result.compression_ratio * 100).toFixed(1)}% smaller`
    : "No reduction";

  const { score, label, color, ringColor, note } = computeSecurityScore(
    password ? password.score : null
  );

  const handleCopyPath = () => {
    navigator.clipboard.writeText(result.output_path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const SCORE_COLORS = ["text-danger-text", "text-warning-text", "text-yellow-300", "text-success-text", "text-teal-300"];
  const BAR_COLORS = ["bg-danger", "bg-warning", "bg-yellow-500", "bg-success", "bg-teal-500"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md mx-4 card-elevated overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-elevated">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-success/15 border border-success/25 flex items-center justify-center">
              <ShieldCheck size={18} className="text-success" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Archive Created</h2>
              <p className="text-2xs text-text-muted">Your files are protected</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Security Score — primary visual */}
          <div className="flex items-center gap-5 px-5 py-4 rounded-xl bg-bg-base border border-border/60">
            <CircleScore score={score} color={color} ringColor={ringColor} />
            <div className="flex-1">
              <p className="text-xs text-text-muted mb-0.5">Security Score</p>
              <p className={`text-2xl font-bold ${color} leading-none mb-1`}>{label}</p>
              <p className="text-2xs text-text-muted leading-relaxed">{note}</p>
              {password && (
                <div className="flex gap-1 mt-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${i <= password.score ? BAR_COLORS[password.score] ?? "bg-border" : "bg-border"}`} />
                  ))}
                  <span className={`text-2xs font-medium ml-1 ${SCORE_COLORS[password.score] ?? "text-text-muted"}`}>
                    {password.label} password
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Archive info */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-base border border-border/60">
            <FileArchive size={16} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-primary font-medium truncate">
                {result.output_path.split(/[\\/]/).pop()}
              </p>
              <p className="text-2xs text-text-muted mt-0.5">
                {result.file_count} file{result.file_count !== 1 ? "s" : ""} · {formatBytes(result.total_compressed_size)} ({compressionPct})
              </p>
            </div>
            <button
              onClick={handleCopyPath}
              className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
              title="Copy path"
            >
              {copied ? <CheckCircle2 size={14} className="text-success" /> : <Copy size={14} />}
            </button>
          </div>

          {/* What's protected summary */}
          <div className="space-y-2">
            <ProtectionRow label="File contents encrypted" />
            <ProtectionRow label="File names hidden" />
            <ProtectionRow label="Archive integrity verified" />
          </div>

          {/* Technical Details — collapsible */}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <button
              onClick={() => setShowTechDetails(!showTechDetails)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-bg-base hover:bg-bg-elevated transition-colors text-left"
            >
              <span className="text-2xs font-medium text-text-muted uppercase tracking-wider">Technical Details</span>
              <ChevronDown
                size={13}
                className={`text-text-muted transition-transform duration-200 ${showTechDetails ? "rotate-180" : ""}`}
              />
            </button>
            {showTechDetails && (
              <div className="px-4 py-3 border-t border-border/40 space-y-2 bg-bg-base animate-fade-in">
                <TechRow label="Encryption" value="XChaCha20-Poly1305" />
                <TechRow label="Key Derivation" value="Argon2id (64 MiB, 3×, 4 lanes)" />
                <TechRow label="Integrity" value="BLAKE3 (archive + per-file)" />
                <TechRow label="Compression" value={compressionLabel} />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button onClick={onClose} className="btn-primary w-full justify-center">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ProtectionRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <CheckCircle2 size={13} className="text-success shrink-0" />
      <span className="text-2xs text-text-secondary">{label}</span>
    </div>
  );
}

function TechRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-text-muted min-w-[110px]">{label}</span>
      <span className="text-2xs text-text-secondary font-mono">{value}</span>
    </div>
  );
}
