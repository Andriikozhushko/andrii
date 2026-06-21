import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WaxSeal, CrackedSeal, SealInspector, InkLens } from "../components/art";
import { useT } from "../i18n";
import type { VerifyResult } from "../types";

interface VerifyArchiveProps {
  archivePath?: string;
  onBack: () => void;
}

export default function VerifyArchive({ archivePath, onBack }: VerifyArchiveProps) {
  const t = useT();
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

  let verdict: null | { kind: "intact" | "broken" | "unknown" | "fail"; title: string; body: string } = null;
  if (result) {
    if (result.is_valid) verdict = { kind: "intact", title: t("verify.intact"), body: t("verify.intactSub") };
    else if (isTampered) verdict = { kind: "broken", title: t("verify.broken"), body: t("verify.brokenSub") };
    else if (isUnknown)  verdict = { kind: "unknown", title: t("verify.noSeal"), body: t("verify.noSealSub") };
    else                 verdict = { kind: "fail", title: t("verify.cantCheck"), body: result.error ?? "" };
  }

  return (
    <div className="canvas">
      <div className="canvas-center px-10 gap-7">
        {verifying ? (
          <div className="flex flex-col items-center gap-5 animate-fade-in">
            <div className="animate-pulse"><SealInspector size={150} /></div>
            <p className="text-sm text-ink-faint">{t("verify.checking")}</p>
          </div>
        ) : verdict ? (
          <div className="flex flex-col items-center gap-6 animate-fade-in">
            {verdict.kind === "intact"
              ? <div className="animate-stamp-in"><WaxSeal size={156} /></div>
              : <div className={verdict.kind === "broken" ? "animate-shake" : ""}><CrackedSeal size={156} /></div>}

            <div className="text-center space-y-2">
              <h2 className={`font-serif text-[30px] font-semibold tracking-tight leading-tight
                ${intact ? "text-safe-deep" : verdict.kind === "unknown" ? "text-ink" : "text-wax-deep"}`}>
                {verdict.title}
              </h2>
              <p className="text-[15px] text-ink-soft max-w-sm mx-auto leading-relaxed">{verdict.body}</p>
              {archiveName && (
                <p className="font-mono text-[12px] text-ink-faint pt-1 truncate max-w-xs mx-auto">{archiveName}</p>
              )}
            </div>

            {archivePath && (
              <button onClick={() => runVerify(archivePath)} className="btn-secondary text-sm">
                <InkLens size={15} /> {t("verify.checkAgain")}
              </button>
            )}
          </div>
        ) : error ? (
          <p className="text-sm text-wax">{error}</p>
        ) : null}
      </div>

      <div className="bottom-bar">
        <button onClick={onBack} className="btn-ghost text-sm">← {t("common.back")}</button>
      </div>
    </div>
  );
}
