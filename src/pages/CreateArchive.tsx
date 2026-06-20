import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { stat } from "@tauri-apps/plugin-fs";
import {
  File, Folder, FileText, Image, Video, Music,
  Archive as ArchiveIcon, Table2,
  Eye, EyeOff, Loader2, X, Plus, FolderOpen,
  Lock, ShieldCheck, HardDrive,
} from "lucide-react";
import PasswordStrength from "../components/PasswordStrength";
import type {
  CreateArchiveResponse, PasswordStrengthResult, CompressionLevel, ProgressEvent,
} from "../types";

interface CreateArchiveProps {
  files: string[];
  isDragging: boolean;
  onFilesChange: (files: string[]) => void;
  onCreated: (result: CreateArchiveResponse, analysis: PasswordStrengthResult | null, compression: CompressionLevel) => void;
  onClear: () => void;
}

function formatBytes(b: number): string {
  if (b < 1024)       return `${b} B`;
  if (b < 1048576)    return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

function basename(p: string) { return p.replace(/\\/g, "/").split("/").pop() ?? p; }

type FileTypeInfo = { color: string; bg: string; Icon: React.ElementType };

function getTypeInfo(path: string, isDir: boolean): FileTypeInfo {
  if (isDir) return { Icon: Folder,      color: "#F59E0B", bg: "#FFFBEB" };
  const ext = basename(path).split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return { Icon: FileText,   color: "#DC2626", bg: "#FEF2F2" };
    case "jpg": case "jpeg": case "png": case "gif": case "webp": case "svg": case "heic":
      return { Icon: Image,      color: "#7C3AED", bg: "#F5F3FF" };
    case "xlsx": case "xls": case "csv": case "ods":
      return { Icon: Table2,     color: "#059669", bg: "#ECFDF5" };
    case "doc": case "docx": case "txt": case "md": case "odt":
      return { Icon: FileText,   color: "#2563EB", bg: "#EFF6FF" };
    case "zip": case "rar": case "7z": case "tar": case "gz": case "bz2":
      return { Icon: ArchiveIcon, color: "#D97706", bg: "#FFFBEB" };
    case "mp4": case "mov": case "avi": case "mkv": case "webm":
      return { Icon: Video,      color: "#EA580C", bg: "#FFF7ED" };
    case "mp3": case "wav": case "flac": case "aac": case "ogg":
      return { Icon: Music,      color: "#DB2777", bg: "#FDF2F8" };
    default:
      return { Icon: File,       color: "#6B7280", bg: "#F9FAFB" };
  }
}

interface FileMeta { size: number; isDir: boolean; }

const VALUES = [
  { Icon: Lock,       label: "End-to-end encrypted", desc: "Files encrypted individually" },
  { Icon: EyeOff,     label: "File names hidden",     desc: "Archive contents not visible" },
  { Icon: ShieldCheck, label: "Tamper detection",     desc: "BLAKE3 hash verifies every byte" },
  { Icon: HardDrive,  label: "Stays on your device",  desc: "No cloud upload, ever" },
];

/* ── File card ────────────────────────────────────────────────────────────── */
function FileCard({
  path, meta, onRemove,
}: {
  path: string;
  meta: FileMeta | undefined;
  onRemove: () => void;
}) {
  const name = basename(path);
  const isDir = meta?.isDir ?? false;
  const { Icon, color, bg } = getTypeInfo(path, isDir);

  return (
    <div className="file-card group">
      <button
        onClick={onRemove}
        className="file-card-remove"
        title="Remove"
      >
        <X size={11} />
      </button>

      <div className="file-card-icon" style={{ backgroundColor: bg }}>
        <Icon size={22} style={{ color }} strokeWidth={1.5} />
      </div>

      <p className="file-card-name">{name}</p>

      <p className="file-card-size">
        {meta === undefined
          ? "…"
          : isDir
          ? "Folder"
          : meta.size > 0
          ? formatBytes(meta.size)
          : "—"}
      </p>
    </div>
  );
}

/* ── Value strip ──────────────────────────────────────────────────────────── */
function ValueStrip() {
  return (
    <div className="value-strip">
      {VALUES.map(({ Icon, label, desc }) => (
        <div key={label} className="value-item">
          <div className="value-icon-wrap">
            <Icon size={18} className="text-accent" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-text-primary leading-tight">{label}</p>
            <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── CreateArchive ────────────────────────────────────────────────────────── */
export default function CreateArchive({
  files, isDragging, onFilesChange, onCreated, onClear,
}: CreateArchiveProps) {
  const [name, setName]           = useState("");
  const [password, setPassword]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [compression]             = useState<CompressionLevel>("Balanced");
  const [analysis, setAnalysis]   = useState<PasswordStrengthResult | null>(null);
  const [creating, setCreating]   = useState(false);
  const [progress, setProgress]   = useState<ProgressEvent | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [fileMetas, setFileMetas] = useState<Record<string, FileMeta>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  const canCreate = files.length > 0 && name.trim().length > 0 && password.length > 0 && !creating;

  // Fetch file metadata (size + isDir) for newly added files
  useEffect(() => {
    const newPaths = files.filter(p => !(p in fileMetas));
    if (!newPaths.length) return;

    Promise.all(newPaths.map(async path => {
      try {
        const m = await stat(path);
        return [path, { size: m.size, isDir: m.isDirectory }] as [string, FileMeta];
      } catch {
        return [path, { size: 0, isDir: false }] as [string, FileMeta];
      }
    })).then(results => {
      setFileMetas(prev => ({ ...prev, ...Object.fromEntries(results) }));
    });
  }, [files]);

  const addFiles = useCallback(async () => {
    const picked = await open({ multiple: true, directory: false });
    if (!picked) return;
    const paths = (Array.isArray(picked) ? picked : [picked]).filter(Boolean) as string[];
    onFilesChange([...files, ...paths.filter(p => !files.includes(p))]);
  }, [files, onFilesChange]);

  const addFolder = useCallback(async () => {
    const picked = await open({ multiple: false, directory: true });
    if (!picked) return;
    const p = Array.isArray(picked) ? picked[0] : picked;
    if (p && !files.includes(p)) onFilesChange([...files, p]);
  }, [files, onFilesChange]);

  const removeFile = useCallback((path: string) => {
    onFilesChange(files.filter(f => f !== path));
  }, [files, onFilesChange]);

  const handleCreate = async () => {
    if (!canCreate) return;
    const outputPath = await save({
      defaultPath: `${name.trim()}.andrii`,
      filters: [{ name: "ANDRII Archive", extensions: ["andrii"] }],
    });
    if (!outputPath) return;

    setCreating(true);
    setError(null);
    const unlisten = await listen<ProgressEvent>("archive-progress", e => setProgress(e.payload));
    try {
      const res = await invoke<CreateArchiveResponse>("create_archive", {
        request: { file_paths: files, output_path: outputPath, archive_name: name.trim(), password, compression },
      });
      onCreated(res, analysis, compression);
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
      setProgress(null);
      unlisten();
    }
  };

  return (
    <div className={`canvas ${isDragging ? "ring-2 ring-inset ring-accent/30" : ""}`}>
      <div className="canvas-body px-8 py-5 space-y-5">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-secondary">
            {files.length} item{files.length !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={addFiles} className="btn-ghost text-xs py-1.5 px-3 gap-1.5">
              <Plus size={12} /> Add Files
            </button>
            <button onClick={addFolder} className="btn-ghost text-xs py-1.5 px-3 gap-1.5">
              <FolderOpen size={12} /> Add Folder
            </button>
          </div>
        </div>

        {/* File cards grid */}
        <div className="grid grid-cols-4 gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}>
          {files.map(path => (
            <FileCard
              key={path}
              path={path}
              meta={fileMetas[path]}
              onRemove={() => removeFile(path)}
            />
          ))}
        </div>

        {/* Value strip */}
        <ValueStrip />

        {/* Form */}
        <div className="space-y-4 pt-1">
          <input
            ref={nameRef}
            type="text"
            className="input"
            placeholder="Archive name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
          />

          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              className="input pr-10"
              placeholder="Set a strong password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <PasswordStrength password={password} onResult={setAnalysis} />
        </div>

        {/* Progress */}
        {creating && progress && (
          <div className="space-y-2 pt-1">
            <div className="flex justify-between text-xs text-text-muted">
              <span>Encrypting…</span>
              <span className="font-mono tabular-nums">{progress.current}/{progress.total}</span>
            </div>
            <div className="h-1 bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-200 rounded-full"
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-text-muted font-mono truncate">{progress.current_file}</p>
          </div>
        )}

        {error && (
          <p className="text-xs text-danger-text leading-relaxed">{error}</p>
        )}
      </div>

      <div className="bottom-bar">
        <button onClick={onClear} className="btn-ghost text-sm text-text-muted">
          Clear all
        </button>
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className="btn-primary gap-2 text-sm"
        >
          {creating
            ? <><Loader2 size={15} className="animate-spin" /> Encrypting…</>
            : "Create encrypted archive →"}
        </button>
      </div>
    </div>
  );
}
