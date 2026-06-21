import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { stat } from "@tauri-apps/plugin-fs";
import { Eye, EyeOff, X } from "lucide-react";
import PasswordStrength from "../components/PasswordStrength";
import Vault, { VaultScene } from "../components/Vault";
import { Keyhole, InkAddFiles, InkFolder, InkStamp, InkQuill } from "../components/art";
import { useT } from "../i18n";
import { mapError } from "../lib/errors";
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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function formatBytes(b: number): string {
  if (b < 1024)       return `${b} B`;
  if (b < 1048576)    return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}
function basename(p: string) { return p.replace(/\\/g, "/").split("/").pop() ?? p; }

interface FileMeta { size: number; isDir: boolean; }

/* a quiet, secondary chip — the things gathered in the vault (not a card grid) */
function Chip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <span className="group inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full border border-border-strong bg-surface text-[12px] text-ink max-w-[200px]">
      <span className="truncate">{name}</span>
      <button onClick={onRemove} className="w-4 h-4 flex items-center justify-center rounded-full text-ink-faint hover:text-wax hover:bg-wax/10">
        <X size={11} />
      </button>
    </span>
  );
}

export default function CreateArchive({
  files, isDragging, onFilesChange, onCreated, onClear,
}: CreateArchiveProps) {
  const t = useT();
  const [step, setStep]           = useState<"files" | "config">("files");
  const [name, setName]           = useState("");
  const [password, setPassword]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [compression]             = useState<CompressionLevel>("Balanced");
  const [analysis, setAnalysis]   = useState<PasswordStrengthResult | null>(null);
  const [creating, setCreating]   = useState(false);
  const [progress, setProgress]   = useState<ProgressEvent | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [fileMetas, setFileMetas] = useState<Record<string, FileMeta>>({});

  const totalSize = files.reduce((s, p) => s + (fileMetas[p]?.size ?? 0), 0);
  const fileWord = t(files.length === 1 ? "common.file" : "common.files");
  const canSeal = name.trim().length > 0 && password.length > 0 && !creating;

  useEffect(() => { if (files.length === 0 && step === "config") setStep("files"); }, [files.length, step]);

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

  const handleSeal = async () => {
    if (!canSeal) return;
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
      await sleep(600);
      onCreated(res, analysis, compression);
    } catch (e) {
      setError(mapError(String(e), t));
      setCreating(false);
      setProgress(null);
    } finally {
      unlisten();
    }
  };

  /* ── Sealing — the vault closes; no step ladder, the object is the progress ── */
  if (creating) {
    return (
      <VaultScene
        state="sealed"
        size={176}
        title={t("create.sealing")}
        subtitle={progress?.current_file ? basename(progress.current_file) : undefined}
      />
    );
  }

  /* ── Configuration — name the vault, set the key ── */
  if (step === "config") {
    return (
      <div className="canvas animate-fade-in">
        <div className="canvas-center px-10 gap-6">
          <Vault state="filling" size={156} />
          <div className="text-center">
            <h2 className="font-serif text-[24px] font-semibold tracking-tight text-ink leading-tight">{t("create.seal")}</h2>
            <button onClick={() => setStep("files")} className="text-[13px] text-ink-faint hover:text-accent-text transition-colors mt-1">
              {t("create.ready", { count: files.length, files: fileWord })}{totalSize > 0 ? ` · ${formatBytes(totalSize)}` : ""} · {t("create.editFiles")}
            </button>
          </div>

          <div className="w-full max-w-sm space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft mb-1">
                <InkQuill size={14} /> {t("create.archiveName")}
              </label>
              <input type="text" className="input" placeholder={t("create.archiveNamePlaceholder")} autoFocus
                value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSeal()} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-ink-soft mb-1">{t("create.password")}</label>
              <div className="relative">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-70"><Keyhole size={18} /></span>
                <input type={showPw ? "text" : "password"} className="input pl-7 pr-10"
                  placeholder={t("create.passwordPlaceholder")} value={password}
                  onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSeal()}
                  autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-ink-faint hover:text-ink">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-2.5">
                {password
                  ? <PasswordStrength password={password} onResult={setAnalysis} />
                  : <p className="text-[12px] text-ink-faint leading-relaxed">{t("create.passwordHint")}</p>}
              </div>
            </div>
            {error && <p className="text-[13px] text-wax leading-relaxed">{error}</p>}
          </div>
        </div>

        <div className="bottom-bar">
          <button onClick={() => setStep("files")} className="btn-ghost text-sm">← {t("common.back")}</button>
          <button onClick={handleSeal} disabled={!canSeal} className="btn-primary"><InkStamp /> {t("create.seal")}</button>
        </div>
      </div>
    );
  }

  /* ── Files gathered in the vault ── */
  return (
    <div className={`canvas animate-fade-in ${isDragging ? "ring-2 ring-inset ring-accent/40" : ""}`}>
      <div className="canvas-center px-10 gap-6">
        <Vault state="filling" size={176} />
        <div className="text-center space-y-1">
          <h2 className="font-serif text-[24px] font-semibold tracking-tight text-ink leading-tight">
            {t("create.ready", { count: files.length, files: fileWord })}
            {totalSize > 0 && <span className="text-ink-faint font-sans font-normal text-[20px]"> · {formatBytes(totalSize)}</span>}
          </h2>
          <p className="text-[13px] text-ink-soft">{t("create.intent")}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 max-w-lg max-h-28 overflow-y-auto">
          {files.map(path => <Chip key={path} name={basename(path)} onRemove={() => removeFile(path)} />)}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={addFiles} className="btn-ghost text-xs"><InkAddFiles size={14} /> {t("create.addFiles")}</button>
          <button onClick={addFolder} className="btn-ghost text-xs"><InkFolder size={14} /> {t("create.addFolder")}</button>
        </div>
      </div>

      <div className="bottom-bar">
        <button onClick={onClear} className="btn-ghost text-sm">{t("common.clear")}</button>
        <button onClick={() => setStep("config")} disabled={files.length === 0} className="btn-primary">{t("create.continue")} →</button>
      </div>
    </div>
  );
}
