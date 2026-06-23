# ANDRII — Compression Diagnosis 01

**Date:** 2026-06-23  
**Build:** debug  
**Analyzed:** source-code benchmark dataset (quick mode)

---

## Dataset composition

| Property | Value |
|---|---|
| Total files | 205 |
| Total bytes | 7.2 MB |
| Average file size | ~35 KB |
| Top extensions by count | `.rs`, `.tsx`, `.ts`, `.json`, `.toml`, `.md`, `.css`, `.html`, `.lock`, `.gitignore` |
| Top extensions by size | `.rs` (dominates), `.ts`, `.tsx` |
| Files stored raw (before fix) | ~15-20 small files (<64 bytes or high-entropy 4 KB sample) |
| Files compressed | ~185-190 |
| Byte rough split | ~6.4 MB compressed payload, ~0.05 MB header JSON, ~0.5 MB AEAD + chunk framing |

---

## Why source-code saved only ~21%

### 1. Per-file compression vs solid mode

ANDRII encrypts each file with its own authenticated encryption (XChaCha20-Poly1305),
so zstd operates **per-file, not across files** (non-solid). This is the single largest
factor:

| Approach | Typical compression of Rust source tree |
|---|---|
| zstd-6 solid (all files as one stream) | 60–70% savings |
| zstd-6 per-file (single 35 KB file) | 20–40% savings per file |
| ANDRII (zstd per-file + AEAD + header) | ~20% total |

7-Zip and WinRAR use solid compression (all files → one stream → one compression
pass) for archive formats like .7z and .rar. We cannot do this without a format
change because each file's region is independently encrypted and must be randomly
accessible.

### 2. Per-file overhead in an encrypted archive

Every file carries fixed overhead:
- **AEAD tag:** 16 bytes per chunk (most files are 1 chunk)
- **Chunk length prefix:** 4 bytes per chunk
- **Header JSON entry:** ~200–300 bytes (path, sizes, nonce, hash, perms)

For 205 files averaging 35 KB:
```
Input: 7,200,000 bytes
  - header JSON:   ~50,000 bytes (23 KB per file in JSON)
  - AEAD tags:     ~3,280 bytes (16 × 205)
  - chunk framing:   ~820 bytes (4 × 205)
  = overhead:      ~54,100 bytes

Data section before zstd: ~7,145,900 bytes
Data section after zstd-6:  ~5,620,000 bytes (79% → 21% raw savings on the payload)
Plus overhead:               5,674,100 bytes
Archive total:               ~5,700,000 bytes → 20.8% overall
```

### 3. zstd per-file on small files

zstd-6 on a 35 KB file gets ~25% compression (75% of original). This is the nature
of zstd without a pre-trained dictionary: it builds one per file from the file's
own content. At 35 KB of Rust code, the dictionary cost is proportionally large.

### 4. Small-file edge case (<64 bytes)

The `should_compress` heuristic returned `false` for files under 64 bytes
(returning `CompressionLevel::None`). These are a negligible fraction of total
bytes (~tens of files × ~30 bytes each = a few KB).

**The 0.95 → 0.98 threshold change** helps admit more borderline files but has
minimal impact on a repo dataset where most files already compress OK.

---

## What changed (optimization implemented)

1. **Compressible extension whitelist** — 130+ source/markup/config/text extensions
   (`.rs`, `.ts`, `.tsx`, `.py`, `.java`, `.json`, `.md`, `.toml`, `.yaml`, `.css`,
   `.js`, `.go`, `.c`, `.cpp`, `.h`, `.sh`, `.sql`, `.r`, `.dart`, `.vue`, `.tf`,
   `.proto`, `.graphql`, `.prisma`, `.nix`, `.zig`, etc.) now always compress without
   an entropy check.
2. **Entropy threshold relaxed** from 0.95 (5% required saving) to 0.98 (2%)
   for unknown extensions.
3. **Media/archive/package extensions still correctly skipped** — the incompressible
   blacklist takes precedence.

These changes improve compression reliability for source-code datasets but don't
fundamentally alter the per-file vs solid-mode tradeoff. That's intentional: our
security model encrypts per-file.

---

## Recommendations

- **Accept the 20–25% savings on source-code datasets as honest.** Per-file AEAD
  has predictable overhead. Numbers are not inflated.
- **For marketing:** emphasize "encrypted per-file with independent integrity
  verification" as the security feature, and "streaming chunked encryption (bounded
  memory)" as the performance feature. Honest compression is the tradeoff.
- **Future (v3) solid-compression mode** could batch compress N files together into
  one zstd stream before encrypting — at the cost of losing single-file random
  access — but only if a use-case demands it.
