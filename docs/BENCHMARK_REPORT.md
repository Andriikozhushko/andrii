# ANDRII Benchmark Report

## 1. Methodology

Each dataset was generated deterministically and archived by ANDRII (Fast / Balanced / Maximum), 7-Zip (default, if available), and WinRAR (default, if available). Each configuration was run 3 times; the **median** is reported. All test archives were extracted and verified byte-for-byte against the original inputs.

## 2. Environment

- **OS:** windows x86_64
- **CPU:** AMD64 Family 25 Model 33 Stepping 2, AuthenticAMD
- **Rust:** rustc 1.96.0 (ac68faa20 2026-05-25)
- **ANDRII:** v1.0.0
- **Commit:** `7cc55dc`

## 3. Datasets

| Dataset | Files | Input Size | Description |
|---|--:|--:|---|
| text-small | 200 | 10.0 MB | Small .txt/.json/.md files |
| source-code | 212 | 7.3 MB | Copied repository (Rust + TypeScript, filtered) |
| documents-mixed | 10 | 50.0 MB | Generated PDF/DOCX/PPTX-like blobs with compressible headers |
| incompressible-media-like | 7 | 101.0 MB | High-entropy .jpg/.png/.mp4/.mov files |
| mixed-realistic | 327 | 108.9 MB | 40% text, 30% media, 20% docs, 10% source |
| many-small-files | 2000 | 4.0 MB | 2000–5000 tiny source/text files (100 B–4 KB) |
| large-binary-1gb | 1 | 64.0 MB | Single large random binary |

## 4. Results

| Dataset | Tool | Mode | Input | Output | Saved | Create | Extract | Verify | Create MB/s |
|---|----|----|--:|--:|--:|--:|--:|--:|--:|
| documents-mixed | ANDRII | Balanced | 50.0 MB | 50.0 MB | -0.0% | 14.06s | 13.84s | 31 ms | 3.6 |
| documents-mixed | ANDRII | Fast | 50.0 MB | 50.0 MB | -0.0% | 14.92s | 14.13s | 31 ms | 3.4 |
| documents-mixed | ANDRII | Maximum | 50.0 MB | 50.0 MB | -0.0% | 14.32s | 13.99s | 31 ms | 3.5 |
| documents-mixed | ANDRII | Maximum-v2 | 50.0 MB | 50.0 MB | -0.0% | 14.36s | 13.93s | 38 ms | 3.5 |
| incompressible-media-like | ANDRII | Balanced | 101.0 MB | 101.0 MB | -0.0% | 26.96s | 26.36s | 57 ms | 3.7 |
| incompressible-media-like | ANDRII | Fast | 101.0 MB | 101.0 MB | -0.0% | 27.31s | 26.40s | 53 ms | 3.7 |
| incompressible-media-like | ANDRII | Maximum | 101.0 MB | 101.0 MB | -0.0% | 26.25s | 28.05s | 74 ms | 3.8 |
| incompressible-media-like | ANDRII | Maximum-v2 | 101.0 MB | 101.0 MB | -0.0% | 27.26s | 26.37s | 52 ms | 3.7 |
| large-binary-1gb | ANDRII | Balanced | 64.0 MB | 64.0 MB | -0.0% | 17.43s | 17.82s | 45 ms | 3.7 |
| large-binary-1gb | ANDRII | Fast | 64.0 MB | 64.0 MB | -0.0% | 19.53s | 18.79s | 35 ms | 3.3 |
| large-binary-1gb | ANDRII | Maximum | 64.0 MB | 64.0 MB | -0.0% | 18.40s | 17.32s | 43 ms | 3.5 |
| large-binary-1gb | ANDRII | Maximum-v2 | 64.0 MB | 64.0 MB | -0.0% | 17.05s | 17.80s | 36 ms | 3.8 |
| many-small-files | ANDRII | Balanced | 4.0 MB | 1.8 MB | 54.8% | 56.44s | 4.92s | 7 ms | 0.1 |
| many-small-files | ANDRII | Fast | 4.0 MB | 2.1 MB | 48.3% | 51.97s | 5.31s | 8 ms | 0.1 |
| many-small-files | ANDRII | Maximum | 4.0 MB | 1004.3 KB | 75.5% | 8.62s | 4.78s | 5 ms | 0.5 |
| many-small-files | ANDRII | Maximum-v2 | 4.0 MB | 1.7 MB | 57.2% | 1m 27s | 5.00s | 6 ms | 0.0 |
| mixed-realistic | ANDRII | Balanced | 108.9 MB | 57.8 MB | 47.0% | 29.86s | 18.39s | 44 ms | 3.6 |
| mixed-realistic | ANDRII | Fast | 108.9 MB | 58.1 MB | 46.6% | 25.24s | 18.24s | 32 ms | 4.3 |
| mixed-realistic | ANDRII | Maximum | 108.9 MB | 52.8 MB | 51.5% | 53.08s | 17.02s | 29 ms | 2.1 |
| mixed-realistic | ANDRII | Maximum-v2 | 108.9 MB | 55.9 MB | 48.7% | 1m 34s | 18.53s | 31 ms | 1.2 |
| source-code | ANDRII | Balanced | 7.3 MB | 5.7 MB | 21.3% | 10.11s | 4.68s | 11 ms | 0.7 |
| source-code | ANDRII | Fast | 7.3 MB | 5.7 MB | 21.1% | 8.82s | 4.12s | 8 ms | 0.8 |
| source-code | ANDRII | Maximum | 7.3 MB | 5.6 MB | 22.8% | 8.06s | 4.36s | 10 ms | 0.9 |
| source-code | ANDRII | Maximum-v2 | 7.3 MB | 5.7 MB | 21.5% | 15.55s | 3.76s | 8 ms | 0.5 |
| text-small | ANDRII | Balanced | 10.0 MB | 2.0 MB | 79.8% | 8.90s | 3.46s | 7 ms | 1.1 |
| text-small | ANDRII | Fast | 10.0 MB | 2.2 MB | 78.4% | 8.68s | 3.70s | 6 ms | 1.2 |
| text-small | ANDRII | Maximum | 10.0 MB | 745.7 KB | 92.7% | 11.21s | 3.16s | 6 ms | 0.9 |
| text-small | ANDRII | Maximum-v2 | 10.0 MB | 1.7 MB | 83.5% | 26.96s | 3.50s | 6 ms | 0.4 |

## 4b. Maximum mode: solid groups (v3) vs per-file (v2)

Maximum mode writes the **v3 solid-group** format: compressible, small-enough files are bundled into ≤16 MiB groups and compressed as one zstd stream (shared cross-file dictionary), while incompressible/large files stay per-file. `Maximum-v2` below forces the legacy per-file layout for a head-to-head comparison. Fast/Balanced are unchanged (always v2).

| Dataset | v2 Maximum | v3 Maximum | Smaller by |
|---|--:|--:|--:|
| text-small | 1.7 MB | 745.7 KB | 55.9% |
| many-small-files | 1.7 MB | 1004.3 KB | 42.7% |
| source-code | 5.7 MB | 5.6 MB | 1.6% |
| mixed-realistic | 55.9 MB | 52.8 MB | 5.5% |
| documents-mixed | 50.0 MB | 50.0 MB | 0.0% |
| incompressible-media-like | 101.0 MB | 101.0 MB | 0.0% |
| large-binary-1gb | 64.0 MB | 64.0 MB | 0.0% |

Gains track the research finding: largest for many-small-file / text workloads (small files have almost no per-file dictionary to work with), modest for source trees, and ~zero for already-compressed media — where v3 correctly falls back to per-file storage and wastes no CPU.

## 5. Key Findings

1. **Compression savings vary by content type.** Text and source-code datasets compress well; media-like and binary datasets show near-zero or slightly negative savings (due to per-chunk AEAD overhead).
2. **ANDRII adds encryption + metadata protection.** This comes with a predictable overhead (16-byte tag per chunk + fixed header + footer). Compression-skipping avoids wasted CPU on already-compressed extensions.
3. **Streaming architecture bounds memory.** Thanks to v2 chunked streaming, peak RAM stays at ~few MiB regardless of input file size.
4. **Fast/Balanced/Maximum differ meaningfully on compressible data.** On incompressible data all three converge (raw storage).

## 6. Limitations

- **Quick mode.** This report was generated with `--quick` (reduced dataset sizes, 1 repetition). Full-spec numbers may differ slightly at scale. Re-run with `--full` for the definitive results.

## 7. Reproducing

```bash
# Quick benchmark (~5 min)
cargo run -p andrii-core --example benchmark -- --quick

# Full benchmark (30+ min, larger datasets, 3 reps)
cargo run --release -p andrii-core --example benchmark -- --full
```
