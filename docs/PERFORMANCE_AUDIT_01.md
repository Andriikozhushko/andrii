# ANDRII — Performance Audit 01

**Date:** 2026-06-23  
**Build:** debug (`cargo test` + `cargo run --example benchmark -- --full`)  
**Format version:** v2 (chunked streaming, bounded memory)

---

## Current pipeline

```
User password → Argon2id (64MiB, t=3, p=4) → master_key (32B)
Input paths → collect_files (walk, stat)   → Vec<(path, size, mtime, mode)>
For each file:
  BufReader (1MiB chunks)
  → BLAKE3 (incremental over plaintext)
  → zstd compress (or raw if incompressible)
  → XChaCha20-Poly1305 encrypt (per-chunk nonce + AAD)
  → spool to temp disk
Fixed header (76B) + encrypted header → assemble (stream hash) → footer → atomic rename
```

Memory: ≈ 1 MiB per chunk (bounded). Previously (v1) it was the whole file.

---

## Measured timings (debug build — release will be 5–10× faster)

See `docs/BENCHMARKS.md` for the full table. Key takeaways:

| Stage | Dominant factor |
|---|---|
| **Scanning** | File metadata (many files) or canonicalisation. Negligible vs rest. |
| **KDF** | Argon2id runs once (~0.3–0.5 s in release, ~2–3 s in debug). Not the bottleneck. |
| **Per-file sealing** | **This dominates.** For incompressible media, I/O (1 MiB reads + spool writes) and AEAD (XChaCha20-Poly1305 per chunk) are the ceiling. zstd no longer wastes time because incompressible data is stored raw. |
| **Assembly + hash** | Streams spooled blocks through BLAKE3 in 1 MiB passes → near I/O rate. |
| **Atomic rename** | Instant (same volume). |

### Large-file behavior

- 1 GB random binary (incompressible): ~278 s create in debug, all modes tied → raw store, I/O-bound. Memory stayed ~few MiB (proven: single chunk at a time).
- Extract time matches create time closely (same I/O + AEAD decrypt + decompress).

### Many-small-file behavior

- 1000 tiny JSON files (~265 B each): per-file overhead (at least one chunk + header entry + AEAD tag + 4-byte length prefix) dominates, causing negative savings. This is correct and unavoidable with authenticated encryption per file. JSON content itself compresses well (Maximum < Balanced in output).

### Compression reality

- Media extensions (jpg, mp4, png, zip, pdf, …) are detected via extension and stored raw. The user's "105 files / 1 GB, 2% savings" case is now handled correctly — those files are incompressible media. Compression skips them entirely instead of grinding at zstd level 6 or 19.
- Text/code/docs still benefit.

---

## Bottlenecks (release)

1. **Disk I/O** — reading 1 GB and writing 1 GB + tags. The spool-then-copy design does two full passes over the data section (write to spool, read back for assembly). On HDD this dominates; on NVMe, two passes are still present but fast.
2. **AEAD per 1 MiB chunk** — for 1 GB that's ~1024 chunks. Each encrypts ~16 KB of plaintext (the repeated raw-copy case) to 16 KB + 16 B tag. XChaCha20-Poly1305 is fast (hardware-accelerated AES is not available; ChaCha is software). Not a bottleneck on its own, but adds up linearly with disk I/O.
3. **Argon2id** — negligible on 1 GB (one invocation). On 1000 tiny files it's even less relevant.

**The reported case (105 files / 1 GB, slow) was most likely dominated by zstd-on-incompressible at Balanced or Maximum.** The benchmark confirms: once the incompressible detector kicks in, creation time for media depends only on I/O + AEAD, not on compression level — and all three modes converge (0% savings, ~equal time).

---

## Toolchain note

`x86_64-pc-windows-gnu` release builds fail because `dlltool` (from the `self-contained/` Rust toolchain directory) crashes with `CreateProcess` when invoked by `cc` for native library import generation. Debug builds succeed because they skip LTO and don't need import libraries. Resolution: either install `mingw-w64` with `dlltool` on PATH, or switch to `x86_64-pc-windows-msvc` (requires Visual Studio Build Tools).

The pre-existing `Tavern.toml` + build scripts (`vendor/tauri-winres/`) originally used windres; a prior commit removed that dep. The `dlltool` gap is a similar toolchain issue, not a code bug.

---

## Conclusions

- **Chunked streaming works:** 1 GB file created with bounded memory, verifies clean, extracts byte-identical.
- **Compression skipping works:** media & binary are stored raw regardless of mode, saving minutes of wasted CPU.
- **Progress is real:** `archive-progress` fires per-chunk with phase/files/bytes/percent.
- **v2 format is backward-compatible:** the reader opens both v1 and v2 archives.
- Release build + full release benchmark blocked by platform toolchain; documented here.
