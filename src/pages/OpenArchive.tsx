import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Eye, EyeOff, Loader2, File, Folder,
  ArrowDownToLine, ShieldCheck, ChevronDown, ChevronUp, X,
} from "lucide-react";
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
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
  }).format(new Date(ts * 1000));
}
function basename(p: string) { return p.replace(/\\/g, "/").split("/").pop() ?? p; }
function looksDir(e: ArchiveFileEntry) { return e.original_size === 0 && !basename(e.path).includes("."); }
function humanizeError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("invalid password") || s.includes("invalidpassword")) return "Incorrect password.";
  if (s.includes("magic") || s.includes("invalidmagic")) return "Not a valid ANDRII archive.";
  if (s.includes("tamper") || s.includes("corrupt")) return "Archive may be corrupted.";
  if (s.includes("no such file") || s.includes("os error 2")) return "File not found.";
  return "Failed to open archive.";
}

export default function OpenArchive({ archivePath, onUnlocked, onBack }: OpenArchiveProps) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const archiveName = archivePath.replace(/\\/g, "/").split("/").pop() ?? archivePath;

  useEffect(() => { setPassword(""); setError(null); }, [archivePath]);

  const handleUnlock = async () => {
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      const info = await invoke<OpenArchiveResponse>("open_archive", {
        request: { archive_path: archivePath, password },
      });
      onUnlocked(password, info);
    } catch (e) {
      setError(humanizeError(String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="canvas">
      <div className="canvas-center px-10">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <p className="font-mono text-sm text-text-secondary truncate mb-0.5">{archiveName}</p>
            <p className="text-2xs text-text-muted font-mono truncate">{archivePath}</p>
          </div>

          <div>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="input w-full pr-8 text-base"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleUnlock()}
                autoComplete="current-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {error && <p className="mt-2 text-2xs text-danger-text">{error}</p>}
          </div>

          <button
            onClick={handleUnlock}
            disabled={!password || loading}
            className="btn-primary w-full py-2.5 text-sm"
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Unlocking…</>
              : "Unlock archive →"}
          </button>
        </div>
      </div>

      <div className="bottom-bar">
        <button onClick={onBack} className="btn-ghost text-text-muted text-xs">
          ← Back
        </button>
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

export function UnlockedArchive({ archivePath, password, info, onClose }: UnlockedArchiveProps) {
  const [sortKey, setSortKey]   = useState<SortKey>("name");
  const [sortAsc, setSortAsc]   = useState(true);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [status, setStatus]     = useState<{ ok: boolean; msg: string } | null>(null);
  const [showInfo, setShowInfo] = useState(true);

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
  const toggleAll   = () => allSelected
    ? setSelected(new Set())
    : setSelected(new Set(filtered.map(e => e.path)));

  const handleExtract = async (all: boolean) => {
    const outputDir = await open({ multiple: false, directory: true });
    if (!outputDir) return;
    const dir = Array.isArray(outputDir) ? outputDir[0] : outputDir;
    if (!dir) return;
    setExtracting(true);
    setStatus(null);
    try {
      await invoke("extract_archive", {
        request: {
          archive_path: archivePath,
          password,
          output_dir: dir,
          selected_files: all ? null : [...selected],
        },
      });
      const n = all ? info.file_count : selected.size;
      setStatus({ ok: true, msg: `${n} file${n !== 1 ? "s" : ""} extracted to ${dir}` });
    } catch (e) {
      setStatus({ ok: false, msg: String(e) });
    } finally {
      setExtracting(false);
    }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => toggleSort(k)} className="flex items-center gap-0.5 hover:text-text-primary transition-colors">
      {label}
      {sortKey === k && (sortAsc ? <ChevronUp size={9} /> : <ChevronDown size={9} />)}
    </button>
  );

  return (
    <div className="canvas">
      {/* archive info strip */}
      <div
        className="px-10 py-3 border-b border-border/60 shrink-0 cursor-pointer select-none"
        onClick={() => setShowInfo(!showInfo)}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={13} className="text-accent shrink-0" />
          <span className="text-xs font-medium text-text-secondary flex-1 font-mono">{info.archive_name}</span>
          <span className="text-2xs text-text-muted">
            {info.file_count} files · {formatBytes(info.total_original_size)}
          </span>
          {showInfo ? <ChevronUp size={11} className="text-text-muted" /> : <ChevronDown size={11} className="text-text-muted" />}
        </div>
        {showInfo && (
          <div className="mt-2 flex gap-6 text-2xs text-text-muted animate-fade-in">
            <span>Created {formatDate(info.created_at)}</span>
            <span>Compression {info.compression}</span>
            <span>Archived {formatBytes(info.total_compressed_size)}</span>
          </div>
        )}
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-3 px-10 py-2 border-b border-border/40 shrink-0">
        <input
          type="text"
          className="input-box py-1 px-2 text-xs w-44"
          placeholder="Filter…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="text-2xs text-text-muted">
          {filtered.length !== info.file_count ? `${filtered.length} of ` : ""}{info.file_count}
        </span>
        <span className="text-2xs text-text-muted flex gap-3 ml-2">
          <SortBtn k="name" label="Name" />
          <SortBtn k="size" label="Size" />
          <SortBtn k="date" label="Date" />
        </span>
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={() => handleExtract(false)} disabled={extracting} className="btn-secondary text-xs py-1 px-3 gap-1">
              <ArrowDownToLine size={12} /> {selected.size}
            </button>
          )}
          <button onClick={() => handleExtract(true)} disabled={extracting} className="btn-primary text-xs py-1 px-3 gap-1">
            {extracting
              ? <><Loader2 size={12} className="animate-spin" /> …</>
              : <><ArrowDownToLine size={12} /> Extract all</>}
          </button>
        </div>
      </div>

      {/* file table */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-10 py-1">
          {/* select all row */}
          <div className="file-row">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3 h-3 accent-accent" />
            <span className="text-2xs text-text-muted flex-1">Select all</span>
          </div>
          {filtered.map(entry => {
            const name   = basename(entry.path);
            const dir    = looksDir(entry);
            const checked = selected.has(entry.path);
            return (
              <div
                key={entry.path}
                className={`file-row cursor-pointer ${checked ? "opacity-100" : ""}`}
                onClick={() => toggle(entry.path)}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(entry.path)}
                  onClick={e => e.stopPropagation()}
                  className="w-3 h-3 accent-accent shrink-0"
                />
                {dir
                  ? <Folder size={13} className="text-accent/50 shrink-0" />
                  : <File   size={13} className="text-text-muted shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-text-secondary truncate">{name}</div>
                  <div className="text-2xs text-text-muted truncate leading-tight">{entry.path}</div>
                </div>
                <span className="font-mono text-2xs text-text-muted shrink-0 tabular-nums">
                  {dir ? "—" : formatBytes(entry.original_size)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* status strip */}
      {status && (
        <div className={`px-10 py-2 border-t border-border/60 text-2xs flex items-center gap-2 shrink-0 ${
          status.ok ? "text-accent" : "text-danger-text"
        }`}>
          <span className="flex-1 truncate">{status.msg}</span>
          <button onClick={() => setStatus(null)} className="text-text-muted hover:text-text-secondary">
            <X size={12} />
          </button>
        </div>
      )}

      <div className="bottom-bar">
        <button onClick={onClose} className="btn-ghost text-text-muted text-xs">
          Close
        </button>
      </div>
    </div>
  );
}
