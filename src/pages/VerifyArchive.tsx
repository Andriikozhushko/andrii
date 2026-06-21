import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WaxSeal, CrackedSeal, SealInspector } from "../components/art";
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
      const r = await invoke<VerifyResult>("verify_archive_cmd", { request: { archive_path: path } });
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
  const intact      = result?.is_valid ?? false;

  return (
    <div className="canvas">
      <div className="canvas-center px-10 gap-7">
        {verifying ? (
          <div className="flex flex-col items-center gap-5 animate-fade-in">
            <div className="animate-pulse"><SealInspector size={150} /></div>
            <p className="text-sm text-ink-faint">Checking the seal…</p>
          </div>

        ) : result ? (
          <div className="flex flex-col items-center gap-6 animate-fade-in">
            {intact ? (
              <div className="animate-stamp-in"><WaxSeal size={156} /></div>
            ) : (
              <div className={isTampered ? "animate-shake" : ""}><CrackedSeal size={156} /></div>
            )}

            <div className="text-center space-y-2">
              <h2 className={`font-serif text-[30px] font-semibold tracking-tight leading-tight
                ${intact ? "text-safe-deep" : "text-wax-deep"}`}>
                {intact ? "Seal intact" : isUnknown ? "No seal found" : "Seal broken"}
              </h2>
              <p className="text-[15px] text-ink-soft max-w-sm mx-auto leading-relaxed">
                {intact
                  ? "This .andrii archive has not been modified."
                  : isUnknown
                  ? "This file isn't an ANDRII archive, so there's no seal to check."
                  : "This archive was modified. Do not trust it."}
              </p>
              {archiveName && (
                <p className="font-mono text-[12px] text-ink-faint pt-1 truncate max-w-xs mx-auto">{archiveName}</p>
              )}
            </div>

            {archivePath && (
              <button onClick={() => runVerify(archivePath)} className="btn-secondary text-sm">Check again</button>
            )}
          </div>

        ) : error ? (
          <p className="text-sm text-wax">{error}</p>
        ) : null}
      </div>

      <div className="bottom-bar">
        <button onClick={onBack} className="btn-ghost text-sm">← Back</button>
      </div>
    </div>
  );
}
