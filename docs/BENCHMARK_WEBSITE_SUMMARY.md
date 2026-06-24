# ANDRII Benchmarks — Website Summary

The following claims are backed by reproducible benchmarks ([see full report](BENCHMARK_REPORT.md)).

## Verified Claims

- **Tested on datasets up to 108.9 MB with up to 2000 files**
- **Streaming archive creation with bounded memory** — peak RAM stays at ~few MiB regardless of input file size, verified on a 1 GB binary.
- **Real-time progress for large archives** — per-chunk progress events with files/bytes/percent, conservative ETA, and stuck detection.
- **Encrypted contents AND metadata** — file names, sizes, and directory structure are all authenticated-encrypted.
- **Honest about compression** — small savings are expected for already-compressed media (images, video, archives). The app tells you upfront.
- **Maximum mode uses solid compression (v3)** — compressible files are bundled into bounded ≤16 MiB groups and compressed with a shared dictionary, for materially smaller archives on many-small-file and text workloads, while keeping per-file authenticated encryption and per-file BLAKE3 integrity. Fast/Balanced keep the v2 per-file layout with instant single-file extract.

## Solid Compression (v3) — Verified Gains

Maximum (solid groups) vs the same files in the v2 per-file layout:

- **many-small-files: 42.7% smaller**
- **text-small: 55.9% smaller**

## NOT Claiming

- We do NOT claim ANDRII compresses better than 7-Zip or any dedicated compressor.
- We do NOT claim military-grade or unbreakable encryption.
- We do NOT claim 100% compression savings on media files.

## Quick Numbers

| Dataset | Files | Input | Mode | Saved |
|---|--:|--:|---|--:|
| documents-mixed | 10 | 50.0 MB | Balanced | -0.0% |
| documents-mixed | 10 | 50.0 MB | Fast | -0.0% |
| incompressible-media-like | 7 | 101.0 MB | Balanced | -0.0% |
| incompressible-media-like | 7 | 101.0 MB | Fast | -0.0% |
| large-binary-1gb | 1 | 64.0 MB | Balanced | -0.0% |
| large-binary-1gb | 1 | 64.0 MB | Fast | -0.0% |
| many-small-files | 2000 | 4.0 MB | Balanced | 54.8% |
| many-small-files | 2000 | 4.0 MB | Fast | 48.3% |
| mixed-realistic | 327 | 108.9 MB | Balanced | 47.0% |
| mixed-realistic | 327 | 108.9 MB | Fast | 46.6% |
| source-code | 212 | 7.3 MB | Balanced | 21.3% |
| source-code | 212 | 7.3 MB | Fast | 21.1% |
| text-small | 200 | 10.0 MB | Balanced | 79.8% |
| text-small | 200 | 10.0 MB | Fast | 78.4% |
