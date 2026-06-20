import { useState, useCallback, useRef } from "react";
import { Upload, FolderOpen, X, File, Folder } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

interface FileDropzoneProps {
  files: string[];
  onFilesChange: (files: string[]) => void;
}

function isDirectory(path: string): boolean {
  // Heuristic: no extension or ends with path separator
  const last = path.replace(/\\/g, "/").split("/").pop() ?? "";
  return !last.includes(".") || path.endsWith("/");
}

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}

export default function FileDropzone({ files, onFilesChange }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleBrowseFiles = async () => {
    const selected = await open({
      multiple: true,
      directory: false,
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    addPaths(paths);
  };

  const handleBrowseFolder = async () => {
    const selected = await open({
      multiple: false,
      directory: true,
    });
    if (!selected) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (path) addPaths([path]);
  };

  const addPaths = (paths: string[]) => {
    const newPaths = paths.filter((p) => !files.includes(p));
    if (newPaths.length > 0) {
      onFilesChange([...files, ...newPaths]);
    }
  };

  const removePath = (path: string) => {
    onFilesChange(files.filter((f) => f !== path));
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const paths: string[] = [];
    for (const item of Array.from(e.dataTransfer.files)) {
      // In Tauri, we get the file path via the webkitRelativePath or name
      // For production, use Tauri's drag-drop plugin; for now use what's available
      if ((item as any).path) {
        paths.push((item as any).path);
      }
    }
    if (paths.length > 0) addPaths(paths);
  }, [files]);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative rounded-xl border-2 border-dashed transition-all duration-200
          ${isDragging
            ? "border-accent bg-accent/5 shadow-glow"
            : "border-border hover:border-border-strong bg-bg-base"
          }
        `}
      >
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors ${
            isDragging ? "bg-accent/15 border border-accent/30" : "bg-bg-elevated border border-border"
          }`}>
            <Upload size={24} className={isDragging ? "text-accent" : "text-text-muted"} />
          </div>
          <p className="text-sm text-text-secondary mb-1">
            {isDragging ? "Release to add files" : "Drag files or folders here"}
          </p>
          <p className="text-2xs text-text-muted mb-5">or browse manually</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBrowseFiles}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              <File size={13} />
              Add Files
            </button>
            <button
              type="button"
              onClick={handleBrowseFolder}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              <FolderOpen size={13} />
              Add Folder
            </button>
          </div>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {files.map((path) => {
            const name = basename(path);
            const dir = isDirectory(path);
            return (
              <div
                key={path}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-bg-surface border border-border/60 group"
              >
                <div className="w-6 h-6 rounded flex items-center justify-center shrink-0">
                  {dir ? (
                    <Folder size={14} className="text-accent/70" />
                  ) : (
                    <File size={14} className="text-text-muted" />
                  )}
                </div>
                <span className="text-xs text-text-primary flex-1 truncate font-mono">
                  {name}
                </span>
                <span className="text-2xs text-text-muted truncate hidden group-hover:hidden max-w-[180px]">
                  {path}
                </span>
                <button
                  type="button"
                  onClick={() => removePath(path)}
                  className="p-0.5 rounded text-text-muted hover:text-danger hover:bg-danger-muted transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex items-center justify-between text-2xs text-text-muted">
          <span>{files.length} item{files.length !== 1 ? "s" : ""} selected</span>
          <button
            type="button"
            onClick={() => onFilesChange([])}
            className="hover:text-danger transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
