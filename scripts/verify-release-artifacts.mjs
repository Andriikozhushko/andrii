#!/usr/bin/env node
// verify-release-artifacts.mjs
//
// Locates expected ANDRII release artifacts, verifies they exist and are
// non-zero, prints human-readable paths + sizes, computes SHA-256 checksums,
// and writes a SHA256SUMS.txt file. Fails with an actionable error if an
// expected artifact is missing.
//
// Uses only Node built-ins (no dependencies).
//
// Usage:
//   node scripts/verify-release-artifacts.mjs                    # auto-detect platform, scan target/release/bundle
//   node scripts/verify-release-artifacts.mjs --platform windows # expect NSIS + MSI
//   node scripts/verify-release-artifacts.mjs --platform linux   # expect AppImage + DEB
//   node scripts/verify-release-artifacts.mjs --platform all     # expect all four (release combine)
//   node scripts/verify-release-artifacts.mjs --dir <path>       # scan a different directory (recursive)
//   node scripts/verify-release-artifacts.mjs --out <file>       # write SHA256SUMS to this path
//   node scripts/verify-release-artifacts.mjs --checksums-only   # checksum whatever is found, don't fail on missing expected
//   node scripts/verify-release-artifacts.mjs --expect-missing   # invert: succeed only if at least one expected artifact is absent (controlled missing-artifact test)

import { createHash } from "node:crypto";
import { readdirSync, statSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, relative, resolve, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// --- arg parsing -----------------------------------------------------------
const args = process.argv.slice(2);
function getFlag(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}
const hasFlag = (name) => args.includes(`--${name}`);

const platformArg = getFlag("platform");
const dirArg = getFlag("dir");
const outArg = getFlag("out");
const checksumsOnly = hasFlag("checksums-only");
const expectMissing = hasFlag("expect-missing");

function defaultPlatform() {
  if (platformArg) return platformArg;
  if (process.platform === "win32") return "windows";
  if (process.platform === "linux") return "linux";
  return "all";
}
const platform = defaultPlatform();

// --- expected artifact definitions -----------------------------------------
const EXPECTED = [
  { kind: "nsis",     platforms: ["windows", "all"], test: (n) => /-setup\.exe$/i.test(n), label: "NSIS setup EXE" },
  { kind: "msi",      platforms: ["windows", "all"], test: (n) => /\.msi$/i.test(n),       label: "MSI installer" },
  { kind: "appimage", platforms: ["linux", "all"],   test: (n) => /\.appimage$/i.test(n),  label: "AppImage" },
  { kind: "deb",      platforms: ["linux", "all"],   test: (n) => /\.deb$/i.test(n),       label: "Debian package" },
];

const expectedFor = (plat) => EXPECTED.filter((e) => e.platforms.includes(plat));

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
const expected = expectedFor(platform);

const found = new Map();
for (const e of expected) found.set(e.kind, candidates.filter((f) => e.test(basename(f))));

console.log(`ANDRII release artifact verification`);
console.log(`  platform : ${platform}`);
console.log(`  scan dir : ${scanRoot}`);
console.log(`  files    : ${candidates.length} candidate(s)\n`);

const lines = [];
const missing = [];
const empty = [];

for (const e of expected) {
  const hits = found.get(e.kind) || [];
  if (hits.length === 0) {
    missing.push(e);
    console.log(`  [MISSING] ${e.label} (${e.kind})`);
    continue;
  }
  for (const path of hits) {
    const size = statSync(path).size;
    const hash = sha256OfFile(path);
    console.log(`  [OK]      ${e.label.padEnd(16)} ${humanSize(size).padStart(10)}  ${hash.slice(0, 12)}…  ${relative(scanRoot, path)}`);
    lines.push(`${hash}  ${basename(path)}`);
  }
}

// Checksum extra plausible release files not in the expected set.
for (const path of candidates) {
  if (expected.some((e) => e.test(basename(path)))) continue;
  if (/\.(exe|msi|appimage|deb|dmg|snap|rpm)$/i.test(basename(path))) {
    const size = statSync(path).size;
    const hash = sha256OfFile(path);
    console.log(`  [EXTRA]   ${"".padEnd(16)} ${humanSize(size).padStart(10)}  ${hash.slice(0, 12)}…  ${relative(scanRoot, path)}`);
    lines.push(`${hash}  ${basename(path)}`);
  }
}

for (const e of expected) {
  for (const path of found.get(e.kind) || []) {
    if (statSync(path).size === 0) empty.push({ e, path });
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
  for (const { e, path } of empty) console.error(`  - ${e.label}: ${path}`);
  process.exit(1);
}

if (missing.length > 0) {
  console.error(`\nFAIL: ${missing.length} expected artifact(s) missing for platform "${platform}":`);
  for (const e of missing) console.error(`  - ${e.label} (${e.kind})`);
  console.error(`\nThe build did not produce the required release artifact(s). Do not publish; inspect the build log.`);
  process.exit(1);
}

console.log(`\nOK: all expected artifacts for platform "${platform}" present and non-zero.`);
process.exit(0);
