#!/usr/bin/env node
// Thin wrapper around the Rust benchmark example. Runs it in release mode and
// writes the Markdown report to docs/BENCHMARKS.md (pass --full for the 1 GB run).
//
//   node scripts/benchmark-andrii.mjs            # quick (64 MiB binary)
//   node scripts/benchmark-andrii.mjs --full     # full (1 GiB binary)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const passthrough = process.argv.slice(2);
const out = "docs/BENCHMARKS.md";

const args = [
  "run", "--release", "-p", "andrii-core", "--example", "benchmark",
  "--", "--out", out, ...passthrough,
];

console.log(`> cargo ${args.join(" ")}`);
const r = spawnSync("cargo", args, { cwd: root, stdio: "inherit" });
if (r.error) {
  console.error("Failed to launch cargo:", r.error.message);
  process.exit(1);
}
process.exit(r.status ?? 0);
