import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ShieldCheck, ShieldX, ShieldAlert, FolderOpen, Loader2,
  CheckCircle2, XCircle, AlertCircle, Hash, FileText,
} from "lucide-react";

import type { VerifyResult } from "../types";

interface VerifyArchiveProps {
  onBack: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function VerifyArchive({ onBack }: VerifyArchiveProps) {
  const [archivePath, setArchivePath] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "ANDRII Archive", extensions: ["andrii"] }],
    });
    if (!selected) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (path) {
      setArchivePath(path);
      setResult(null);
      setError(null);
    }
  };

  const handleVerify = async () => {
    if (!archivePath) return;
    setIsVerifying(true);
    setResult(null);
    setError(null);
    try {
      const res = await invoke<VerifyResult>("verify_archive_cmd", {
        request: { archive_path: archivePath },
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsVerifying(false);
    }
  };

  const StatusIcon = result
    ? result.is_valid
      ? ShieldCheck
      : result.has_valid_magic
      ? ShieldAlert
      : ShieldX
    : ShieldCheck;

  const statusColor = result
    ? result.is_valid
      ? "text-success"
      : result.has_valid_magic
      ? "text-warning"
      : "text-danger"
    : "text-text-muted";

  const statusBg = result
    ? result.is_valid
      ? "bg-success/10 border-success/20"
      : result.has_valid_magic
      ? "bg-warning/10 border-warning/20"
      : "bg-danger/10 border-danger/20"
    : "bg-bg-elevated border-border";

  const statusMessage = result
    ? result.is_valid
      ? "Archive integrity verified"
      : result.error ?? "Verification failed"
    : null;

  return (
    <div className="flex flex-col items-center justify-start px-8 py-8 h-full overflow-y-auto">
      <div className="w-full max-w-xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-bg-elevated border border-border flex items-center justify-center">
            <ShieldCheck size={18} className="text-text-secondary" />
          </div>
          <div>
            <h2 className="section-title">Verify Archive</h2>
            <p className="text-2xs text-text-muted mt-0.5">Check integrity without decrypting</p>
          </div>
        </div>

        {/* File selection */}
        <div className="card p-5 mb-5">
          <label className="label">Archive File</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              readOnly
              className="input-field flex-1 text-xs font-mono cursor-pointer"
              placeholder="Select .andrii file…"
              value={archivePath ? archivePath.split(/[\\/]/).pop() ?? "" : ""}
              onClick={handleBrowse}
              title={archivePath}
            />
            <button onClick={handleBrowse} className="btn-secondary px-3 shrink-0">
              <FolderOpen size={14} />
            </button>
          </div>
          {archivePath && (
            <p className="text-2xs text-text-muted font-mono truncate">{archivePath}</p>
          )}
        </div>

        {/* Verify button */}
        <button
          onClick={handleVerify}
          disabled={!archivePath || isVerifying}
          className="btn-primary w-full justify-center mb-6"
        >
          {isVerifying ? (
            <><Loader2 size={15} className="animate-spin" />Verifying…</>
          ) : (
            <><ShieldCheck size={15} />Verify Integrity</>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-danger-muted border border-danger/20 mb-5">
            <p className="text-sm text-danger-text">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`card p-5 border ${statusBg} animate-slide-up`}>
            {/* Status header */}
            <div className="flex items-center gap-4 mb-5 pb-5 border-b border-border/40">
              <div className={`w-14 h-14 rounded-2xl ${statusBg} border flex items-center justify-center`}>
                <StatusIcon size={28} className={statusColor} />
              </div>
              <div>
                <p className={`text-base font-semibold ${statusColor}`}>
                  {result.is_valid ? "Valid Archive" : result.has_valid_magic ? "Warning" : "Invalid Archive"}
                </p>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  {statusMessage}
                </p>
              </div>
            </div>

            {/* Checks */}
            <div className="space-y-2.5 mb-5">
              <p className="label">Verification Checks</p>
              <CheckRow
                ok={result.has_valid_magic}
                label="Valid ANDRII format"
                desc="Magic bytes and file structure recognized"
              />
              <CheckRow
                ok={result.version_supported}
                label="Supported version"
                desc={`Format version ${result.format_version}`}
                warn={!result.version_supported && result.has_valid_magic}
              />
              <CheckRow
                ok={result.integrity_hash_valid}
                label="Archive integrity"
                desc="BLAKE3 hash matches archive content"
                warn={!result.integrity_hash_valid && result.version_supported}
              />
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-2">
              <DetailStat icon={FileText} label="File Size" value={formatBytes(result.file_size)} />
              <DetailStat icon={Hash} label="Format Version" value={`v${result.format_version}`} />
            </div>

            {result.is_valid && (
              <div className="mt-4 px-3 py-2.5 rounded-lg bg-success/8 border border-success/15">
                <p className="text-2xs text-success-text leading-relaxed">
                  Archive passed all integrity checks. Content authenticity can only be verified
                  by decrypting with the correct password.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Back */}
        <div className="mt-5">
          <button onClick={onBack} className="btn-secondary w-full justify-center text-xs">
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckRow({
  ok, label, desc, warn = false,
}: { ok: boolean; label: string; desc: string; warn?: boolean }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertCircle : XCircle;
  const color = ok ? "text-success" : warn ? "text-warning" : "text-danger";
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-bg-base border border-border/50">
      <Icon size={15} className={`${color} shrink-0 mt-0.5`} />
      <div>
        <p className="text-xs font-medium text-text-primary">{label}</p>
        <p className="text-2xs text-text-muted mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function DetailStat({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ size?: number | string; className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-bg-base border border-border/50">
      <Icon size={13} className="text-text-muted" />
      <div>
        <p className="text-2xs text-text-muted">{label}</p>
        <p className="text-xs font-medium font-mono text-text-secondary">{value}</p>
      </div>
    </div>
  );
}
