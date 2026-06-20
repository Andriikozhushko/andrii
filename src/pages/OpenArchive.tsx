import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen, Eye, EyeOff, Loader2, File, Folder,
  ArrowDownToLine, ShieldCheck, ChevronDown, ChevronUp, X,
} from "lucide-react";
import type { OpenArchiveResponse, ArchiveFileEntry } from "../types";

interface OpenArchiveProps {
  onBack: () => void;
  initialPath?: string;
  onClearInitialPath?: () => void;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function formatDate(epoch: number): string {
  if (!epoch) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(epoch * 1000));
}
function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}
function looksLikeDir(entry: ArchiveFileEntry): boolean {
  return entry.original_size === 0 && !basename(entry.path).includes(".");
}
function humanizeError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("invalid password") || s.includes("invalidpassword")) return "Incorrect password. Please try again.";
  if (s.includes("corrupt") || s.includes("tamper") || s.includes("authentication")) return "This archive appears to be corrupted or tampered with.";
  if (s.includes("no such file") || s.includes("not found") || s.includes("os error 2")) return "Archive file not found. It may have been moved or deleted.";
  if (s.includes("magic") || s.includes("invalidmagic")) return "This file is not a valid ANDRII archive.";
  return "Failed to open archive. Check the file and password, then try again.";
}

type SortKey = "name" | "size" | "date";

export default function OpenArchive({ initialPath, onClearInitialPath }: OpenArchiveProps) {
  const [archivePath, setArchivePath] = useState(initialPath ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveInfo, setArchiveInfo] = useState<OpenArchiveResponse | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(true);

  useEffect(() => {
    if (initialPath) {
      setArchivePath(initialPath);
      onClearInitialPath?.();
    }
  }, [initialPath]);

  const handleBrowse = async () => {
    const picked = await open({
      multiple: false,
      filters: [{ name: "ANDRII Archive", extensions: ["andrii"] }],
    });
    if (!picked) return;
    const p = Array.isArray(picked) ? picked[0] : picked;
    if (p) {
      setArchivePath(p);
      setArchiveInfo(null);
      setError(null);
      setPassword("");
      setSelected(new Set());
      setExtractSuccess(null);
      setExtractError(null);
    }
  };

  const handleOpen = async () => {
    if (!archivePath || !password) return;
    setIsLoading(true);
    setError(null);
    setArchiveInfo(null);
    setSelected(new Set());
    setExtractSuccess(null);
    setExtractError(null);
    try {
      const info = await invoke<OpenArchiveResponse>("open_archive", {
        request: { archive_path: archivePath, password },
      });
      setArchiveInfo(info);
      setShowSummary(true);
    } catch (e) {
      setError(humanizeError(String(e)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtract = async (extractAll: boolean) => {
    if (!archiveInfo) return;
    const outputDir = await open({ multiple: false, directory: true });
    if (!outputDir) return;
    const dir = Array.isArray(outputDir) ? outputDir[0] : outputDir;
    if (!dir) return;

    const paths = extractAll ? null : [...selected];
    setIsExtracting(true);
    setExtractError(null);
    setExtractSuccess(null);
    try {
      await invoke("extract_archive", {
        request: {
          archive_path: archivePath,
          password,
          output_dir: dir,
          selected_files: paths,
        },
      });
      const count = extractAll ? archiveInfo.file_count : selected.size;
      setExtractSuccess(`${count} file${count !== 1 ? "s" : ""} extracted to ${dir}`);
    } catch (e) {
      setExtractError(humanizeError(String(e)));
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const filteredEntries: ArchiveFileEntry[] = archiveInfo
    ? [...archiveInfo.entries]
        .filter((e) => basename(e.path).toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
          let cmp = 0;
          if (sortKey === "name") cmp = basename(a.path).localeCompare(basename(b.path));
          else if (sortKey === "size") cmp = a.original_size - b.original_size;
          else if (sortKey === "date") cmp = a.modified_at - b.modified_at;
          return sortAsc ? cmp : -cmp;
        })
    : [];

  const toggleSelect = (path: string) => {
    const next = new Set(selected);
    next.has(path) ? next.delete(path) : next.add(path);
    setSelected(next);
  };
  const allSelected = filteredEntries.length > 0 && selected.size === filteredEntries.length;
  const toggleSelectAll = () => {
    allSelected ? setSelected(new Set()) : setSelected(new Set(filteredEntries.map((e) => e.path)));
  };

  const SortTh = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={right ? "text-right" : ""}>
      <button type="button" onClick={() => toggleSort(k)} className={`flex items-center gap-1 hover:text-text-primary ${right ? "ml-auto" : ""}`}>
        {label}
        {sortKey === k && (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-border bg-bg-surface shrink-0">
        <h1 className="text-base font-semibold text-text-primary">Open Archive</h1>
        <p className="text-2xs text-text-muted mt-0.5">Select an .andrii archive and enter its password to view and extract files</p>
      </div>

      {/* Controls */}
      <div className="px-6 py-4 border-b border-border bg-bg-surface shrink-0">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="field-label">Archive File</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  readOnly
                  className="input-field pr-3 cursor-pointer font-mono text-xs"
                  placeholder="Click Browse or drag an .andrii file here"
                  value={archivePath}
                  onClick={handleBrowse}
                />
                {archivePath && (
                  <button
                    type="button"
                    onClick={() => { setArchivePath(""); setArchiveInfo(null); setError(null); setPassword(""); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-danger"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <button onClick={handleBrowse} className="btn-secondary text-xs px-3 py-1.5 gap-1 shrink-0">
                <FolderOpen size={13} /> Browse
              </button>
            </div>
          </div>

          <div className="w-52">
            <label className="field-label">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="input-field pr-8"
                placeholder="Archive password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleOpen()}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          <button
            onClick={handleOpen}
            disabled={!archivePath || !password || isLoading}
            className="btn-primary text-xs px-4 py-[7px] gap-1.5 shrink-0"
          >
            {isLoading
              ? <><Loader2 size={13} className="animate-spin" /> Opening…</>
              : "Unlock"}
          </button>
        </div>

        {error && (
          <div className="mt-3 px-3 py-2 rounded-md bg-danger-muted border border-danger/20">
            <p className="text-2xs text-danger-text">{error}</p>
          </div>
        )}
      </div>

      {/* Archive contents */}
      {archiveInfo ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Summary row */}
          <div className="px-6 py-2.5 border-b border-border bg-bg-surface shrink-0">
            <button
              type="button"
              className="flex items-center gap-2 w-full text-left"
              onClick={() => setShowSummary(!showSummary)}
            >
              <ShieldCheck size={13} className="text-success shrink-0" />
              <span className="text-xs font-semibold text-text-primary flex-1">{archiveInfo.archive_name}</span>
              <span className="text-2xs text-text-muted mr-2">
                {archiveInfo.file_count} items · {formatBytes(archiveInfo.total_original_size)}
              </span>
              {showSummary ? <ChevronUp size={12} className="text-text-muted" /> : <ChevronDown size={12} className="text-text-muted" />}
            </button>
            {showSummary && (
              <div className="mt-2 grid grid-cols-4 gap-4 text-2xs">
                <div><span className="text-text-muted block">Created</span><span className="text-text-secondary font-medium">{formatDate(archiveInfo.created_at)}</span></div>
                <div><span className="text-text-muted block">Compression</span><span className="text-text-secondary font-medium">{archiveInfo.compression}</span></div>
                <div><span className="text-text-muted block">Original</span><span className="text-text-secondary font-medium">{formatBytes(archiveInfo.total_original_size)}</span></div>
                <div><span className="text-text-muted block">Archived</span><span className="text-text-secondary font-medium">{formatBytes(archiveInfo.total_compressed_size)}</span></div>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="px-6 py-2 border-b border-border bg-bg-surface shrink-0 flex items-center gap-3">
            <input
              type="text"
              className="input-field py-1 px-2 text-xs w-48"
              placeholder="Search files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="text-2xs text-text-muted">
              {filteredEntries.length}{filteredEntries.length !== archiveInfo.file_count ? ` of ${archiveInfo.file_count}` : ""} files
            </span>
            <div className="ml-auto flex gap-2">
              {selected.size > 0 && (
                <button
                  onClick={() => handleExtract(false)}
                  disabled={isExtracting}
                  className="btn-secondary text-xs px-3 py-1 gap-1"
                >
                  <ArrowDownToLine size={12} />
                  Extract selected ({selected.size})
                </button>
              )}
              <button
                onClick={() => handleExtract(true)}
                disabled={isExtracting}
                className="btn-primary text-xs px-3 py-1 gap-1"
              >
                {isExtracting
                  ? <><Loader2 size={12} className="animate-spin" /> Extracting…</>
                  : <><ArrowDownToLine size={12} /> Extract All</>}
              </button>
            </div>
          </div>

          {/* File table */}
          <div className="flex-1 overflow-y-auto">
            <table className="file-table">
              <thead>
                <tr>
                  <th className="w-8 pl-4">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-3 h-3 accent-accent" />
                  </th>
                  <th className="w-8 pr-0"></th>
                  <SortTh k="name" label="Name" />
                  <SortTh k="size" label="Size" right />
                  <th className="w-20 text-right">Ratio</th>
                  <SortTh k="date" label="Modified" right />
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-2xs text-text-muted">No files match your search</td>
                  </tr>
                ) : filteredEntries.map((entry) => {
                  const name = basename(entry.path);
                  const dir = looksLikeDir(entry);
                  const checked = selected.has(entry.path);
                  const ratio = entry.original_size > 0
                    ? Math.round((1 - entry.compressed_size / entry.original_size) * 100)
                    : 0;
                  return (
                    <tr key={entry.path} className={checked ? "bg-accent-subtle" : ""}>
                      <td className="pl-4">
                        <input type="checkbox" checked={checked} onChange={() => toggleSelect(entry.path)} className="w-3 h-3 accent-accent" />
                      </td>
                      <td className="pr-0">
                        {dir ? <Folder size={13} className="text-accent/60" /> : <File size={13} className="text-text-muted" />}
                      </td>
                      <td>
                        <div className="font-mono text-xs truncate max-w-[320px]" title={entry.path}>{name}</div>
                        <div className="text-2xs text-text-muted truncate max-w-[320px] leading-tight">{entry.path}</div>
                      </td>
                      <td className="text-right font-mono text-xs text-text-secondary pr-2">
                        {dir ? "—" : formatBytes(entry.original_size)}
                      </td>
                      <td className="text-right text-2xs text-text-muted pr-2">
                        {ratio > 0 ? `${ratio}%` : "—"}
                      </td>
                      <td className="text-right text-2xs text-text-muted pr-4">{formatDate(entry.modified_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Status bar */}
          {(extractSuccess || extractError) && (
            <div className={`px-6 py-2.5 border-t border-border text-2xs flex items-center gap-2 shrink-0 ${
              extractSuccess ? "bg-success-muted text-success-text" : "bg-danger-muted text-danger-text"
            }`}>
              {extractSuccess
                ? <><ShieldCheck size={13} /> {extractSuccess}</>
                : extractError}
              <button type="button" onClick={() => { setExtractSuccess(null); setExtractError(null); }} className="ml-auto opacity-60 hover:opacity-100">
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      ) : !isLoading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          <div className="text-center">
            <FolderOpen size={28} className="mx-auto mb-3 opacity-25" />
            <p className="text-sm">No archive open</p>
            <p className="text-2xs mt-1">Browse for an .andrii file and enter its password above</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
