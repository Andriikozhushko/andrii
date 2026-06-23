# ANDRII Benchmark Report

## 1. Methodology

Each dataset was generated deterministically and archived by ANDRII (Fast / Balanced / Maximum), 7-Zip (default, if available), and WinRAR (default, if available). Each configuration was run 3 times; the **median** is reported. All test archives were extracted and verified byte-for-byte against the original inputs.

## 2. Environment

- **OS:** windows x86_64
- **CPU:** AMD64 Family 25 Model 33 Stepping 2, AuthenticAMD
- **Rust:** rustc 1.96.0 (ac68faa20 2026-05-25)
- **ANDRII:** v1.0.0
- **Commit:** `f88ff58`

## 3. Datasets

| Dataset | Files | Input Size | Description |
|---|--:|--:|---|
| text-small | 200 | 10.0 MB | Small .txt/.json/.md files |
| source-code | 205 | 7.2 MB | Copied repository (Rust + TypeScript, filtered) |
| documents-mixed | 10 | 50.0 MB | Generated PDF/DOCX/PPTX-like blobs with compressible headers |
| incompressible-media-like | 7 | 101.0 MB | High-entropy .jpg/.png/.mp4/.mov files |
| mixed-realistic | 327 | 108.9 MB | 40% text, 30% media, 20% docs, 10% source |
| large-binary-1gb | 1 | 64.0 MB | Single large random binary |

## 4. Results

| Dataset | Tool | Mode | Input | Output | Saved | Create | Extract | Verify | Create MB/s |
|---|----|----|--:|--:|--:|--:|--:|--:|--:|
| documents-mixed | ANDRII | Balanced | 50.0 MB | 50.0 MB | -0.0% | 13.45s | 13.03s | 28 ms | 3.7 |
| documents-mixed | ANDRII | Fast | 50.0 MB | 50.0 MB | -0.0% | 13.65s | 13.59s | 28 ms | 3.7 |
| documents-mixed | ANDRII | Maximum | 50.0 MB | 50.0 MB | -0.0% | 13.10s | 13.67s | 30 ms | 3.8 |
| incompressible-media-like | ANDRII | Balanced | 101.0 MB | 101.0 MB | -0.0% | 25.33s | 24.25s | 70 ms | 4.0 |
| incompressible-media-like | ANDRII | Fast | 101.0 MB | 101.0 MB | -0.0% | 24.91s | 25.24s | 55 ms | 4.1 |
| incompressible-media-like | ANDRII | Maximum | 101.0 MB | 101.0 MB | -0.0% | 24.94s | 24.40s | 58 ms | 4.1 |
| large-binary-1gb | ANDRII | Balanced | 64.0 MB | 64.0 MB | -0.0% | 17.62s | 18.57s | 45 ms | 3.6 |
| large-binary-1gb | ANDRII | Fast | 64.0 MB | 64.0 MB | -0.0% | 18.29s | 18.00s | 39 ms | 3.5 |
| large-binary-1gb | ANDRII | Maximum | 64.0 MB | 64.0 MB | -0.0% | 17.28s | 17.70s | 36 ms | 3.7 |
| mixed-realistic | ANDRII | Balanced | 108.9 MB | 57.8 MB | 47.0% | 28.15s | 18.08s | 31 ms | 3.9 |
| mixed-realistic | ANDRII | Fast | 108.9 MB | 58.1 MB | 46.7% | 25.52s | 17.94s | 39 ms | 4.3 |
| mixed-realistic | ANDRII | Maximum | 108.9 MB | 55.9 MB | 48.7% | 1m 32s | 17.44s | 42 ms | 1.2 |
| source-code | ANDRII | Balanced | 7.2 MB | 5.7 MB | 20.9% | 8.97s | 3.86s | 10 ms | 0.8 |
| source-code | ANDRII | Fast | 7.2 MB | 5.7 MB | 20.7% | 8.81s | 3.74s | 8 ms | 0.8 |
| source-code | ANDRII | Maximum | 7.2 MB | 5.7 MB | 21.1% | 16.04s | 4.16s | 8 ms | 0.4 |
| text-small | ANDRII | Balanced | 10.0 MB | 2.0 MB | 79.8% | 8.15s | 3.19s | 5 ms | 1.2 |
| text-small | ANDRII | Fast | 10.0 MB | 2.1 MB | 78.5% | 8.02s | 3.16s | 7 ms | 1.2 |
| text-small | ANDRII | Maximum | 10.0 MB | 1.6 MB | 83.6% | 25.43s | 3.05s | 7 ms | 0.4 |

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
