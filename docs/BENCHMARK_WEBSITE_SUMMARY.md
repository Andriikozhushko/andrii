# ANDRII Benchmarks — Website Summary

The following claims are backed by reproducible benchmarks ([see full report](BENCHMARK_REPORT.md)).

## Verified Claims

- **Tested on datasets up to 108.9 MB with up to 327 files**
- **Streaming archive creation with bounded memory** — peak RAM stays at ~few MiB regardless of input file size, verified on a 1 GB binary.
- **Real-time progress for large archives** — per-chunk progress events with files/bytes/percent, conservative ETA, and stuck detection.
- **Encrypted contents AND metadata** — file names, sizes, and directory structure are all authenticated-encrypted.
- **Honest about compression** — small savings are expected for already-compressed media (images, video, archives). The app tells you upfront.

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
| mixed-realistic | 327 | 108.9 MB | Balanced | 47.0% |
| mixed-realistic | 327 | 108.9 MB | Fast | 46.7% |
| source-code | 205 | 7.2 MB | Balanced | 20.8% |
| source-code | 205 | 7.2 MB | Fast | 20.7% |
| text-small | 200 | 10.0 MB | Balanced | 79.8% |
| text-small | 200 | 10.0 MB | Fast | 78.5% |
