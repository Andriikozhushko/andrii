//! ANDRII — Solid-mode compression PROOF OF CONCEPT (research only).
//!
//! This is NOT production code and does NOT touch the archive format. It exists
//! solely to measure the *compression-ratio* difference between:
//!
//!   1. PER-FILE  — the current v2 model: each file compressed independently,
//!      then encrypted independently (one AEAD context per file/chunk).
//!   2. SOLID     — the proposed v3 idea: all files in a group concatenated into
//!      one zstd stream, then that single stream chunk-encrypted.
//!
//! It reuses the real zstd + XChaCha20-Poly1305 primitives so the byte sizes are
//! honest, but it builds throwaway in-memory blobs — there is no reader, no
//! random access, no on-disk format. The output feeds docs/SOLID_MODE_*.md.
//!
//! Usage:
//!   cargo run -p andrii-core --example solid_poc
//!   cargo run -p andrii-core --example solid_poc -- --out benchmarks/results/solid-poc.json

use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Instant;

use andrii_compress::{compress, decide_level, CompressionLevel};
use andrii_crypto::{
    cipher::{encrypt, generate_nonce},
    kdf::{derive_key, generate_salt, KdfParams},
};
use zeroize::Zeroizing;

const CHUNK_SIZE: usize = 1 << 20; // 1 MiB, matches the v2 writer
const AEAD_TAG: u64 = 16;
const CHUNK_PREFIX: u64 = 4;
// Approx. encrypted-header bytes per file entry (path, sizes, nonce, hash, perms)
// as serialized JSON in the real header. Used to model metadata overhead.
const HEADER_BYTES_PER_FILE: u64 = 250;

fn human(b: u64) -> String {
    if b < 1024 { format!("{b} B") }
    else if b < 1 << 20 { format!("{:.1} KB", b as f64 / 1024.0) }
    else if b < 1 << 30 { format!("{:.1} MB", b as f64 / (1u64 << 20) as f64) }
    else { format!("{:.2} GB", b as f64 / (1u64 << 30) as f64) }
}

/// Recursively collect all files under a directory.
fn collect(dir: &Path, out: &mut Vec<PathBuf>) {
    if let Ok(rd) = fs::read_dir(dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() { collect(&p, out); }
            else if p.is_file() { out.push(p); }
        }
    }
}

/// Number of 1 MiB chunks a payload of `len` bytes would be split into.
fn chunk_count(len: u64) -> u64 {
    if len == 0 { 0 } else { len.div_ceil(CHUNK_SIZE as u64) }
}

#[derive(serde::Serialize, Clone)]
struct ModeResult {
    mode: String,
    /// Current per-file model: Σ(compressed-per-file) + per-file AEAD + header overhead.
    per_file_bytes: u64,
    per_file_seconds: f64,
    /// Solid model: one concatenated zstd stream, chunk-encrypted, + 1 header set.
    solid_bytes: u64,
    solid_seconds: f64,
    /// Reduction of solid vs per-file, as a percentage of the per-file size.
    improvement_pct: f64,
}

#[derive(serde::Serialize, Clone)]
struct DatasetResult {
    dataset: String,
    files: usize,
    input_bytes: u64,
    modes: Vec<ModeResult>,
}

fn bench_dataset(name: &str, files: &[PathBuf], key: &Zeroizing<[u8; 32]>) -> DatasetResult {
    let input_bytes: u64 = files.iter().map(|p| fs::metadata(p).map(|m| m.len()).unwrap_or(0)).sum();
    let mut modes = Vec::new();

    for (level, label) in [
        (CompressionLevel::Fast, "Fast"),
        (CompressionLevel::Balanced, "Balanced"),
        (CompressionLevel::Maximum, "Maximum"),
    ] {
        // ── PER-FILE model (mirrors v2 logic: decide_level per file) ──────────
        let t = Instant::now();
        let mut per_file_payload: u64 = 0;
        let mut per_file_overhead: u64 = 0;
        for p in files {
            let data = fs::read(p).unwrap();
            let path_str = p.to_string_lossy();
            let lvl = decide_level(&path_str, &data, level);
            let payload = if lvl == CompressionLevel::None {
                data.len() as u64
            } else {
                compress(&data, lvl).map(|c| c.len() as u64).unwrap_or(data.len() as u64)
            };
            per_file_payload += payload;
            // Per-file overhead: one AEAD tag + length prefix per chunk + header entry.
            let chunks = chunk_count(payload).max(if data.is_empty() { 0 } else { 1 });
            per_file_overhead += chunks * (AEAD_TAG + CHUNK_PREFIX) + HEADER_BYTES_PER_FILE;
        }
        let per_file_bytes = per_file_payload + per_file_overhead;
        let per_file_seconds = t.elapsed().as_secs_f64();

        // ── SOLID model: concatenate ALL files, compress once, chunk-encrypt ──
        let t = Instant::now();
        // Build the concatenated stream (in memory for the PoC).
        let mut concat: Vec<u8> = Vec::with_capacity(input_bytes as usize);
        for p in files {
            let data = fs::read(p).unwrap();
            concat.extend_from_slice(&data);
        }
        // Solid mode always compresses the whole stream at the chosen level
        // (a real implementation would still skip if the stream is incompressible).
        let solid_level = if level == CompressionLevel::Fast {
            CompressionLevel::Fast
        } else {
            level
        };
        let compressed = compress(&concat, solid_level).unwrap_or_else(|_| concat.clone());
        // Chunk-encrypt the compressed stream (real AEAD, real sizes).
        let mut solid_payload: u64 = 0;
        let base = generate_nonce().unwrap();
        let mut base16 = [0u8; 16];
        base16.copy_from_slice(&base[..16]);
        for (i, chunk) in compressed.chunks(CHUNK_SIZE).enumerate() {
            let mut nonce = [0u8; 24];
            nonce[..16].copy_from_slice(&base16);
            nonce[16..24].copy_from_slice(&(i as u64).to_be_bytes());
            let sealed = encrypt(key, &nonce, chunk, &[]).unwrap();
            solid_payload += CHUNK_PREFIX + sealed.len() as u64;
        }
        // Solid still needs per-file metadata (path, offset within the stream,
        // size, hash) so files remain individually verifiable on extraction.
        let solid_overhead = files.len() as u64 * HEADER_BYTES_PER_FILE;
        let solid_bytes = solid_payload + solid_overhead;
        let solid_seconds = t.elapsed().as_secs_f64();

        let improvement_pct = if per_file_bytes > 0 {
            (1.0 - solid_bytes as f64 / per_file_bytes as f64) * 100.0
        } else { 0.0 };

        println!(
            "  {name:<24} {label:<9}  per-file={:>10}  solid={:>10}  improvement={:>6.1}%  (perfile {:.1}s / solid {:.1}s)",
            human(per_file_bytes), human(solid_bytes), improvement_pct,
            per_file_seconds, solid_seconds,
        );

        modes.push(ModeResult {
            mode: label.into(),
            per_file_bytes, per_file_seconds,
            solid_bytes, solid_seconds,
            improvement_pct,
        });
    }

    DatasetResult { dataset: name.into(), files: files.len(), input_bytes, modes }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let out_path = args.iter().position(|a| a == "--out").and_then(|i| args.get(i + 1)).cloned();

    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let project_root = manifest_dir.parent().and_then(|p| p.parent()).unwrap_or(manifest_dir);
    let data_dir = project_root.join("benchmark-data");

    if !data_dir.exists() {
        eprintln!("benchmark-data/ not found — run `cargo run -p andrii-core --example benchmark -- --quick` first.");
        std::process::exit(1);
    }

    // Derive a real key once (shared across the PoC; production derives per archive).
    let salt = generate_salt().unwrap();
    let key = derive_key("solid-poc-password", &salt, &KdfParams::default()).unwrap();

    println!("=== ANDRII Solid-Mode PoC (research only) ===\n");
    println!("Comparing per-file vs solid compression on existing benchmark datasets.\n");

    // Focus on the datasets where solid mode could help: text/source/docs.
    let targets = ["source-code", "many-small-files", "text-small", "mixed-realistic",
                   "documents-mixed", "incompressible-media-like"];
    let mut results: Vec<DatasetResult> = Vec::new();

    for name in targets {
        let dir = data_dir.join(name);
        if !dir.exists() { continue; }
        let mut files = Vec::new();
        collect(&dir, &mut files);
        files.sort();
        if files.is_empty() { continue; }
        println!("--- {name} ({} files) ---", files.len());
        results.push(bench_dataset(name, &files, &key));
        println!();
    }

    // Emit JSON for the docs.
    if let Some(path) = out_path {
        #[derive(serde::Serialize)]
        struct Out { note: String, results: Vec<DatasetResult> }
        let out = Out {
            note: "Research PoC. per_file_bytes models the current v2 archive; \
                   solid_bytes models a proposed v3 solid stream. In-memory only, \
                   no on-disk format change.".into(),
            results: results.clone(),
        };
        if let Some(parent) = Path::new(&path).parent() { let _ = fs::create_dir_all(parent); }
        let mut f = fs::File::create(&path).unwrap();
        f.write_all(serde_json::to_string_pretty(&out).unwrap().as_bytes()).unwrap();
        println!("Wrote {path}");
    }

    // Summary table.
    println!("\n=== Summary: solid improvement over per-file (Maximum mode) ===");
    let mut by_gain: BTreeMap<i64, String> = BTreeMap::new();
    for r in &results {
        if let Some(m) = r.modes.iter().find(|m| m.mode == "Maximum") {
            by_gain.insert(-(m.improvement_pct * 10.0) as i64,
                format!("{:<24} {:>6.1}% smaller ({} → {})",
                    r.dataset, m.improvement_pct, human(m.per_file_bytes), human(m.solid_bytes)));
        }
    }
    for line in by_gain.values() { println!("  {line}"); }
}
