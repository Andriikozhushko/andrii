#!/usr/bin/env node
// Thin wrapper around the Rust benchmark example.
//
//   node scripts/benchmark-andrii.mjs              # quick (reduced datasets, 1 rep, ~5 min)
//   node scripts/benchmark-andrii.mjs --quick      # same
//   node scripts/benchmark-andrii.mjs --full       # full spec (full sizes, 3 reps, 30+ min)
//   node scripts/benchmark-andrii.mjs --release    # build in release mode first
//
// Pass --release to build/run in release (slower compile, faster execution).
// Output goes to benchmarks/results/ and docs/.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const passthrough = process.argv.slice(2);
const release = passthrough.includes("--release");
const args = passthrough.filter(a => a !== "--release");

const mode = args.includes("--full") ? "full" : "quick";
const releaseFlag = release ? ["--release"] : [];

const cargoArgs = [
  "run", ...releaseFlag, "-p", "andrii-core", "--example", "benchmark",
  "--", ...args,
];

console.log(`> cargo ${cargoArgs.join(" ")} (${mode} mode, ${release ? "release" : "debug"})`);
const r = spawnSync("cargo", cargoArgs, { cwd: root, stdio: "inherit" });
if (r.error) {
  console.error("Failed to launch cargo:", r.error.message);
  process.exit(1);
}
process.exit(r.status ?? 0);
