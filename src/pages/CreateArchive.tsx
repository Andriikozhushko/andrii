import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { stat } from "@tauri-apps/plugin-fs";
import { Eye, EyeOff, X } from "lucide-react";
import PasswordStrength from "../components/PasswordStrength";
import { ArchiveBox, InkFileGlyph, Keyhole, InkAddFiles, InkFolder, InkStamp, InkQuill } from "../components/art";
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

/** Ink tint per file type — the glyph stays a hand-drawn paper slip. */
function typeTint(path: string, isDir: boolean): string {
  if (isDir) return "#C9760E";
  const ext = basename(path).split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return "#B23A35";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "heic"].includes(ext)) return "#5B53C6";
  if (["xlsx", "xls", "csv", "ods"].includes(ext)) return "#3E7D5A";
  if (["doc", "docx", "txt", "md", "odt"].includes(ext)) return "#48409E";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) return "#C9760E";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "#EA580C";
  if (["mp3", "wav", "flac", "aac", "ogg"].includes(ext)) return "#DB2777";
  return "#5B5347";
}

interface FileMeta { size: number; isDir: boolean; }

/* ── Ink file card (paper slip) ───────────────────────────────────────────── */
function FileCard({ path, meta, onRemove }: {
  path: string; meta: FileMeta | undefined; onRemove: () => void;
}) {
  const name = basename(path);
  const isDir = meta?.isDir ?? false;
  return (
    <div className="ink-card group">
      <InkFileGlyph size={32} tint={typeTint(path, isDir)} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink truncate">{name}</p>
        <p className="text-[11px] text-ink-faint tabular-nums">
          {meta === undefined ? "…" : isDir ? "Folder" : meta.size > 0 ? formatBytes(meta.size) : "—"}
        </p>
      </div>
      <button onClick={onRemove} className="ink-card-remove" title="Remove"><X size={13} /></button>
    </div>
  );
}

/* ── Sealing (progress) ───────────────────────────────────────────────────── */
function Sealing({ progress }: { progress: ProgressEvent | null }) {
  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;
  const sealing = progress != null && progress.current >= progress.total && progress.total > 0;

  return (
    <div className="canvas">
      <div className="canvas-center px-10 gap-8 animate-fade-in">
        <div className="animate-scale-in" style={{ animationDuration: "0.5s" }}>
          <ArchiveBox variant="sealed" size={176} />
        </div>

        <div className="text-center space-y-1.5">
          <h2 className="font-serif text-[26px] font-semibold tracking-tight text-ink">
            {progress == null ? "Preparing…" : sealing ? "Pressing the seal…" : "Sealing your files…"}
          </h2>
          <p className="text-sm text-ink-faint font-mono truncate max-w-xs mx-auto">
            {progress?.current_file ? basename(progress.current_file) : " "}
          </p>
        </div>

        <div className="w-full max-w-xs space-y-2">
          <div className="h-2 rounded-full bg-surface-sunken border border-border overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-ink-faint tabular-nums">
            <span>Locking with your password</span>
            <span>{pct}%</span>
          </div>
        </div>
      </div>
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
  const totalSize = files.reduce((s, p) => s + (fileMetas[p]?.size ?? 0), 0);

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
    })).then(results => setFileMetas(prev => ({ ...prev, ...Object.fromEntries(results) })));
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

  if (creating) return <Sealing progress={progress} />;

  const fileWord = files.length === 1 ? "file" : "files";

  return (
    <div className={`canvas ${isDragging ? "ring-2 ring-inset ring-accent/40" : ""}`}>
      <div className="canvas-body px-8 py-7 space-y-7">

        {/* what you selected + intent */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[24px] font-semibold tracking-tight text-ink leading-tight">
              {files.length} {fileWord} ready
              {totalSize > 0 && <span className="text-ink-faint font-sans font-normal text-[20px]"> · {formatBytes(totalSize)}</span>}
            </h2>
            <p className="text-[13px] text-ink-soft mt-1">
              Sealed into one <span className="font-mono text-ink">.andrii</span> box only your password can open.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={addFiles} className="btn-ghost text-xs"><InkAddFiles size={14} /> Add files</button>
            <button onClick={addFolder} className="btn-ghost text-xs"><InkFolder size={14} /> Add folder</button>
          </div>
        </div>

        {/* selection — ink paper cards */}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
          {files.map(path => (
            <FileCard key={path} path={path} meta={fileMetas[path]} onRemove={() => removeFile(path)} />
          ))}
        </div>

        {/* name + password */}
        <div className="pt-1 space-y-5">
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft mb-1">
              <InkQuill size={14} /> Archive name
            </label>
            <input
              ref={nameRef}
              type="text"
              className="input"
              placeholder="My documents"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-ink-soft mb-1">Password</label>
            <div className="relative">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-70">
                <Keyhole size={18} />
              </span>
              <input
                type={showPw ? "text" : "password"}
                className="input pl-7 pr-10"
                placeholder="Set the only key to this box"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-ink-faint hover:text-ink"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="mt-2.5">
              {password
                ? <PasswordStrength password={password} onResult={setAnalysis} />
                : <p className="text-[12px] text-ink-faint leading-relaxed">We never see this key, and it can&apos;t be recovered — keep it safe.</p>}
            </div>
          </div>
        </div>

        {error && <p className="text-[13px] text-wax leading-relaxed">{error}</p>}
      </div>

      <div className="bottom-bar">
        <button onClick={onClear} className="btn-ghost text-sm">Clear</button>
        <button onClick={handleCreate} disabled={!canCreate} className="btn-primary"><InkStamp /> Seal archive</button>
      </div>
    </div>
  );
}
