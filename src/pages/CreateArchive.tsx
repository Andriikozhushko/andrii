import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import {
  Archive, Eye, EyeOff, Zap, Scale, Mountain, Loader2,
} from "lucide-react";

import FileDropzone from "../components/FileDropzone";
import PasswordStrength from "../components/PasswordStrength";
import SecurityReport from "../components/SecurityReport";
import type {
  CreateArchiveResponse, PasswordStrengthResult, CompressionLevel, ProgressEvent,
} from "../types";

interface CreateArchiveProps {
  onBack: () => void;
  initialFiles?: string[];
}

const COMPRESSION_OPTIONS: {
  level: CompressionLevel;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  desc: string;
}[] = [
  { level: "Fast", icon: Zap, label: "Fast", desc: "Speed priority" },
  { level: "Balanced", icon: Scale, label: "Balanced", desc: "Best overall" },
  { level: "Maximum", icon: Mountain, label: "Maximum", desc: "Smallest size" },
];

export default function CreateArchive({ onBack, initialFiles = [] }: CreateArchiveProps) {
  const [files, setFiles] = useState<string[]>(initialFiles);
  const [archiveName, setArchiveName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [compression, setCompression] = useState<CompressionLevel>("Balanced");
  const [passwordAnalysis, setPasswordAnalysis] = useState<PasswordStrengthResult | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateArchiveResponse | null>(null);

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canCreate =
    files.length > 0 &&
    archiveName.trim().length > 0 &&
    password.length > 0 &&
    password === confirmPassword &&
    !isCreating;

  const handleCreate = async () => {
    if (!canCreate) return;

    const outputPath = await save({
      defaultPath: `${archiveName.trim()}.andrii`,
      filters: [{ name: "ANDRII Archive", extensions: ["andrii"] }],
    });

    if (!outputPath) return;

    setIsCreating(true);
    setError(null);
    setProgress(null);

    const unlisten = await listen<ProgressEvent>("archive-progress", (e) => {
      setProgress(e.payload);
    });

    try {
      const res = await invoke<CreateArchiveResponse>("create_archive", {
        request: {
          file_paths: files,
          output_path: outputPath,
          archive_name: archiveName.trim(),
          password,
          compression,
        },
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsCreating(false);
      setProgress(null);
      unlisten();
    }
  };

  const handleReset = () => {
    setFiles([]);
    setArchiveName("");
    setPassword("");
    setConfirmPassword("");
    setCompression("Balanced");
    setResult(null);
    setError(null);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: file selection */}
      <div className="flex-1 flex flex-col px-8 py-6 border-r border-border/50 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Archive size={18} className="text-accent" />
          </div>
          <div>
            <h2 className="section-title">Create Archive</h2>
            <p className="text-2xs text-text-muted mt-0.5">Add files and set encryption options</p>
          </div>
        </div>

        {/* Archive name */}
        <div className="mb-5">
          <label className="label">Archive Name</label>
          <input
            type="text"
            className="input-field"
            placeholder="my-backup"
            value={archiveName}
            onChange={(e) => setArchiveName(e.target.value)}
          />
        </div>

        {/* File dropzone */}
        <div className="mb-5">
          <label className="label">Files & Folders</label>
          <FileDropzone files={files} onFilesChange={setFiles} />
        </div>

        {/* Compression */}
        <div>
          <label className="label">Compression Profile</label>
          <div className="grid grid-cols-3 gap-2">
            {COMPRESSION_OPTIONS.map(({ level, icon: Icon, label, desc }) => (
              <button
                key={level}
                type="button"
                onClick={() => setCompression(level)}
                className={`
                  flex flex-col items-center gap-1.5 py-3 px-3 rounded-lg border text-center
                  transition-all duration-150
                  ${compression === level
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-bg-base border-border text-text-muted hover:border-border-strong hover:text-text-secondary"
                  }
                `}
              >
                <Icon size={16} />
                <span className="text-xs font-medium">{label}</span>
                <span className="text-2xs opacity-70">{desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel: password & create */}
      <div className="w-80 flex flex-col px-7 py-6 overflow-y-auto shrink-0">
        <div className="flex-1 space-y-5">
          {/* Password */}
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="input-field pr-10"
                placeholder="Enter strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <PasswordStrength password={password} onResult={setPasswordAnalysis} />
          </div>

          {/* Confirm password */}
          <div>
            <label className="label">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              className={`input-field ${passwordMismatch ? "border-danger focus:border-danger focus:ring-danger/30" : ""}`}
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {passwordMismatch && (
              <p className="text-2xs text-danger-text mt-1.5">Passwords do not match</p>
            )}
          </div>

          {/* Summary */}
          {files.length > 0 && (
            <div className="px-3 py-3 rounded-lg bg-bg-base border border-border/60 space-y-1">
              <div className="flex justify-between">
                <span className="text-2xs text-text-muted">Files</span>
                <span className="text-2xs text-text-secondary font-medium">{files.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-2xs text-text-muted">Compression</span>
                <span className="text-2xs text-text-secondary font-medium">{compression}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-2xs text-text-muted">Protection</span>
                <span className="text-2xs text-success-text font-medium">End-to-end encrypted</span>
              </div>
            </div>
          )}

          {/* Progress */}
          {isCreating && progress && (
            <div className="px-3 py-3 rounded-lg bg-accent/5 border border-accent/15 space-y-2">
              <div className="flex items-center justify-between text-2xs">
                <span className="text-text-muted">Encrypting</span>
                <span className="text-accent font-mono">
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="h-1 bg-bg-base rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-2xs text-text-muted truncate">{progress.current_file}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-3 rounded-lg bg-danger-muted border border-danger/20">
              <p className="text-2xs text-danger-text leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="pt-5 space-y-2 border-t border-border/40 mt-5">
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="btn-primary w-full justify-center"
          >
            {isCreating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Creating Archive…
              </>
            ) : (
              <>
                <Archive size={15} />
                Create Archive
              </>
            )}
          </button>
          <button onClick={onBack} className="btn-secondary w-full justify-center text-xs">
            {isCreating ? "Cancel" : "Back"}
          </button>
        </div>
      </div>

      {/* Security report modal */}
      {result && (
        <SecurityReport
          result={result}
          password={passwordAnalysis}
          compressionLabel={compression}
          onClose={handleReset}
        />
      )}
    </div>
  );
}
