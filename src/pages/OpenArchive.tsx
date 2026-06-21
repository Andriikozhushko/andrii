import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Eye, EyeOff, Loader2, ArrowDownToLine, ChevronDown, ChevronUp, X,
} from "lucide-react";
import Vault from "../components/Vault";
import { InkFileGlyph, Keyhole, InkKey } from "../components/art";
import { useT, type TFn } from "../i18n";
import { addRecent } from "../lib/storage";
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

function humanizeError(raw: string, t: TFn): string {
  const s = raw.toLowerCase();
  if (s.includes("invalid password") || s.includes("invalidpassword")) return t("open.errIncorrect");
  if (s.includes("magic") || s.includes("invalidmagic")) return t("open.errNotArchive");
  if (s.includes("tamper") || s.includes("corrupt")) return t("open.errCorrupted");
  if (s.includes("no such file") || s.includes("os error 2")) return t("open.errNotFound");
  return t("open.errFailed");
}

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
      addRecent({ name: archiveName, path: archivePath, date: Date.now(), size: info.total_compressed_size });
      onUnlocked(password, info);
    } catch (e) {
      setError(humanizeError(String(e), t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="canvas">
      <div className="canvas-center px-10">
        {loading ? (
          /* ── Unlocking state — the seal turns; no spinner ── */
          <div className="flex flex-col items-center gap-5 animate-fade-in">
            <Vault state="unlocking" size={150} />
            <p className="text-sm text-ink-faint">{t("open.unlocking")}</p>
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

type SortKey = "name" | "size" | "date";

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
  const [sortKey, setSortKey]       = useState<SortKey>("name");
  const [sortAsc, setSortAsc]       = useState(true);
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [status, setStatus]         = useState<{ ok: boolean; msg: string } | null>(null);
  const [showInfo, setShowInfo]     = useState(true);

  const saved = info.total_original_size > 0
    ? Math.round((1 - info.total_compressed_size / info.total_original_size) * 100)
    : 0;

  const filtered = [...info.entries]
    .filter(e => basename(e.path).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = basename(a.path).localeCompare(basename(b.path));
      if (sortKey === "size") cmp = a.original_size - b.original_size;
      if (sortKey === "date") cmp = a.modified_at - b.modified_at;
      return sortAsc ? cmp : -cmp;
    });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(true); }
  };
  const toggle = (path: string) => {
    const next = new Set(selected);
    next.has(path) ? next.delete(path) : next.add(path);
    setSelected(next);
  };
  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const toggleAll = () => allSelected ? setSelected(new Set()) : setSelected(new Set(filtered.map(e => e.path)));

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

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => toggleSort(k)} className="flex items-center gap-0.5 text-ink-faint hover:text-ink transition-colors">
      {label}
      {sortKey === k && (sortAsc ? <ChevronUp size={9} /> : <ChevronDown size={9} />)}
    </button>
  );

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

      {/* toolbar */}
      <div className="flex items-center gap-3 px-8 py-2.5 border-b border-border shrink-0">
        <input type="text" className="input-box py-1.5 px-3 text-xs w-44" placeholder={t("open.filter")}
          value={search} onChange={e => setSearch(e.target.value)} />
        <span className="text-xs text-ink-faint">
          {filtered.length !== info.file_count ? `${filtered.length} / ` : ""}{info.file_count}
        </span>
        <span className="flex gap-3 text-xs ml-1">
          <SortBtn k="name" label={t("open.colName")} />
          <SortBtn k="size" label={t("open.colSize")} />
          <SortBtn k="date" label={t("open.colDate")} />
        </span>
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={() => handleExtract(false)} disabled={extracting} className="btn-secondary text-xs py-1.5 px-3 gap-1.5">
              <ArrowDownToLine size={13} /> {t("open.extract", { n: selected.size })}
            </button>
          )}
          <button onClick={() => handleExtract(true)} disabled={extracting} className="btn-primary text-xs py-1.5 px-3 gap-1.5">
            {extracting ? <><Loader2 size={13} className="animate-spin" /> {t("open.extracting")}</> : <><ArrowDownToLine size={13} /> {t("open.extractAll")}</>}
          </button>
        </div>
      </div>

      {/* file table */}
      <div className="flex-1 overflow-y-auto relative">
        {extracting && (
          <div className="absolute inset-0 z-10 bg-bg/70 flex flex-col items-center justify-center gap-3 animate-fade-in">
            <Loader2 size={22} className="animate-spin text-accent" />
            <span className="text-sm text-ink-soft">{t("open.extracting")}</span>
          </div>
        )}
        <div className="px-8 py-1">
          <div className="file-row">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-accent rounded" />
            <span className="text-xs text-ink-faint flex-1">{t("open.selectAll")}</span>
          </div>
          {filtered.map(entry => {
            const name = basename(entry.path);
            const dir = looksDir(entry);
            const checked = selected.has(entry.path);
            return (
              <div key={entry.path}
                className="file-row cursor-pointer hover:bg-hover/60 rounded-lg -mx-2 px-2 transition-colors"
                onClick={() => toggle(entry.path)}>
                <input type="checkbox" checked={checked} onChange={() => toggle(entry.path)}
                  onClick={e => e.stopPropagation()} className="w-3.5 h-3.5 accent-accent rounded shrink-0" />
                <InkFileGlyph size={18} tint={dir ? "#C9760E" : "#5B5347"} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-ink truncate">{name}</div>
                  <div className="text-xs text-ink-faint truncate leading-tight">{entry.path}</div>
                </div>
                <span className="font-mono text-xs text-ink-faint shrink-0 tabular-nums">
                  {dir ? "—" : formatBytes(entry.original_size)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

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
