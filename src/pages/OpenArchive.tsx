import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen, Eye, EyeOff, Loader2, FileDown, Download,
  CheckCircle2, File, Calendar, Layers,
} from "lucide-react";

import type { OpenArchiveResponse, ArchiveFileEntry } from "../types";

interface OpenArchiveProps {
  onBack: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function OpenArchive({ onBack }: OpenArchiveProps) {
  const [archivePath, setArchivePath] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isOpening, setIsOpening] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveInfo, setArchiveInfo] = useState<OpenArchiveResponse | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);

  const handleBrowse = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "ANDRII Archive", extensions: ["andrii"] }],
    });
    if (!selected) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (path) {
      setArchivePath(path);
      setArchiveInfo(null);
      setError(null);
      setExtractSuccess(null);
      setSelectedFiles(new Set());
    }
  };

  const handleOpen = async () => {
    if (!archivePath || !password) return;
    setIsOpening(true);
    setError(null);
    setArchiveInfo(null);
    setExtractSuccess(null);
    try {
      const info = await invoke<OpenArchiveResponse>("open_archive", {
        request: { archive_path: archivePath, password },
      });
      setArchiveInfo(info);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsOpening(false);
    }
  };

  const toggleFile = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectAll = () => {
    if (!archiveInfo) return;
    setSelectedFiles(new Set(archiveInfo.entries.map((e) => e.path)));
  };

  const handleExtract = async (extractAll: boolean) => {
    if (!archiveInfo) return;
    const outputDir = await open({ multiple: false, directory: true });
    if (!outputDir) return;
    const dir = Array.isArray(outputDir) ? outputDir[0] : outputDir;
    if (!dir) return;

    setIsExtracting(true);
    setError(null);
    setExtractSuccess(null);
    try {
      const selectedList = extractAll ? null : [...selectedFiles];
      await invoke("extract_archive", {
        request: {
          archive_path: archivePath,
          password,
          output_dir: dir,
          selected_files: selectedList,
        },
      });
      const count = extractAll ? archiveInfo.file_count : selectedFiles.size;
      setExtractSuccess(`Successfully extracted ${count} file${count !== 1 ? "s" : ""} to ${dir}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsExtracting(false);
    }
  };

  const canOpen = archivePath.length > 0 && password.length > 0 && !isOpening;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: open controls */}
      <div className="w-80 flex flex-col px-7 py-6 border-r border-border/50 overflow-y-auto shrink-0">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-bg-elevated border border-border flex items-center justify-center">
            <FolderOpen size={18} className="text-text-secondary" />
          </div>
          <div>
            <h2 className="section-title">Open Archive</h2>
            <p className="text-2xs text-text-muted mt-0.5">Decrypt and extract files</p>
          </div>
        </div>

        {/* Archive file */}
        <div className="mb-5">
          <label className="label">Archive File</label>
          <div className="flex gap-2">
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
        </div>

        {/* Password */}
        <div className="mb-5">
          <label className="label">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="input-field pr-10"
              placeholder="Archive password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleOpen()}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-3 py-3 rounded-lg bg-danger-muted border border-danger/20">
            <p className="text-2xs text-danger-text leading-relaxed">{error}</p>
          </div>
        )}

        {/* Success */}
        {extractSuccess && (
          <div className="mb-4 px-3 py-3 rounded-lg bg-success-muted border border-success/20">
            <div className="flex gap-2">
              <CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" />
              <p className="text-2xs text-success-text leading-relaxed">{extractSuccess}</p>
            </div>
          </div>
        )}

        <div className="mt-auto pt-5 space-y-2 border-t border-border/40">
          <button
            onClick={handleOpen}
            disabled={!canOpen}
            className="btn-primary w-full justify-center"
          >
            {isOpening ? (
              <><Loader2 size={15} className="animate-spin" />Decrypting…</>
            ) : (
              <><FolderOpen size={15} />Open Archive</>
            )}
          </button>
          <button onClick={onBack} className="btn-secondary w-full justify-center text-xs">
            Cancel
          </button>
        </div>
      </div>

      {/* Right: file list */}
      <div className="flex-1 flex flex-col px-8 py-6 overflow-hidden">
        {!archiveInfo ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center mb-4">
              <FileDown size={28} className="text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary mb-1">No archive open</p>
            <p className="text-2xs text-text-muted">Select a .andrii file and enter the password</p>
          </div>
        ) : (
          <>
            {/* Archive metadata */}
            <div className="mb-5 px-4 py-3.5 rounded-xl bg-bg-surface border border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{archiveInfo.archive_name}</h3>
                  <p className="text-2xs text-text-muted mt-0.5">{archiveInfo.creator_version}</p>
                </div>
                <span className="badge badge-success">Decrypted</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <MetaStat icon={File} label="Files" value={String(archiveInfo.file_count)} />
                <MetaStat icon={Layers} label="Original" value={formatBytes(archiveInfo.total_original_size)} />
                <MetaStat icon={Download} label="Compressed" value={formatBytes(archiveInfo.total_compressed_size)} />
                <MetaStat icon={Calendar} label="Created" value={formatDate(archiveInfo.created_at)} />
              </div>
            </div>

            {/* File list header */}
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-medium text-text-secondary">
                {archiveInfo.entries.length} files
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={selectAll}
                  className="text-2xs text-accent hover:text-accent-hover transition-colors"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelectedFiles(new Set())}
                  className="text-2xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {archiveInfo.entries.map((entry) => (
                <FileRow
                  key={entry.path}
                  entry={entry}
                  selected={selectedFiles.has(entry.path)}
                  onToggle={toggleFile}
                />
              ))}
            </div>

            {/* Extract buttons */}
            <div className="pt-4 border-t border-border/40 mt-4 flex gap-2">
              <button
                onClick={() => handleExtract(false)}
                disabled={selectedFiles.size === 0 || isExtracting}
                className="btn-secondary flex-1 justify-center text-xs"
              >
                {isExtracting ? (
                  <><Loader2 size={13} className="animate-spin" />Extracting…</>
                ) : (
                  <><Download size={13} />Extract Selected ({selectedFiles.size})</>
                )}
              </button>
              <button
                onClick={() => handleExtract(true)}
                disabled={isExtracting}
                className="btn-primary flex-1 justify-center text-xs"
              >
                {isExtracting ? (
                  <><Loader2 size={13} className="animate-spin" />Extracting…</>
                ) : (
                  <><Download size={13} />Extract All</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetaStat({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ size?: number | string; className?: string }>; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <Icon size={11} className="text-text-muted" />
        <span className="text-2xs text-text-muted">{label}</span>
      </div>
      <span className="text-xs font-medium text-text-primary">{value}</span>
    </div>
  );
}

function FileRow({
  entry, selected, onToggle,
}: { entry: ArchiveFileEntry; selected: boolean; onToggle: (p: string) => void }) {
  const name = entry.path.split("/").pop() ?? entry.path;
  const dir = entry.path.includes("/")
    ? entry.path.substring(0, entry.path.lastIndexOf("/"))
    : "";
  const ratio = entry.compression_ratio;

  return (
    <button
      type="button"
      onClick={() => onToggle(entry.path)}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left
        transition-all duration-150
        ${selected
          ? "bg-accent/8 border-accent/25"
          : "bg-bg-surface border-border/60 hover:bg-bg-elevated hover:border-border"
        }
      `}
    >
      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
        selected ? "bg-accent border-accent" : "border-border"
      }`}>
        {selected && <CheckCircle2 size={11} className="text-white" />}
      </div>
      <File size={13} className="text-text-muted shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">{name}</p>
        {dir && <p className="text-2xs text-text-muted truncate">{dir}/</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-2xs font-mono text-text-secondary">{formatBytes(entry.original_size)}</p>
        {ratio > 0.01 && (
          <p className="text-2xs text-success-text">-{(ratio * 100).toFixed(0)}%</p>
        )}
      </div>
    </button>
  );
}
