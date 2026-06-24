# ANDRII — Solid-Mode Compression Feasibility Study

**Status:** Research / design (no production code changed)
**Date:** 2026-06-24
**Evidence:** `crates/andrii-core/examples/solid_poc.rs` → `benchmarks/results/solid-poc.json`

---

## Phase 1 — Why compression is "lost" today, and how much is recoverable

### Current architecture (v2)

```
file₁ → zstd(file₁) → AEAD(file₁)  ┐
file₂ → zstd(file₂) → AEAD(file₂)  ├─ independent regions, random-access
file₃ → zstd(file₃) → AEAD(file₃)  ┘
header: encrypted file table (path, offset, size, nonce, BLAKE3) per file
```

Each file is compressed **independently** (non-solid). This is what enables:
per-file authenticated encryption, single-file random access, and per-file
integrity verification — but it caps the compression ratio.

### Where ratio is lost

| Source of loss | Mechanism | Magnitude |
|---|---|---|
| **No cross-file dictionary** | zstd builds its dictionary from *one file*; shared patterns across files (imports, boilerplate, JSON keys) are re-learned per file. | **Dominant for small files.** |
| **Per-file zstd frame cost** | Each zstd stream has a frame header (~6–12 B) + must "warm up" its entropy model. | Small per file, large in aggregate for many files. |
| **Per-chunk AEAD tag** | 16 B Poly1305 tag + 4 B length prefix per 1 MiB chunk. | Tiny for big files; non-trivial for many 1-chunk files. |
| **Metadata boundary** | ~250 B encrypted header entry per file (path, sizes, nonce, hash, perms). | Fixed per file regardless of mode. |

### Measured recoverable gain (PoC, Maximum mode)

The PoC compresses each dataset both ways using the **real** zstd +
XChaCha20-Poly1305 primitives and reports honest byte counts:

| Dataset | Files | Avg file size | Per-file (current) | Solid (proposed) | **Gain** |
|---|--:|--:|--:|--:|--:|
| text-small | 200 | ~52 KB | 1.6 MB | 729.7 KB | **56.3%** |
| many-small-files | 2000 | ~2 KB | 1.5 MB | 862.6 KB | **44.5%** |
| mixed-realistic | 327 | ~340 KB | 55.9 MB | 42.7 MB | **23.6%** |
| source-code | 206 | ~35 KB | 5.7 MB | 5.3 MB | **6.9%** |
| documents-mixed¹ | 10 | 5 MB | 50.0 MB | 25.0 MB | 50.0%¹ |
| incompressible-media-like | 7 | ~14 MB | 101.0 MB | 100.5 MB | 0.5% |

¹ **Artifact warning:** the synthetic `documents-mixed` files share a repeated
`PK\x03\x04…` header injected by the generator; solid mode dedupes it across the
10 files. **Real** already-compressed PDF/DOCX would behave like media (~0%).
This row is *not* used in the recommendation.

### Key finding

> **The gain is inversely correlated with average file size.** Tiny files
> (many-small-files, ~2 KB avg → 44.5%) and highly-repetitive text (text-small →
> 56.3%) win big because per-file zstd has almost no dictionary to work with.
> Source-code at ~35 KB/file only gains **6.9%** — those files are already large
> enough that per-file zstd builds an adequate dictionary on its own.

This refines the original hypothesis: solid mode is a **large win for
many-small-file / text-heavy archives**, a **modest win for source trees**, and
**neutral for media**.

---

## Phase 2 — Architecture options

| | **A. Full solid** | **B. Solid groups** | **C. Maximum-only solid groups** *(recommended)* |
|---|---|---|---|
| Layout | All files → 1 zstd stream | Files bucketed into N bounded streams (e.g. by dir, ≤16 MB each) | Same as B, but **only** when user picks Maximum; Fast/Balanced stay per-file v2 |
| Compression gain | Max | ~Max (slightly less; bounded groups) | ~Max for Maximum mode; unchanged otherwise |
| Random access | ❌ Lost (decompress whole archive for 1 file) | ⚠️ Partial (decompress 1 group) | ⚠️ Partial in Maximum; ✅ full in Fast/Balanced |
| Memory (extract) | ❌ Whole stream | ✅ One group (bounded) | ✅ One group |
| Corruption blast radius | ❌ Whole archive | ✅ One group | ✅ One group |
| Selected-file extract | ❌ Must inflate everything | ⚠️ Inflate the file's group | ⚠️ Group (Max) / ✅ direct (Fast/Bal) |
| Complexity | Medium | High | **High but contained** (new path is opt-in) |
| Back-compat | v3 format | v3 format | v3 format, **v1/v2 still readable** |
| Security | Same primitives, larger AEAD scope | Same primitives, per-group AEAD | Same primitives, per-group AEAD |

**Why C wins:** it confines the random-access / blast-radius tradeoffs to the mode
the user *explicitly* chose for density (Maximum), while the common Fast/Balanced
paths keep v2's per-file random access unchanged. Groups bound memory and
corruption damage.

---

## Phase 3 — Security review

All options keep XChaCha20-Poly1305, Argon2id, BLAKE3 unchanged. Differences:

| Property | v2 per-file | Solid (A) | Solid groups (B/C) |
|---|---|---|---|
| AEAD boundary | per file | whole archive | **per group** |
| Per-file integrity | BLAKE3 per file, verified on extract | must hash after inflating whole stream | BLAKE3 per file (stored in metadata), verified after inflating the group |
| Tamper detection | per-chunk AEAD + per-file BLAKE3 | per-chunk AEAD over the one stream | **per-chunk AEAD per group** + per-file BLAKE3 |
| Corruption blast radius | 1 file | **all files** | **1 group** |
| Random access | ✅ | ❌ | ⚠️ group granularity |
| Metadata encryption | ✅ unchanged | ✅ unchanged | ✅ unchanged |

**Critical requirement preserved in B/C:** each file still carries its own BLAKE3
hash in the encrypted header. After a group is decrypted+inflated, every file's
bytes are re-hashed and checked → **fail-closed per-file integrity is retained**,
exactly as in v2. The chunk AEAD still authenticates ordering/truncation within a
group (index ‖ last-flag AAD, as in v2).

**Best architecture for ANDRII:** **Option C** — solid *groups*, Maximum mode only.
It keeps the security model identical (same AEAD/KDF/hash, per-file BLAKE3,
bounded blast radius) while unlocking the compression gain where it matters.

---

## Phase 6 — GO / NO-GO recommendation

### Recommendation: **CONDITIONAL GO** — design v3 now, implement behind Maximum mode

| Factor | Assessment |
|---|---|
| **Expected gain** | many-small-files **−44.5%**, text **−56%**, mixed **−24%**, source **−7%**, media **0%**. Big where files are small/numerous; modest for source trees; none for media. |
| **Engineering cost** | High-ish: new v3 writer + group-aware reader + extract-via-group path + tests. ~contained because v2 path is untouched and the new path is opt-in. |
| **Migration cost** | **Zero for users** — v1/v2 archives still open. v3 is only produced when Maximum is selected; readers gain a v3 branch. |
| **Resume value** | High: "designed a solid-compression archive mode with bounded-memory groups and retained per-file authenticated encryption + integrity." |
| **Website value** | Real, defensible: "Maximum mode uses solid compression for up to ~45% smaller archives on many-small-file workloads, while keeping per-file integrity." No 7-Zip-beating claim needed. |

### Caveats that shape the GO

1. **Source-code gain is only ~7%** — do not market this as "now competitive with
   7-Zip on source." The honest win is **many-small-files and text**.
2. **Documents:** real already-compressed office formats won't benefit (the 50% PoC
   row is a synthetic artifact). Only *uncompressed* text-like docs gain.
3. **Random access is reduced in Maximum** — single-file extract must inflate that
   file's group. Acceptable because the user opted into density. Fast/Balanced keep
   instant single-file extract.

### Decision

Proceed to **Phase 4 (v3 format design, this study's companion doc)** and keep the
**Phase 5 PoC** as the evidence base. **Do not** merge any solid code into the
production writer until a v3 implementation is separately reviewed and approved.
The current v2 format remains the default and only production path.

→ See [`ANDRII_V3_FORMAT_PROPOSAL.md`](ANDRII_V3_FORMAT_PROPOSAL.md).
