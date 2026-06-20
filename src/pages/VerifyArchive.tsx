import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ShieldCheck, ShieldX, FolderOpen, Loader2,
  CheckCircle2, XCircle, AlertCircle, X,
} from "lucide-react";
import type { VerifyResult } from "../types";

interface VerifyArchiveProps {
  onBack: () => void;
}

export default function VerifyArchive({ onBack: _onBack }: VerifyArchiveProps) {
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
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-border bg-bg-surface shrink-0">
        <h1 className="text-base font-semibold text-text-primary">Verify Archive</h1>
        <p className="text-2xs text-text-muted mt-0.5">Check file integrity without decrypting — no password required</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-6 space-y-5">
          {/* File selection */}
          <div>
            <label className="field-label">Archive File</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  readOnly
                  className="input-field cursor-pointer font-mono text-xs pr-8"
                  placeholder="Select .andrii file…"
                  value={archivePath}
                  onClick={handleBrowse}
                />
                {archivePath && (
                  <button
                    type="button"
                    onClick={() => { setArchivePath(""); setResult(null); setError(null); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-danger"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <button onClick={handleBrowse} className="btn-secondary px-3 shrink-0 gap-1 text-xs">
                <FolderOpen size={13} /> Browse
              </button>
            </div>
          </div>

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={!archivePath || isVerifying}
            className="btn-primary w-full gap-2"
          >
            {isVerifying
              ? <><Loader2 size={14} className="animate-spin" /> Verifying…</>
              : <><ShieldCheck size={14} /> Verify Integrity</>}
          </button>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-md bg-danger-muted border border-danger/20">
              <p className="text-2xs text-danger-text">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3 animate-fade-in">
              {/* Verdict */}
              {result.is_valid ? (
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-md bg-success-muted border border-success/20">
                  <ShieldCheck size={18} className="text-success shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-success-text">Archive is authentic</p>
                    <p className="text-2xs text-text-secondary mt-0.5">
                      Integrity verified. Content has not been modified since creation.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-md bg-danger-muted border border-danger/20">
                  <ShieldX size={18} className="text-danger shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-danger-text">
                      {isTampered ? "Archive has been modified" : isUnknownFormat ? "Not a valid ANDRII archive" : "Verification failed"}
                    </p>
                    <p className="text-2xs text-text-secondary mt-0.5">
                      {isTampered
                        ? "Do not extract this archive. The content cannot be trusted."
                        : result.error ?? "This file cannot be verified."}
                    </p>
                  </div>
                </div>
              )}

              {/* Detail checks */}
              <div className="border border-border rounded-md overflow-hidden">
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
                  border
                />
                <CheckRow
                  ok={result.integrity_hash_valid}
                  label="Content integrity"
                  desc={
                    result.integrity_hash_valid
                      ? "BLAKE3 hash matches — archive unmodified"
                      : "BLAKE3 hash mismatch — archive may have been tampered with"
                  }
                  warn={false}
                  critical={!result.integrity_hash_valid && result.version_supported}
                  border
                />
              </div>
            </div>
          )}

          {!result && !isVerifying && (
            <div className="text-center py-8 text-text-muted">
              <ShieldCheck size={24} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select an archive to verify</p>
              <p className="text-2xs mt-1">Integrity check uses BLAKE3 — no password needed</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckRow({
  ok, label, desc, warn = false, critical = false, border = false,
}: {
  ok: boolean;
  label: string;
  desc: string;
  warn?: boolean;
  critical?: boolean;
  border?: boolean;
}) {
  const Icon = ok ? CheckCircle2 : (critical || (!warn && !ok)) ? XCircle : AlertCircle;
  const iconColor = ok ? "text-success" : critical ? "text-danger" : warn ? "text-warning" : "text-danger";
  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 ${border ? "border-t border-border" : ""}`}>
      <Icon size={14} className={`${iconColor} shrink-0 mt-0.5`} />
      <div>
        <p className="text-xs font-medium text-text-primary">{label}</p>
        <p className="text-2xs text-text-muted mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
