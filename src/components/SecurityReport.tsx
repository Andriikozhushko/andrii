import { ShieldCheck, Lock, Key, Hash, FileArchive, X, Copy, CheckCircle2 } from "lucide-react";
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

const SCORE_COLOR: Record<number, string> = {
  0: "text-danger-text",
  1: "text-warning-text",
  2: "text-yellow-300",
  3: "text-success-text",
  4: "text-teal-300",
};

export default function SecurityReport({
  result,
  password,
  compressionLabel,
  onClose,
}: SecurityReportProps) {
  const [copied, setCopied] = useState(false);

  const compressionPct = result.compression_ratio > 0
    ? `${(result.compression_ratio * 100).toFixed(1)}% smaller`
    : "No reduction";

  const handleCopyPath = () => {
    navigator.clipboard.writeText(result.output_path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
              <p className="text-2xs text-text-muted">Security Report</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
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

          {/* Security profile */}
          <div>
            <p className="label mb-3">Security Profile</p>
            <div className="space-y-2">
              <SecurityRow icon={Lock} label="Encryption" value="XChaCha20-Poly1305" status="ok" />
              <SecurityRow icon={Key} label="Key Derivation" value="Argon2id (64 MiB, 3×, 4 lanes)" status="ok" />
              <SecurityRow icon={Hash} label="Integrity" value="BLAKE3 (archive + per-file)" status="ok" />
              <SecurityRow icon={Lock} label="Metadata" value="Fully encrypted" status="ok" />
              <SecurityRow icon={FileArchive} label="Compression" value={compressionLabel} status="info" />
            </div>
          </div>

          {/* Password strength */}
          {password && (
            <div className="px-4 py-3 rounded-lg bg-bg-base border border-border/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs font-medium text-text-secondary uppercase tracking-wider">
                  Password Strength
                </span>
                <span className={`text-xs font-semibold ${SCORE_COLOR[password.score] ?? "text-text-secondary"}`}>
                  {password.label}
                </span>
              </div>
              <div className="flex gap-1 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${i <= password.score ? getBarColor(password.score) : "bg-border"}`}
                  />
                ))}
              </div>
              <p className="text-2xs text-text-muted">
                Estimated resistance:{" "}
                <span className={`font-medium ${SCORE_COLOR[password.score]}`}>
                  {password.estimated_crack_time}
                </span>
              </p>
            </div>
          )}
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

function getBarColor(score: number): string {
  if (score <= 0) return "bg-danger";
  if (score === 1) return "bg-warning";
  if (score === 2) return "bg-yellow-500";
  if (score === 3) return "bg-success";
  return "bg-teal-500";
}

interface SecurityRowProps {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  value: string;
  status: "ok" | "warn" | "info";
}

function SecurityRow({ icon: Icon, label, value, status }: SecurityRowProps) {
  const statusIcon = {
    ok: <CheckCircle2 size={13} className="text-success shrink-0" />,
    warn: <CheckCircle2 size={13} className="text-warning shrink-0" />,
    info: <CheckCircle2 size={13} className="text-accent shrink-0" />,
  }[status];

  return (
    <div className="flex items-center gap-2.5">
      {statusIcon}
      <Icon size={13} className="text-text-muted shrink-0" />
      <span className="text-2xs text-text-muted min-w-[110px]">{label}</span>
      <span className="text-2xs text-text-secondary font-medium">{value}</span>
    </div>
  );
}
