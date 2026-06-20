import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ShieldCheck, ShieldX, FolderOpen, Loader2,
  CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";

import type { VerifyResult } from "../types";

interface VerifyArchiveProps {
  onBack: () => void;
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

  const isTampered = result && !result.is_valid && result.has_valid_magic && result.version_supported && !result.integrity_hash_valid;
  const isUnknownFormat = result && !result.has_valid_magic;

  return (
    <div className="flex flex-col items-center justify-start px-8 py-8 h-full overflow-y-auto">
      <div className="w-full max-w-lg animate-slide-up">
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
          <div className="animate-slide-up space-y-4">
            {/* Primary verdict */}
            {result.is_valid ? (
              <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-success/8 border border-success/20">
                <div className="w-12 h-12 rounded-xl bg-success/15 border border-success/20 flex items-center justify-center shrink-0">
                  <ShieldCheck size={24} className="text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-success-text">Archive is authentic</p>
                  <p className="text-2xs text-text-secondary mt-0.5 leading-relaxed">
                    Integrity verified. Content has not been modified since creation.
                  </p>
                </div>
              </div>
            ) : isTampered ? (
              <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-danger/8 border border-danger/30">
                <div className="w-12 h-12 rounded-xl bg-danger/15 border border-danger/25 flex items-center justify-center shrink-0">
                  <ShieldX size={24} className="text-danger" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-danger-text">Archive has been modified</p>
                  <p className="text-2xs text-text-secondary mt-0.5 leading-relaxed">
                    Do not extract this archive. The content cannot be trusted.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-danger/8 border border-danger/30">
                <div className="w-12 h-12 rounded-xl bg-danger/15 border border-danger/25 flex items-center justify-center shrink-0">
                  <ShieldX size={24} className="text-danger" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-danger-text">
                    {isUnknownFormat ? "Not a valid ANDRII archive" : "Verification failed"}
                  </p>
                  <p className="text-2xs text-text-secondary mt-0.5 leading-relaxed">
                    {result.error ?? "This file cannot be verified."}
                  </p>
                </div>
              </div>
            )}

            {/* Checks */}
            <div className="card p-4 space-y-2">
              <CheckRow
                ok={result.has_valid_magic}
                label="Valid ANDRII format"
                desc="File structure and magic bytes recognized"
              />
              <CheckRow
                ok={result.version_supported}
                label="Supported version"
                desc={`Format version ${result.format_version}`}
                warn={!result.version_supported && result.has_valid_magic}
              />
              <CheckRow
                ok={result.integrity_hash_valid}
                label="Content integrity"
                desc={result.integrity_hash_valid
                  ? "BLAKE3 hash matches — archive unmodified"
                  : "BLAKE3 hash mismatch — archive may have been tampered with"}
                warn={false}
                critical={!result.integrity_hash_valid && result.version_supported}
              />
            </div>
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
  ok, label, desc, warn = false, critical = false,
}: { ok: boolean; label: string; desc: string; warn?: boolean; critical?: boolean }) {
  const Icon = ok ? CheckCircle2 : (critical || (!warn && !ok)) ? XCircle : AlertCircle;
  const color = ok ? "text-success" : critical ? "text-danger" : warn ? "text-warning" : "text-danger";
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
