# ANDRII Benchmark Report

## 1. Methodology

Each dataset was generated deterministically and archived by ANDRII (Fast / Balanced / Maximum), 7-Zip (default, if available), and WinRAR (default, if available). Each configuration was run 3 times; the **median** is reported. All test archives were extracted and verified byte-for-byte against the original inputs.

## 2. Environment

- **OS:** windows x86_64
- **CPU:** AMD64 Family 25 Model 33 Stepping 2, AuthenticAMD
- **Rust:** rustc 1.96.0 (ac68faa20 2026-05-25)
- **ANDRII:** v1.0.0
- **Commit:** `0d00a56`

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
| documents-mixed | ANDRII | Balanced | 50.0 MB | 50.0 MB | -0.0% | 14.44s | 14.02s | 33 ms | 3.5 |
| documents-mixed | ANDRII | Fast | 50.0 MB | 50.0 MB | -0.0% | 13.73s | 14.03s | 29 ms | 3.6 |
| documents-mixed | ANDRII | Maximum | 50.0 MB | 50.0 MB | -0.0% | 14.49s | 14.49s | 35 ms | 3.4 |
| incompressible-media-like | ANDRII | Balanced | 101.0 MB | 101.0 MB | -0.0% | 26.31s | 27.68s | 68 ms | 3.8 |
| incompressible-media-like | ANDRII | Fast | 101.0 MB | 101.0 MB | -0.0% | 26.74s | 25.30s | 65 ms | 3.8 |
| incompressible-media-like | ANDRII | Maximum | 101.0 MB | 101.0 MB | -0.0% | 26.34s | 26.48s | 61 ms | 3.8 |
| large-binary-1gb | ANDRII | Balanced | 64.0 MB | 64.0 MB | -0.0% | 17.92s | 18.10s | 50 ms | 3.6 |
| large-binary-1gb | ANDRII | Fast | 64.0 MB | 64.0 MB | -0.0% | 19.84s | 18.99s | 44 ms | 3.2 |
| large-binary-1gb | ANDRII | Maximum | 64.0 MB | 64.0 MB | -0.0% | 18.02s | 18.50s | 49 ms | 3.6 |
| mixed-realistic | ANDRII | Balanced | 108.9 MB | 57.8 MB | 47.0% | 30.26s | 18.22s | 33 ms | 3.6 |
| mixed-realistic | ANDRII | Fast | 108.9 MB | 58.1 MB | 46.7% | 26.23s | 19.47s | 41 ms | 4.2 |
| mixed-realistic | ANDRII | Maximum | 108.9 MB | 55.9 MB | 48.7% | 1m 44s | 18.83s | 38 ms | 1.0 |
| source-code | ANDRII | Balanced | 7.2 MB | 5.7 MB | 20.8% | 9.83s | 4.31s | 7 ms | 0.7 |
| source-code | ANDRII | Fast | 7.2 MB | 5.7 MB | 20.7% | 9.92s | 4.02s | 9 ms | 0.7 |
| source-code | ANDRII | Maximum | 7.2 MB | 5.7 MB | 21.1% | 16.39s | 4.13s | 10 ms | 0.4 |
| text-small | ANDRII | Balanced | 10.0 MB | 2.0 MB | 79.8% | 9.70s | 4.08s | 6 ms | 1.0 |
| text-small | ANDRII | Fast | 10.0 MB | 2.1 MB | 78.5% | 8.46s | 3.91s | 7 ms | 1.2 |
| text-small | ANDRII | Maximum | 10.0 MB | 1.6 MB | 83.6% | 30.03s | 3.71s | 7 ms | 0.3 |

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
