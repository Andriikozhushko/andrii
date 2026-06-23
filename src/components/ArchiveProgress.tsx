import { useMemo } from "react";
import Vault from "./Vault";
import { useT } from "../i18n";
import type { ProgressEvent } from "../types";
import useProgressEta, { formatEta } from "./useProgressEta";
import { is_probably_incompressible } from "../lib/extensions";

function formatBytes(b: number): string {
  if (b < 1024)       return `${b} B`;
  if (b < 1048576)    return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

/**
 * One calm progress bar while a vault is being sealed. Real `archive-progress`
 * events drive everything — no fake motion, no spinner-only state.
 *
 * Adds:
 * - conservative ETA (stabilised)
 * - stuck-detection messaging
 * - human-readable phase language (compression-hint layer)
 * - a subtle "mostly media" hint when the file name looks incompressible
 */
export default function ArchiveProgress({
  progress,
}: {
  progress: ProgressEvent | null;
}) {
  const t = useT();
  const eta = useProgressEta(progress, true);

  const pct = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const filesTotal = progress?.files_total ?? 0;
  const filesDone = Math.min(progress?.files_done ?? 0, filesTotal);
  const fileWord = t(filesTotal === 1 ? "common.file" : "common.files");
  const etaStr = formatEta(eta.etaSeconds);

  // Determine the compression-reality hint for the current file.
  const compressionHint = useMemo(() => {
    const current = progress?.current_file;
    if (!current) return null;
    if (is_probably_incompressible(current)) return t("progress.incompressible");
    return null;
  }, [progress?.current_file, t]);

  // The phase is translated to a human-scale label; stuck overrides it.
  const phaseLabel = useMemo(() => {
    if (eta.stuck === 2) return t("progress.stuckLarge");
    if (eta.stuck === 1) return t("progress.stuckWorking");
    return t(`progress.${progress?.phase ?? "scanning"}`);
  }, [eta.stuck, progress?.phase, t]);

  return (
    <div className="canvas animate-fade-in">
      <div className="canvas-center px-10 gap-6">
        <Vault state="unlocking" size={150} />

        <div className="text-center space-y-1">
          <h2 className="font-serif text-[24px] font-semibold tracking-tight text-ink leading-tight">
            {t("create.sealing")}
          </h2>
          <p className="text-[13px] text-ink-soft">{phaseLabel}</p>
          {compressionHint && (
            <p className="text-[11px] text-ink-faint max-w-xs">{compressionHint}</p>
          )}
        </div>

        <div className="w-full max-w-sm space-y-2.5">
          {/* Bar */}
          <div className="h-2.5 rounded-full bg-surface-sunken border border-border overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex justify-between text-[12px] text-ink-faint tabular-nums">
            <span>
              {filesTotal > 0 ? `${filesDone} / ${filesTotal} ${fileWord}` : ""}
            </span>
            <span>
              {progress && progress.bytes_total > 0
                ? `${formatBytes(progress.bytes_done)} / ${formatBytes(progress.bytes_total)}`
                : ""}
            </span>
            <span>{Math.round(pct)}%</span>
          </div>

          {/* ETA row — only shown when calibrated */}
          {etaStr && (
            <p className="text-center text-[12px] text-ink-faint tabular-nums">
              {etaStr} {t("progress.remaining")}
            </p>
          )}
          {!etaStr && pct > 1 && (
            <p className="text-center text-[12px] text-ink-faint">
              {t("progress.calculating")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
