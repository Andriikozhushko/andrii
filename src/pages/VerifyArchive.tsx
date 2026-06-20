import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShieldCheck, ShieldX, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type { VerifyResult } from "../types";

interface VerifyArchiveProps {
  archivePath?: string;
  onBack: () => void;
}

export default function VerifyArchive({ archivePath, onBack }: VerifyArchiveProps) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult]       = useState<VerifyResult | null>(null);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    setResult(null);
    setError(null);
    if (archivePath) runVerify(archivePath);
  }, [archivePath]);

  const runVerify = async (path: string) => {
    setVerifying(true);
    setResult(null);
    setError(null);
    try {
      const r = await invoke<VerifyResult>("verify_archive_cmd", {
        request: { archive_path: path },
      });
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setVerifying(false);
    }
  };

  const archiveName = archivePath?.replace(/\\/g, "/").split("/").pop() ?? "";
  const isTampered  = result && !result.is_valid && result.has_valid_magic
    && result.version_supported && !result.integrity_hash_valid;
  const isUnknown   = result && !result.has_valid_magic;

  return (
    <div className="canvas bg-surface">
      <div className="canvas-center px-10">
        <div className="w-full max-w-sm space-y-6 animate-fade-in">

          {verifying ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-12 h-12 rounded-full border-2 border-border border-t-accent animate-spin" />
              <p className="text-sm text-text-muted">Checking integrity…</p>
            </div>

          ) : result ? (
            <>
              {/* Verdict */}
              {result.is_valid ? (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <ShieldCheck size={24} className="text-accent" />
                  </div>
                  <div className="pt-1">
                    <p className="text-base font-semibold text-text-primary">Archive is authentic</p>
                    <p className="text-sm text-text-muted mt-0.5">
                      {archiveName && <span className="font-mono">{archiveName} — </span>}
                      contents unmodified since creation
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
                    <ShieldX size={24} className="text-danger" />
                  </div>
                  <div className="pt-1">
                    <p className="text-base font-semibold text-danger-text">
                      {isTampered ? "Archive has been modified"
                        : isUnknown ? "Not a valid ANDRII archive"
                        : "Verification failed"}
                    </p>
                    <p className="text-sm text-text-muted mt-0.5">
                      {isTampered
                        ? "Do not extract. Content cannot be trusted."
                        : (result.error ?? "")}
                    </p>
                  </div>
                </div>
              )}

              {/* Check rows */}
              <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                <CheckRow ok={result.has_valid_magic}      label="Valid ANDRII format"   desc="Magic bytes and structure recognized" />
                <CheckRow ok={result.version_supported}    label="Supported version"     desc={`Format v${result.format_version}`}  warn={!result.version_supported && result.has_valid_magic} />
                <CheckRow ok={result.integrity_hash_valid} label="Content integrity"     desc="BLAKE3 hash matches original"        critical={!result.integrity_hash_valid && result.version_supported} />
              </div>

              {archivePath && (
                <button
                  onClick={() => runVerify(archivePath)}
                  className="btn-ghost text-xs text-text-muted"
                >
                  Verify again
                </button>
              )}
            </>

          ) : error ? (
            <p className="text-sm text-danger-text">{error}</p>
          ) : null}

        </div>
      </div>

      <div className="bottom-bar">
        <button onClick={onBack} className="btn-ghost text-sm text-text-muted">
          ← Back
        </button>
      </div>
    </div>
  );
}

function CheckRow({ ok, label, desc, warn = false, critical = false }: {
  ok: boolean; label: string; desc: string; warn?: boolean; critical?: boolean;
}) {
  const Icon  = ok ? CheckCircle2 : (critical || (!warn && !ok)) ? XCircle : AlertCircle;
  const color = ok ? "text-accent" : critical ? "text-danger-text" : warn ? "text-warning-text" : "text-danger-text";
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon size={15} className={`${color} shrink-0 mt-0.5`} />
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-muted">{desc}</p>
      </div>
    </div>
  );
}
