import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { File, Folder, Plus, FolderOpen, Eye, EyeOff, Loader2, X } from "lucide-react";
import PasswordStrength from "../components/PasswordStrength";
import type {
  CreateArchiveResponse, PasswordStrengthResult, CompressionLevel, ProgressEvent,
} from "../types";

interface CreateArchiveProps {
  files: string[];
  onFilesChange: (files: string[]) => void;
  onCreated: (result: CreateArchiveResponse, analysis: PasswordStrengthResult | null, compression: CompressionLevel) => void;
  onClear: () => void;
}

function basename(p: string) { return p.replace(/\\/g, "/").split("/").pop() ?? p; }
function isDir(p: string)    { return !basename(p).includes("."); }

export default function CreateArchive({ files, onFilesChange, onCreated, onClear }: CreateArchiveProps) {
  const [name, setName]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [compression]         = useState<CompressionLevel>("Balanced");
  const [analysis, setAnalysis] = useState<PasswordStrengthResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const canCreate = files.length > 0 && name.trim().length > 0 && password.length > 0 && !creating;

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
    <div className="canvas">
      <div className="canvas-body px-10 pt-8 pb-0">

        {/* File list header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xs text-text-muted tabular-nums">
            {files.length} item{files.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={addFiles} className="btn-ghost text-2xs py-1 px-2 gap-1">
              <Plus size={11} /> files
            </button>
            <button onClick={addFolder} className="btn-ghost text-2xs py-1 px-2 gap-1">
              <FolderOpen size={11} /> folder
            </button>
          </div>
        </div>

        {/* File rows */}
        <div className="mb-6">
          {files.map(path => {
            const name = basename(path);
            const dir  = isDir(path);
            return (
              <div key={path} className="file-row">
                {dir
                  ? <Folder size={13} className="text-accent/50 shrink-0" />
                  : <File   size={13} className="text-text-muted shrink-0" />}
                <span className="flex-1 font-mono text-xs text-text-secondary truncate" title={path}>
                  {name}
                </span>
                <button
                  onClick={() => removeFile(path)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted hover:text-danger-text transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="divider" />

        {/* Name */}
        <input
          ref={nameRef}
          type="text"
          className="input w-full mb-5 text-base"
          placeholder="Archive name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleCreate()}
        />

        {/* Password */}
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            className="input w-full pr-8 text-base"
            placeholder="Set a password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
          >
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <PasswordStrength password={password} onResult={setAnalysis} />

        {/* Progress */}
        {creating && progress && (
          <div className="mt-5 space-y-1.5">
            <div className="flex justify-between text-2xs text-text-muted">
              <span>Encrypting…</span>
              <span className="font-mono">{progress.current}/{progress.total}</span>
            </div>
            <div className="h-px bg-border overflow-hidden rounded-full">
              <div
                className="h-full bg-accent transition-all duration-200"
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-2xs text-text-muted font-mono truncate">{progress.current_file}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 text-2xs text-danger-text leading-relaxed">{error}</div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="bottom-bar">
        <button onClick={onClear} className="btn-ghost text-text-muted text-xs">
          Clear all
        </button>
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className="btn-primary gap-2 px-6"
        >
          {creating
            ? <><Loader2 size={14} className="animate-spin" /> Encrypting…</>
            : "Encrypt and save →"}
        </button>
      </div>
    </div>
  );
}
