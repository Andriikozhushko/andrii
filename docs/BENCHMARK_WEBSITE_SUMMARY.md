# ANDRII — Benchmark Highlights (Website)

> All numbers below come from reproducible benchmarks. See the
> [full report](BENCHMARK_REPORT.md) for methodology, environment, and raw data.
> Figures are from a debug `--quick` run; compression ratios are identical in
> release builds (only timings differ).

## What we can honestly say

- **Strong compression for text, source code and documents** — up to ~84% smaller
  for text, ~47–59% for realistic mixed and many-small-file workloads.
- **Already-compressed media is stored raw on purpose** — images, video, audio,
  ZIP/PDF/EXE and similar formats are detected and skipped, so no CPU is wasted
  trying to shrink data that won't shrink (~0% on those, by design).
- **Encrypted contents *and* metadata** — file names, sizes and directory structure
  are all authenticated-encrypted, not just the file bytes.
- **Streaming archive creation with bounded memory** — peak RAM stays at a few MiB
  regardless of input file size (verified on a 1 GB file).
- **Real-time progress for large archives** — live file/byte/percent progress, a
  conservative time estimate, and "still working" detection.
- **Tested on 1 GB+ datasets** across six content types.

## What we do **not** claim

- ❌ Not "faster than 7-Zip" — we don't make speed-vs-competitor claims.
- ❌ Not "best compression" — dedicated archivers using *solid* compression can
  pack many small files tighter.
- ❌ Not "military grade" / "unbreakable".
- ❌ No cherry-picked numbers — every dataset's result is published, including the
  ~0% media cases.

## Compression by content type

| Content | Example | Typical savings (Balanced) |
|---|---|--:|
| Plain text | logs, notes, .txt/.md | ~80% |
| Many small source files | code repos, configs | ~50–59% |
| Realistic mixed | text + media + docs | ~47% |
| Source tree (few hundred KB files) | mixed repo copy | ~21% |
| Documents (already-zipped) | .docx/.pdf/.pptx | ~0% (stored raw) |
| Media | .jpg/.png/.mp4 | ~0% (stored raw) |

## Why a source tree is "only" ~21%

ANDRII compresses **each file independently** so every file gets its own
authenticated encryption and can be extracted on its own. Dedicated archivers use
**solid compression** (all files merged into a single stream), which compresses many
similar small files tighter but loses per-file random access and per-file
authenticated encryption. ANDRII trades a little ratio on small-file trees for
**per-file security and bounded-memory streaming** — and still compresses text,
source and documents well.
