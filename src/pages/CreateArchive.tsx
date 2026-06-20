import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { Archive, Eye, EyeOff, Loader2, Folder, File, X, Plus, FolderOpen } from "lucide-react";

import PasswordStrength from "../components/PasswordStrength";
import SecurityReport from "../components/SecurityReport";
import type { CreateArchiveResponse, PasswordStrengthResult, CompressionLevel, ProgressEvent } from "../types";

interface CreateArchiveProps {
  onBack: () => void;
  initialFiles?: string[];
  onNavigateWithFiles?: (files: string[]) => void;
}

const COMPRESSION_OPTS: { level: CompressionLevel; label: string; desc: string }[] = [
  { level: "Fast", label: "Fast", desc: "Speed priority" },
  { level: "Balanced", label: "Balanced", desc: "Recommended" },
  { level: "Maximum", label: "Maximum", desc: "Smallest output" },
];

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}
function isDir(path: string): boolean {
  const last = basename(path);
  return !last.includes(".");
}

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

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canCreate =
    files.length > 0 &&
    archiveName.trim().length > 0 &&
    password.length > 0 &&
    password === confirmPassword &&
    !isCreating;

  const addPaths = useCallback((paths: string[]) => {
    setFiles((prev) => [...prev, ...paths.filter((p) => !prev.includes(p))]);
  }, []);

  const handleAddFiles = async () => {
    const selected = await open({ multiple: true, directory: false });
    if (!selected) return;
    addPaths(Array.isArray(selected) ? selected : [selected]);
  };

  const handleAddFolder = async () => {
    const selected = await open({ multiple: false, directory: true });
    if (!selected) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (path) addPaths([path]);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const paths: string[] = [];
    for (const item of Array.from(e.dataTransfer.files)) {
      if ((item as unknown as { path?: string }).path) {
        paths.push((item as unknown as { path: string }).path);
      }
    }
    if (paths.length > 0) addPaths(paths);
  };

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
    <div
      className="flex h-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm border-2 border-dashed border-accent/50 pointer-events-none animate-fade-in">
          <div className="text-center">
            <Archive size={32} className="text-accent mx-auto mb-2" />
            <p className="text-sm font-medium text-text-primary">Drop to add to archive</p>
          </div>
        </div>
      )}

      {/* Left: files + settings */}
      <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
        {/* Page header */}
        <div className="px-6 py-4 border-b border-border bg-bg-surface shrink-0">
          <h1 className="text-base font-semibold text-text-primary">New Archive</h1>
          <p className="text-2xs text-text-muted mt-0.5">Add files, set a password, and create an encrypted .andrii archive</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Archive name */}
          <div>
            <label className="field-label">Archive Name</label>
            <input
              type="text"
              className="input-field"
              placeholder="my-backup"
              value={archiveName}
              onChange={(e) => setArchiveName(e.target.value)}
            />
          </div>

          {/* Files section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="field-label mb-0">Files & Folders</label>
              {files.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  className="text-2xs text-text-muted hover:text-danger transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* File table */}
            {files.length > 0 ? (
              <div className="border border-border rounded-md overflow-hidden mb-2">
                <table className="file-table">
                  <thead>
                    <tr>
                      <th className="w-6 pr-0"></th>
                      <th>Name</th>
                      <th className="w-16 text-right">Type</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((path) => {
                      const name = basename(path);
                      const dir = isDir(path);
                      return (
                        <tr key={path} className="group">
                          <td className="pl-3 pr-0">
                            {dir
                              ? <Folder size={13} className="text-accent/70" />
                              : <File size={13} className="text-text-muted" />}
                          </td>
                          <td className="font-mono text-xs truncate max-w-[240px]" title={path}>{name}</td>
                          <td className="text-right text-text-muted text-2xs pr-2">{dir ? "Folder" : "File"}</td>
                          <td className="pr-2">
                            <button
                              type="button"
                              onClick={() => setFiles(files.filter((f) => f !== path))}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-danger-muted text-text-muted hover:text-danger transition-all"
                            >
                              <X size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-md py-8 text-center mb-2">
                <p className="text-sm text-text-muted">No files added yet</p>
                <p className="text-2xs text-text-muted mt-1">Drag files here or use the buttons below</p>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={handleAddFiles} className="btn-secondary text-xs py-1.5 px-3 gap-1">
                <Plus size={12} /> Add Files
              </button>
              <button type="button" onClick={handleAddFolder} className="btn-secondary text-xs py-1.5 px-3 gap-1">
                <FolderOpen size={12} /> Add Folder
              </button>
              {files.length > 0 && (
                <span className="ml-auto text-2xs text-text-muted self-center">
                  {files.length} item{files.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Compression */}
          <div>
            <label className="field-label">Compression</label>
            <div className="flex gap-1.5">
              {COMPRESSION_OPTS.map(({ level, label, desc }) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setCompression(level)}
                  className={`flex-1 py-2 px-3 rounded-md border text-left transition-colors duration-100 ${
                    compression === level
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-border bg-bg-surface text-text-secondary hover:bg-bg-elevated"
                  }`}
                >
                  <div className="text-xs font-medium">{label}</div>
                  <div className="text-2xs opacity-70 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: password + create */}
      <div className="w-64 flex flex-col bg-bg-surface shrink-0">
        <div className="px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">Password</h2>
          <p className="text-2xs text-text-muted mt-0.5">Required to open the archive</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Password field */}
          <div>
            <label className="field-label">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="input-field pr-9"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <PasswordStrength password={password} onResult={setPasswordAnalysis} />
          </div>

          {/* Confirm */}
          <div>
            <label className="field-label">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              className={`input-field ${passwordMismatch ? "border-danger focus:border-danger focus:ring-danger/20" : ""}`}
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {passwordMismatch && (
              <p className="text-2xs text-danger-text mt-1">Passwords do not match</p>
            )}
          </div>

          {/* Summary */}
          {files.length > 0 && (
            <div className="text-2xs text-text-muted space-y-1 pt-1 border-t border-border">
              <div className="flex justify-between">
                <span>Items</span><span className="text-text-secondary font-medium">{files.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Compression</span><span className="text-text-secondary font-medium">{compression}</span>
              </div>
              <div className="flex justify-between">
                <span>Protection</span><span className="text-success-text font-medium">End-to-end</span>
              </div>
            </div>
          )}

          {/* Progress */}
          {isCreating && progress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-2xs text-text-muted">
                <span>Encrypting…</span>
                <span className="font-mono">{progress.current}/{progress.total}</span>
              </div>
              <div className="h-1 bg-bg-base rounded-full overflow-hidden border border-border">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-200"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-2xs text-text-muted truncate">{progress.current_file}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-md bg-danger-muted border border-danger/20">
              <p className="text-2xs text-danger-text leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-5 py-4 border-t border-border space-y-2 shrink-0">
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="btn-primary w-full text-sm"
          >
            {isCreating ? (
              <><Loader2 size={14} className="animate-spin" /> Creating…</>
            ) : (
              <><Archive size={14} /> Create .andrii Archive</>
            )}
          </button>
          <button onClick={onBack} className="btn-ghost w-full text-xs text-text-muted">
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
