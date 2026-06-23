import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Eye, EyeOff, ArrowDownToLine, ChevronDown, ChevronUp, X,
} from "lucide-react";
import Vault from "../components/Vault";
import { Keyhole, InkKey } from "../components/art";
import FileTable, { type FileItem } from "../components/FileTable";
import { useT } from "../i18n";
import { recordOpened } from "../lib/storage";
import { mapError } from "../lib/errors";
import type { OpenArchiveResponse, ArchiveFileEntry } from "../types";

interface OpenArchiveProps {
  archivePath: string;
  onUnlocked: (password: string, info: OpenArchiveResponse) => void;
  onBack: () => void;
}

function formatBytes(b: number): string {
  if (b < 1024)       return `${b} B`;
  if (b < 1048576)    return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}
function formatDate(ts: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(ts * 1000));
}
function basename(p: string) { return p.replace(/\\/g, "/").split("/").pop() ?? p; }
function looksDir(e: ArchiveFileEntry) { return e.original_size === 0 && !basename(e.path).includes("."); }

export default function OpenArchive({ archivePath, onUnlocked, onBack }: OpenArchiveProps) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const archiveName = basename(archivePath);

  useEffect(() => { setPassword(""); setError(null); }, [archivePath]);

  const handleUnlock = async () => {
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      const info = await invoke<OpenArchiveResponse>("open_archive", {
        request: { archive_path: archivePath, password },
      });
      recordOpened(archivePath, {
        name: info.archive_name, fileCount: info.file_count,
        sealedSize: info.total_compressed_size, formatVersion: info.format_version,
      });
      onUnlocked(password, info);
    } catch (e) {
      setError(mapError(String(e), t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="canvas">
      <div className="canvas-center px-10">
        {loading ? (
          /* ── The vault is opening — silent; the object is the truth ── */
          <div className="flex flex-col items-center animate-fade-in">
            <Vault state="unlocking" size={150} />
          </div>
        ) : (
          /* ── Password state ── */
          <div className="w-full max-w-sm space-y-6 animate-fade-in">
            <div className="flex flex-col items-center text-center gap-3">
              <Vault state="sealed" size={140} />
              <div className="min-w-0">
                <p className="font-mono text-base font-semibold text-ink truncate max-w-xs">{archiveName}</p>
                <p className="text-xs text-ink-faint mt-1">{t("open.enterToUnlock")}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-70"><Keyhole size={18} /></span>
                <input
                  type={showPw ? "text" : "password"} className="input pl-7 pr-10 text-base"
                  placeholder={t("open.passwordPlaceholder")}
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleUnlock()}
                  autoComplete="current-password" autoFocus
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-ink-faint hover:text-ink">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {error && <p className="text-sm text-wax">{error}</p>}
            </div>

            <button onClick={handleUnlock} disabled={!password} className="btn-primary w-full py-3 text-sm">
              <InkKey size={16} /> {t("open.openBox")}
            </button>
          </div>
        )}
      </div>

      <div className="bottom-bar">
        {!loading && <button onClick={onBack} className="btn-ghost text-sm">← {t("common.back")}</button>}
      </div>
    </div>
  );
}

/* ── Unlocked view ─────────────────────────────────────────────────────────── */

interface UnlockedArchiveProps {
  archivePath: string;
  password: string;
  info: OpenArchiveResponse;
  onClose: () => void;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-ink-faint">{label}</span>
      <span className="text-[13px] font-medium text-ink tabular-nums">{value}</span>
    </div>
  );
}

export function UnlockedArchive({ archivePath, password, info, onClose }: UnlockedArchiveProps) {
  const t = useT();
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [status, setStatus]         = useState<{ ok: boolean; msg: string } | null>(null);
  const [showInfo, setShowInfo]     = useState(true);

  const saved = info.total_original_size > 0
    ? Math.round((1 - info.total_compressed_size / info.total_original_size) * 100)
    : 0;

  const items: FileItem[] = info.entries.map(e => ({
    key: e.path,
    name: basename(e.path),
    sub: e.path,
    size: e.original_size,
    isDir: looksDir(e),
    date: e.modified_at,
  }));

  const handleExtract = async (all: boolean) => {
    const outputDir = await open({ multiple: false, directory: true });
    if (!outputDir) return;
    const dir = Array.isArray(outputDir) ? outputDir[0] : outputDir;
    if (!dir) return;
    setExtracting(true);
    setStatus(null);
    try {
      await invoke("extract_archive", {
        request: { archive_path: archivePath, password, output_dir: dir, selected_files: all ? null : [...selected] },
      });
      const n = all ? info.file_count : selected.size;
      setStatus({ ok: true, msg: t("open.extractedTo", { n, files: t(n === 1 ? "common.file" : "common.files"), dir }) });
    } catch (e) {
      setStatus({ ok: false, msg: String(e) });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="canvas">
      {/* archive details */}
      <div className="px-8 py-3 border-b border-border shrink-0">
        <button className="flex items-center gap-2 w-full" onClick={() => setShowInfo(!showInfo)}>
          <span className="shrink-0"><Vault state="opened" size={42} /></span>
          <span className="text-sm font-semibold text-ink flex-1 font-mono text-left truncate">{info.archive_name}</span>
          {showInfo ? <ChevronUp size={13} className="text-ink-faint" /> : <ChevronDown size={13} className="text-ink-faint" />}
        </button>
        {showInfo && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-4 animate-fade-in">
            <DetailItem label={t("details.files")} value={String(info.file_count)} />
            <DetailItem label={t("details.size")} value={formatBytes(info.total_original_size)} />
            <DetailItem label={t("details.created")} value={formatDate(info.created_at)} />
            <DetailItem label={t("details.spaceSaved")} value={saved > 0 ? `${saved}%` : "—"} />
            <DetailItem label={t("details.format")} value={t("details.formatVersion", { n: info.format_version })} />
          </div>
        )}
      </div>

      {/* file table (shared with the pre-seal review list) */}
      <FileTable
        items={items}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        busy={extracting}
        toolbarRight={keys => (
          <>
            {keys.length > 0 && (
              <button onClick={() => handleExtract(false)} disabled={extracting} className="btn-secondary text-xs py-1.5 px-3 gap-1.5">
                <ArrowDownToLine size={13} /> {t("open.extract", { n: keys.length })}
              </button>
            )}
            <button onClick={() => handleExtract(true)} disabled={extracting} className="btn-primary text-xs py-1.5 px-3 gap-1.5">
              <ArrowDownToLine size={13} /> {t("open.extractAll")}
            </button>
          </>
        )}
      />

      {status && (
        <div className={`px-8 py-2.5 border-t border-border text-xs flex items-center gap-2 shrink-0 ${status.ok ? "text-safe-deep bg-safe/5" : "text-wax bg-wax/5"}`}>
          <span className="flex-1 truncate">{status.msg}</span>
          <button onClick={() => setStatus(null)} className="text-ink-faint hover:text-ink"><X size={13} /></button>
        </div>
      )}

      <div className="bottom-bar">
        <button onClick={onClose} className="btn-ghost text-sm">{t("common.close")}</button>
      </div>
    </div>
  );
}
