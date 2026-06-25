#!/usr/bin/env node
// verify-release-artifacts.mjs
//
// Locates expected ANDRII release artifacts, verifies they exist and are
// non-zero, prints human-readable paths + sizes, computes SHA-256 checksums,
// and writes a SHA256SUMS.txt file. Fails with an actionable error if an
// expected artifact is missing.
//
// Two name modes:
//   native  (default) — match Tauri's native output by extension pattern
//                       (*-setup.exe, *.msi, *.AppImage, *.deb). Used in the
//                       build jobs immediately after `tauri build`, before
//                       staging.
//   branded (--branded) — require the exact public release filenames
//                       (ANDRII_1.0.0_x64-setup.exe, ANDRII_1.0.0_x64_en-US.msi,
//                        ANDRII_1.0.0_x64.AppImage, ANDRII_1.0.0_amd64.deb).
//                       Used after the staging step and in the release-
//                       aggregation job. Fails if any unexpected release-type
//                       file is present, so only the branded names reach
//                       SHA256SUMS.txt and the GitHub Release.
//
// Uses only Node built-ins (no dependencies).
//
// Usage:
//   node scripts/verify-release-artifacts.mjs                    # native mode, auto-detect platform, scan target/release/bundle
//   node scripts/verify-release-artifacts.mjs --platform windows # native mode: expect NSIS + MSI
//   node scripts/verify-release-artifacts.mjs --platform linux   # native mode: expect AppImage + DEB
//   node scripts/verify-release-artifacts.mjs --platform all     # native mode: expect all four
//   node scripts/verify-release-artifacts.mjs --branded          # branded mode: require exact public filenames
//   node scripts/verify-release-artifacts.mjs --dir <path>       # scan a different directory (recursive)
//   node scripts/verify-release-artifacts.mjs --out <file>       # write SHA256SUMS to this path
//   node scripts/verify-release-artifacts.mjs --checksums-only   # checksum whatever is found, don't fail on missing expected
//   node scripts/verify-release-artifacts.mjs --expect-missing   # invert: succeed only if at least one expected artifact is absent (controlled missing-artifact test)
//   node scripts/verify-release-artifacts.mjs --help             # show this usage and exit

import { createHash } from "node:crypto";
import { readdirSync, statSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, relative, resolve, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const VERSION = "1.0.0";

// Exact public release filenames — what users download from GitHub Releases.
// These are the staged names; native Tauri output is renamed to these before
// this list is consulted in branded mode.
const BRANDED = {
  windows: [
    { name: `ANDRII_${VERSION}_x64-setup.exe`, label: "NSIS setup EXE" },
    { name: `ANDRII_${VERSION}_x64_en-US.msi`, label: "MSI installer" },
  ],
  linux: [
    { name: `ANDRII_${VERSION}_x64.AppImage`, label: "AppImage" },
    { name: `ANDRII_${VERSION}_amd64.deb`,     label: "Debian package" },
  ],
};

// Native Tauri output matched by extension pattern (build-job verification,
// before staging). Tolerates minor suffix/locale variations in Tauri's names.
const NATIVE = [
  { kind: "nsis",     platforms: ["windows", "all"], test: (n) => /-setup\.exe$/i.test(n), label: "NSIS setup EXE" },
  { kind: "msi",      platforms: ["windows", "all"], test: (n) => /\.msi$/i.test(n),       label: "MSI installer" },
  { kind: "appimage", platforms: ["linux", "all"],   test: (n) => /\.appimage$/i.test(n),  label: "AppImage" },
  { kind: "deb",      platforms: ["linux", "all"],   test: (n) => /\.deb$/i.test(n),       label: "Debian package" },
];

const RELEASE_EXT = /\.(exe|msi|appimage|deb|dmg|snap|rpm)$/i;

// --- arg parsing -----------------------------------------------------------
const args = process.argv.slice(2);
function getFlag(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}
const hasFlag = (name) => args.includes(`--${name}`);

if (hasFlag("help")) {
  const usage = [
    "Usage: node scripts/verify-release-artifacts.mjs [options]",
    "",
    "Options:",
    "  --platform <windows|linux|all>  Which artifacts to expect (default: auto-detect)",
    "  --branded                       Require exact public release filenames (post-staging / release job)",
    "  --dir <path>                    Scan a different directory recursively (default: target/release/bundle)",
    "  --out <file>                    Write SHA256SUMS to this path (default: <scan-dir>/SHA256SUMS.txt)",
    "  --checksums-only                Checksum whatever is found; do not fail on missing expected artifacts",
    "  --expect-missing                Invert: succeed only if at least one expected artifact is absent",
    "  --help                          Show this help and exit",
    "",
    "Name modes:",
    "  native (default)  Match Tauri output by extension pattern (build jobs, pre-staging)",
    "  branded (--branded) Require exact public filenames ANDRII_<ver>_... (post-staging, release job)",
  ].join("\n");
  console.log(usage);
  process.exit(0);
}

const platformArg = getFlag("platform");
const dirArg = getFlag("dir");
const outArg = getFlag("out");
const branded = hasFlag("branded");
const checksumsOnly = hasFlag("checksums-only");
const expectMissing = hasFlag("expect-missing");

function defaultPlatform() {
  if (platformArg) return platformArg;
  if (process.platform === "win32") return "windows";
  if (process.platform === "linux") return "linux";
  return "all";
}
const platform = defaultPlatform();

const brandedFor = (plat) =>
  plat === "all" ? [...BRANDED.windows, ...BRANDED.linux] : (BRANDED[plat] || []);
const nativeFor = (plat) => NATIVE.filter((e) => e.platforms.includes(plat));

// --- helpers ---------------------------------------------------------------
function scanDir(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...scanDir(full));
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

function sha256OfFile(filePath) {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

// --- main ------------------------------------------------------------------
const scanRoot = dirArg
  ? resolve(repoRoot, dirArg)
  : resolve(repoRoot, "target", "release", "bundle");

const allFiles = scanDir(scanRoot);
const candidates = allFiles.filter((f) => !/SHA256SUMS/i.test(basename(f)));

console.log(`ANDRII release artifact verification`);
console.log(`  platform : ${platform}`);
console.log(`  mode     : ${branded ? "branded (exact public filenames)" : "native (Tauri output patterns)"}`);
console.log(`  scan dir : ${scanRoot}`);
console.log(`  files    : ${candidates.length} candidate(s)\n`);

const lines = [];
const missing = [];
const empty = [];
const unexpected = [];

if (branded) {
  const expected = brandedFor(platform);
  const expectedNames = new Set(expected.map((e) => e.name.toLowerCase()));
  for (const e of expected) {
    const hits = candidates.filter((f) => basename(f).toLowerCase() === e.name.toLowerCase());
    if (hits.length === 0) {
      missing.push({ label: e.label, kind: e.name });
      console.log(`  [MISSING] ${e.label} — expected ${e.name}`);
      continue;
    }
    for (const path of hits) {
      const size = statSync(path).size;
      const hash = sha256OfFile(path);
      console.log(`  [OK]      ${e.label.padEnd(16)} ${humanSize(size).padStart(10)}  ${hash.slice(0, 12)}…  ${relative(scanRoot, path)}`);
      lines.push(`${hash}  ${basename(path)}`);
      if (size === 0) empty.push({ label: e.label, path });
    }
  }
  // In branded mode, no other release-type files may be present — only the
  // branded public filenames may reach SHA256SUMS.txt and the GitHub Release.
  for (const path of candidates) {
    const name = basename(path);
    if (RELEASE_EXT.test(name) && !expectedNames.has(name.toLowerCase())) {
      unexpected.push(path);
      console.log(`  [UNEXPECTED] ${name}`);
    }
  }
} else {
  const expected = nativeFor(platform);
  for (const e of expected) {
    const hits = candidates.filter((f) => e.test(basename(f)));
    if (hits.length === 0) {
      missing.push({ label: e.label, kind: e.kind });
      console.log(`  [MISSING] ${e.label} (${e.kind})`);
      continue;
    }
    for (const path of hits) {
      const size = statSync(path).size;
      const hash = sha256OfFile(path);
      console.log(`  [OK]      ${e.label.padEnd(16)} ${humanSize(size).padStart(10)}  ${hash.slice(0, 12)}…  ${relative(scanRoot, path)}`);
      lines.push(`${hash}  ${basename(path)}`);
      if (size === 0) empty.push({ label: e.label, path });
    }
  }
  // Checksum extra plausible release files not in the expected set (native mode only).
  for (const path of candidates) {
    if (expected.some((e) => e.test(basename(path)))) continue;
    if (RELEASE_EXT.test(basename(path))) {
      const size = statSync(path).size;
      const hash = sha256OfFile(path);
      console.log(`  [EXTRA]   ${"".padEnd(16)} ${humanSize(size).padStart(10)}  ${hash.slice(0, 12)}…  ${relative(scanRoot, path)}`);
      lines.push(`${hash}  ${basename(path)}`);
    }
  }
}

const outPath = outArg ? resolve(repoRoot, outArg) : join(scanRoot, "SHA256SUMS.txt");
if (lines.length > 0) {
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`\n  Wrote ${lines.length} checksum(s) to ${relative(repoRoot, outPath)}`);
} else {
  console.log(`\n  No artifacts found; no SHA256SUMS.txt written.`);
}

// --- exit logic ------------------------------------------------------------
if (expectMissing) {
  if (missing.length > 0) {
    console.log(`\n  [expect-missing] Confirmed ${missing.length} missing expected artifact(s) — absence correctly detected.`);
    process.exit(0);
  }
  console.error(`\n  [expect-missing] FAIL: all expected artifacts present (expected at least one missing).`);
  process.exit(1);
}

if (checksumsOnly) process.exit(0);

if (empty.length > 0) {
  console.error(`\nFAIL: ${empty.length} expected artifact(s) are zero bytes:`);
  for (const { label, path } of empty) console.error(`  - ${label}: ${path}`);
  process.exit(1);
}

if (unexpected.length > 0) {
  console.error(`\nFAIL: ${unexpected.length} unexpected release artifact(s) present in branded mode (only branded public filenames allowed):`);
  for (const path of unexpected) console.error(`  - ${basename(path)}`);
  console.error(`\nStaging must produce only the branded filenames. Do not publish; inspect the staging directory.`);
  process.exit(1);
}

if (missing.length > 0) {
  console.error(`\nFAIL: ${missing.length} expected artifact(s) missing for platform "${platform}" (${branded ? "branded" : "native"} mode):`);
  for (const e of missing) console.error(`  - ${e.label}${e.kind ? ` (${e.kind})` : ""}`);
  console.error(`\nThe build did not produce the required release artifact(s). Do not publish; inspect the build log.`);
  process.exit(1);
}

console.log(`\nOK: all expected artifacts for platform "${platform}" present and non-zero (${branded ? "branded" : "native"} mode).`);
process.exit(0);
