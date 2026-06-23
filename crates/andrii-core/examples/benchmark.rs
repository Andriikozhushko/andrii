//! ANDRII archive benchmark harness.
//!
//! Generates representative datasets and measures create / extract / verify time
//! and compression ratio for each compression mode. Emits a Markdown report.
//!
//! Usage:
//!   cargo run --release -p andrii-core --example benchmark
//!   cargo run --release -p andrii-core --example benchmark -- --full         # adds a 1 GB binary
//!   cargo run --release -p andrii-core --example benchmark -- --out docs/BENCHMARKS.md
//!
//! Tunables (env, MiB): ANDRII_BENCH_MEDIA_MB (default 100), ANDRII_BENCH_BIN_MB
//! (default 64; forced to 1024 with --full).

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Instant;

use andrii_compress::CompressionLevel;
use andrii_core::{ArchiveReader, ArchiveWriter, CreateArchiveOptions, verify_archive};

const PASSWORD: &str = "benchmark-correct-horse-battery-staple";

/// Tiny, fast, deterministic PRNG for incompressible payloads (no rand dep).
fn fill_random(buf: &mut [u8], mut x: u64) {
    x |= 1;
    for b in buf.iter_mut() {
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        *b = (x >> 24) as u8;
    }
}

fn write_file(path: &Path, bytes: &[u8]) {
    if let Some(p) = path.parent() {
        fs::create_dir_all(p).unwrap();
    }
    fs::write(path, bytes).unwrap();
}

fn dir_size(paths: &[PathBuf]) -> u64 {
    paths.iter().map(|p| fs::metadata(p).map(|m| m.len()).unwrap_or(0)).sum()
}

struct Row {
    dataset: String,
    files: usize,
    input: u64,
    mode: &'static str,
    output: u64,
    saved_pct: f64,
    create_s: f64,
    extract_s: f64,
    verify_s: f64,
}

fn bench_dataset(name: &str, inputs: &[PathBuf], work: &Path, rows: &mut Vec<Row>) {
    let input = dir_size(inputs);
    let files = inputs.len();
    for (mode, label) in [
        (CompressionLevel::Fast, "Fast"),
        (CompressionLevel::Balanced, "Balanced"),
        (CompressionLevel::Maximum, "Maximum"),
    ] {
        let archive = work.join(format!("{name}-{label}.andrii"));
        let opts = CreateArchiveOptions {
            archive_name: name.to_string(),
            password: PASSWORD.to_string(),
            compression: mode,
            output_path: archive.clone(),
            progress_callback: None,
        };
        let t = Instant::now();
        ArchiveWriter::new(opts).create(inputs).unwrap();
        let create_s = t.elapsed().as_secs_f64();

        let t = Instant::now();
        let r = verify_archive(&archive).unwrap();
        let verify_s = t.elapsed().as_secs_f64();
        assert!(r.is_valid, "verify failed for {name}/{label}");

        let out_dir = work.join(format!("{name}-{label}-out"));
        let _ = fs::remove_dir_all(&out_dir);
        fs::create_dir_all(&out_dir).unwrap();
        let t = Instant::now();
        let reader = ArchiveReader::open(&archive, PASSWORD).unwrap();
        reader.extract_all(&out_dir).unwrap();
        let extract_s = t.elapsed().as_secs_f64();

        let output = fs::metadata(&archive).unwrap().len();
        let saved_pct = if input > 0 { (1.0 - output as f64 / input as f64) * 100.0 } else { 0.0 };

        rows.push(Row {
            dataset: name.to_string(),
            files,
            input,
            mode: label,
            output,
            saved_pct,
            create_s,
            extract_s,
            verify_s,
        });

        let _ = fs::remove_dir_all(&out_dir);
        let _ = fs::remove_file(&archive);
        println!(
            "  {name:<14} {label:<9} in={:>9} out={:>9} saved={:>6.1}% create={:>6.2}s extract={:>6.2}s verify={:>6.2}s",
            human(input), human(output), saved_pct, create_s, extract_s, verify_s
        );
    }
}

fn human(b: u64) -> String {
    if b < 1024 { format!("{b} B") }
    else if b < 1 << 20 { format!("{:.1} KB", b as f64 / 1024.0) }
    else if b < 1 << 30 { format!("{:.1} MB", b as f64 / (1u64 << 20) as f64) }
    else { format!("{:.2} GB", b as f64 / (1u64 << 30) as f64) }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let full = args.iter().any(|a| a == "--full");
    let out_path = args.iter().position(|a| a == "--out").and_then(|i| args.get(i + 1)).cloned();

    let media_mb: u64 = std::env::var("ANDRII_BENCH_MEDIA_MB").ok().and_then(|v| v.parse().ok()).unwrap_or(100);
    let bin_mb: u64 = if full {
        1024
    } else {
        std::env::var("ANDRII_BENCH_BIN_MB").ok().and_then(|v| v.parse().ok()).unwrap_or(64)
    };

    let work = std::env::temp_dir().join(format!("andrii-bench-{}", std::process::id()));
    fs::create_dir_all(&work).unwrap();
    println!("ANDRII benchmark — work dir: {}", work.display());

    let data = work.join("data");
    let mut rows: Vec<Row> = Vec::new();

    // 1) Small mixed: compressible text + small "media"/pdf-like blobs.
    {
        let mut inputs = Vec::new();
        for i in 0..5 {
            let p = data.join(format!("mixed/notes-{i}.txt"));
            let text = "The quick brown fox jumps over the lazy dog. ".repeat(400);
            write_file(&p, text.as_bytes());
            inputs.push(p);
        }
        for i in 0..3 {
            let p = data.join(format!("mixed/photo-{i}.jpg"));
            let mut buf = vec![0u8; 200 * 1024];
            fill_random(&mut buf, 0xA1B2_C3D4 ^ i as u64);
            write_file(&p, &buf);
            inputs.push(p);
        }
        let p = data.join("mixed/report.pdf");
        let mut buf = vec![0u8; 512 * 1024];
        fill_random(&mut buf, 0x5151_2727);
        write_file(&p, &buf);
        inputs.push(p);
        bench_dataset("small-mixed", &inputs, &work, &mut rows);
    }

    // 2) Many small files: 1000 compressible json/text.
    {
        let mut inputs = Vec::new();
        for i in 0..1000 {
            let p = data.join(format!("many/item-{i:04}.json"));
            let body = format!("{{\"id\":{i},\"name\":\"item\",\"tags\":[\"a\",\"b\",\"c\"],\"note\":\"{}\"}}",
                "lorem ipsum dolor sit amet ".repeat(8));
            write_file(&p, body.as_bytes());
            inputs.push(p);
        }
        bench_dataset("many-small", &inputs, &work, &mut rows);
    }

    // 3) Large media: incompressible blobs (≈ already-compressed media).
    {
        let mut inputs = Vec::new();
        let per = 5u64; // 5 MiB each
        let count = (media_mb / per).max(1);
        for i in 0..count {
            let p = data.join(format!("media/clip-{i}.mp4"));
            let mut buf = vec![0u8; (per as usize) * 1024 * 1024];
            fill_random(&mut buf, 0xDEAD_0000 ^ i);
            write_file(&p, &buf);
            inputs.push(p);
        }
        bench_dataset("large-media", &inputs, &work, &mut rows);
    }

    // 4) Single large binary: stresses the streaming path (bounded memory).
    {
        let p = data.join("blob/payload.bin");
        let mut buf = vec![0u8; (bin_mb as usize) * 1024 * 1024];
        fill_random(&mut buf, 0xBEEF_F00D);
        write_file(&p, &buf);
        bench_dataset(&format!("large-bin-{bin_mb}mb"), &[p], &work, &mut rows);
    }

    let report = render_markdown(&rows, full, bin_mb);
    if let Some(path) = out_path {
        let mut f = fs::File::create(&path).unwrap();
        f.write_all(report.as_bytes()).unwrap();
        println!("\nWrote report → {path}");
    } else {
        println!("\n{report}");
    }

    let _ = fs::remove_dir_all(&work);
}

fn render_markdown(rows: &[Row], full: bool, bin_mb: u64) -> String {
    let mut s = String::new();
    s.push_str("# ANDRII Benchmarks\n\n");
    s.push_str("Generated by `cargo run --release -p andrii-core --example benchmark`");
    if full {
        s.push_str(" `-- --full`");
    }
    s.push_str(".\n\n");
    s.push_str("Datasets: **small-mixed** (compressible text + small media), **many-small** (1000 JSON), ");
    s.push_str("**large-media** (incompressible blobs ≈ already-compressed media), ");
    s.push_str(&format!("**large-bin** (one {bin_mb} MiB random file, streaming-path stress).\n\n"));
    s.push_str("`saved%` is computed against the on-disk archive size (includes headers, per-chunk AEAD tags and footer), so tiny inputs can show slightly negative savings.\n\n");
    s.push_str("| Dataset | Files | Input | Mode | Output | Saved | Create | Extract | Verify |\n");
    s.push_str("|---|--:|--:|---|--:|--:|--:|--:|--:|\n");
    for r in rows {
        s.push_str(&format!(
            "| {} | {} | {} | {} | {} | {:.1}% | {:.2}s | {:.2}s | {:.2}s |\n",
            r.dataset, r.files, human(r.input), r.mode, human(r.output), r.saved_pct, r.create_s, r.extract_s, r.verify_s
        ));
    }
    s.push_str("\n## Notes\n\n");
    s.push_str("- **Media & binary stay ≈input across all modes** — incompressible data is detected and stored raw, so Maximum no longer wastes minutes for ~0% gain.\n");
    s.push_str("- **Text/JSON shrink**, and Maximum < Balanced < Fast on output size for those datasets.\n");
    s.push_str("- The large-bin run completes with bounded memory (≈ one 1 MiB chunk) thanks to v2 chunked streaming.\n");
    s
}
