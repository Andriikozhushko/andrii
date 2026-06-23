import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { stat } from "@tauri-apps/plugin-fs";
import { Eye, EyeOff } from "lucide-react";
import PasswordStrength from "../components/PasswordStrength";
import PasswordGenerator from "../components/PasswordGenerator";
import Vault from "../components/Vault";
import FileTable, { type FileItem } from "../components/FileTable";
import ArchiveProgress from "../components/ArchiveProgress";
import { Keyhole, InkAddFiles, InkFolder, InkStamp, InkQuill } from "../components/art";
import sealAction from "../assets/seal-action.png";
import { useT } from "../i18n";
import { mapError } from "../lib/errors";
import type {
  CreateArchiveResponse, PasswordStrengthResult, CompressionLevel, ProgressEvent,
} from "../types";

interface CreateArchiveProps {
  files: string[];
  isDragging: boolean;
  onFilesChange: (files: string[]) => void;
  onCreated: (result: CreateArchiveResponse, analysis: PasswordStrengthResult | null, compression: CompressionLevel, durationMs: number) => void;
  onClear: () => void;
}

function formatBytes(b: number): string {
  if (b < 1024)       return `${b} B`;
  if (b < 1048576)    return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}
function basename(p: string) { return p.replace(/\\/g, "/").split("/").pop() ?? p; }

interface FileMeta { size: number; isDir: boolean; }

export default function CreateArchive({
  files, isDragging, onFilesChange, onCreated, onClear,
}: CreateArchiveProps) {
  const t = useT();
  const [step, setStep]           = useState<"files" | "config">("files");
  const [name, setName]           = useState("");
  const [password, setPassword]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showGen, setShowGen]     = useState(false);
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

  // Live progress while sealing.
  useEffect(() => {
    if (!creating) return;
    let un: (() => void) | undefined;
    listen<ProgressEvent>("archive-progress", e => setProgress(e.payload)).then(f => { un = f; });
    return () => { un?.(); };
  }, [creating]);

  const handleSeal = async () => {
    if (!canSeal) return;
    const outputPath = await save({
      defaultPath: `${name.trim()}.andrii`,
      filters: [{ name: "ANDRII Archive", extensions: ["andrii"] }],
    });
    if (!outputPath) return;

    setCreating(true);
    setProgress(null);
    setError(null);
    const start = Date.now();
    try {
      const res = await invoke<CreateArchiveResponse>("create_archive", {
        request: { file_paths: files, output_path: outputPath, archive_name: name.trim(), password, compression },
      });
      onCreated(res, analysis, compression, Date.now() - start);
    } catch (e) {
      setError(mapError(String(e), t));
      setCreating(false);
    }
  };

  /* ── Sealing — one calm, real progress bar ── */
  if (creating) {
    return <ArchiveProgress progress={progress} />;
  }

  /* ── Configuration — name the vault, set the key ── */
  if (step === "config") {
    return (
      <div className="canvas animate-fade-in">
        <div className="canvas-center px-10 gap-6">
          <Vault state="sealed" size={156} src={sealAction} />
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[12px] font-semibold text-ink-soft">{t("create.password")}</label>
                <button type="button" onClick={() => setShowGen(v => !v)}
                  className="text-[12px] text-accent-text hover:underline">
                  {t("generator.title")}
                </button>
              </div>
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
              {showGen && (
                <div className="mt-2.5">
                  <PasswordGenerator onUse={pw => { setPassword(pw); setShowGen(false); setShowPw(true); }} />
                </div>
              )}
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

  /* ── Files gathered in the vault — same browser UI as Open ── */
  const items: FileItem[] = files.map(path => ({
    key: path,
    name: basename(path),
    sub: path,
    size: fileMetas[path]?.size ?? 0,
    isDir: fileMetas[path]?.isDir ?? false,
  }));

  return (
    <div className={`canvas animate-fade-in ${isDragging ? "ring-2 ring-inset ring-accent/40" : ""}`}>
      {/* header — small vault + tally + add actions (mirrors the Open details bar) */}
      <div className="flex items-center gap-3 px-8 py-3 border-b border-border shrink-0">
        <span className="shrink-0"><Vault state="filling" size={42} /></span>
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-[20px] font-semibold tracking-tight text-ink leading-tight">
            {t("create.ready", { count: files.length, files: fileWord })}
            {totalSize > 0 && <span className="text-ink-faint font-sans font-normal text-[16px]"> · {formatBytes(totalSize)}</span>}
          </h2>
          <p className="text-[12px] text-ink-soft truncate">{t("create.intent")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={addFiles} className="btn-ghost text-xs"><InkAddFiles size={14} /> {t("create.addFiles")}</button>
          <button onClick={addFolder} className="btn-ghost text-xs"><InkFolder size={14} /> {t("create.addFolder")}</button>
        </div>
      </div>

      <FileTable items={items} onRemove={removeFile} />

      <div className="bottom-bar">
        <button onClick={onClear} className="btn-ghost text-sm">{t("common.clear")}</button>
        <button onClick={() => setStep("config")} disabled={files.length === 0} className="btn-primary">{t("create.continue")} →</button>
      </div>
    </div>
  );
}
