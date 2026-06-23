/**
 * Mirror of the Rust compression heuristics
 * (`crates/andrii-compress/src/lib.rs`). Used only to show honest UI hints —
 * the actual compression decision is always made in the core.
 */

const INCOMPRESSIBLE_EXTS = new Set([
  // images
  "jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif",
  // video
  "mp4", "m4v", "mov", "mkv", "avi", "webm", "wmv", "flv",
  // audio
  "mp3", "aac", "ogg", "oga", "opus", "flac", "m4a", "wma",
  // archives / already-compressed containers
  "zip", "7z", "rar", "gz", "tgz", "bz2", "xz", "zst", "lz4", "br", "cab",
  // documents that embed compression
  "pdf", "docx", "xlsx", "pptx", "odt", "ods", "odp", "epub",
  // packages / binaries
  "jar", "apk", "ipa", "dmg", "exe", "msi", "appimage", "crx", "nupkg",
]);

/** Extensions that always benefit from compression (source code, text, config). */
const COMPRESSIBLE_EXTS = new Set([
  "rs", "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "java", "kt", "c", "cpp", "h", "hpp",
  "go", "rb", "php", "swift", "cs", "fs",
  "sh", "bash", "zsh", "ps1", "bat", "cmd",
  "yaml", "yml", "toml", "ini", "cfg", "conf",
  "txt", "text", "md", "markdown", "rst", "tex", "latex",
  "xml", "svg", "html", "htm", "css", "scss", "sass", "less",
  "json", "jsonl", "csv", "tsv", "log",
  "diff", "patch", "env", "makefile", "dockerfile",
  "lock", "sql", "lua", "vim", "r", "dart",
  "vue", "svelte", "astro",
  "tf", "hcl", "proto", "graphql", "prisma",
  "nix", "zig", "nim", "hs", "elm", "ml",
  "erl", "ex", "exs", "clj", "cljs",
  "edn", "jl", "lean",
]);

const MEDIA_EXTS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif",
  "mp4", "m4v", "mov", "mkv", "avi", "webm", "wmv", "flv",
  "mp3", "aac", "ogg", "oga", "opus", "flac", "m4a", "wma",
]);

function ext(path: string): string {
  const name = path.replace(/\\/g, "/").split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function is_probably_incompressible(path: string): boolean {
  return INCOMPRESSIBLE_EXTS.has(ext(path));
}

export function is_compressible_source(path: string): boolean {
  return COMPRESSIBLE_EXTS.has(ext(path));
}

export function is_media(path: string): boolean {
  return MEDIA_EXTS.has(ext(path));
}

/**
 * Classify a set of file paths for the honest compression hint shown before
 * sealing. Returns "media" when most are pre-compressed media, "mixed" when
 * some are, "compressible" when few/none are.
 */
export function classifyCompressibility(paths: string[]): "media" | "mixed" | "compressible" {
  if (paths.length === 0) return "compressible";
  const incompressible = paths.filter(is_probably_incompressible).length;
  const ratio = incompressible / paths.length;
  if (ratio >= 0.7) return "media";
  if (ratio >= 0.2) return "mixed";
  return "compressible";
}
