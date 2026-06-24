# ANDRII v3 Format Proposal — Solid Groups (Maximum mode)

**Status:** Proposal / design only. **Not implemented. Not the default writer.**
**Companion to:** [`SOLID_MODE_FEASIBILITY.md`](SOLID_MODE_FEASIBILITY.md)
**Evidence:** `benchmarks/results/solid-poc.json`

This document specifies a v3 archive format that adds **solid group compression**
for Maximum mode while preserving every existing security and compatibility
guarantee. It is intentionally additive: v3 reuses the v2 fixed header, footer,
crypto primitives, and the encrypted-header JSON envelope.

---

## 1. Design goals & non-goals

**Goals**
- Solid (cross-file) compression for the Maximum mode → ~24–56% smaller on
  text/many-small-file archives (per PoC).
- Preserve: XChaCha20-Poly1305, Argon2id, BLAKE3, metadata encryption,
  per-file integrity, bounded-memory streaming.
- **v1 and v2 archives remain fully readable** by the v3 reader.

**Non-goals**
- No change to Fast/Balanced — they stay byte-for-byte v2 (per-file, random access).
- No new crypto. No weaker AEAD scope than "per group".
- Not a single monolithic stream (Option A is rejected — unbounded blast radius).

---

## 2. Compatibility model

| Reader → Writer | v1 archive | v2 archive | v3 archive |
|---|---|---|---|
| **v3 reader** (target) | ✅ existing path | ✅ existing path | ✅ new group path |
| v2 reader (old) | ✅ | ✅ | ❌ rejects via version check |
| v1 reader (old) | ✅ | ❌ | ❌ |

`FixedHeader.version` gates the read path (already implemented for v1/v2 in
`reader.rs`). v3 adds a third branch. Old readers correctly refuse v3
(`UnsupportedVersion`) — fail-closed, never mis-parse.

```
FORMAT_VERSION: 1 → 2 → 3   (writer emits 3 only when mode == Maximum && solid worthwhile)
```

A v3 writer **falls back to v2 layout** when solid grouping wouldn't help (e.g.
all-media archive, or a single large file) so v3 is never worse than v2.

---

## 3. On-disk layout

Unchanged framing: `[FixedHeader 76B][EncryptedHeader][Data section][Footer 548B]`.
Only the **data section** and the **encrypted header's entries** change.

### v2 data section (today)
```
[ file₁ chunks ][ file₂ chunks ] … each file independently zstd'd + AEAD'd
```

### v3 data section (proposed)
```
[ group₀ chunks ][ group₁ chunks ] … each GROUP is one zstd stream, chunk-AEAD'd
```

A **group** is the concatenation of N files' plaintext, compressed as **one** zstd
stream, then split into 1 MiB chunks and sealed exactly like v2 chunks
(nonce = base16 ‖ chunk_index, AAD = chunk_index ‖ last_flag). Files that are
incompressible (media/raw) are **not** grouped — they remain per-file v2-style
regions in the same archive.

---

## 4. Metadata (encrypted header) changes

All additive, all `#[serde(default)]` so the JSON envelope stays
forward/backward tolerant.

### New: `GroupEntry` (one per solid group)
```rust
struct GroupEntry {
    group_id: u32,            // 0-based
    data_offset: u64,         // offset of the group's first chunk in the data section
    chunk_count: u64,         // 1 MiB chunks in this group
    stored_size: u64,         // on-disk bytes (Σ chunk ciphertext + prefixes + tags)
    content_nonce: String,    // base64url 16-byte base nonce (chunk counter appended)
    compressed_size: u64,     // post-zstd, pre-encryption (honest ratio display)
    uncompressed_size: u64,   // Σ original file sizes in the group
}
```

### Extended: `FileEntry` (additive fields, default 0/false/empty)
```rust
// existing v2 fields unchanged …
#[serde(default)] group_id: Option<u32>,      // Some(g) → file lives in solid group g
#[serde(default)] group_offset: u64,          // byte offset of this file within the
                                              //   group's *decompressed* plaintext
// when group_id is None the file is a v2-style per-file region (unchanged path)
```

A file is located by: decrypt+inflate `group_id`'s stream → slice
`[group_offset .. group_offset + original_size]` → verify `blake3_hash`.

`blake3_hash` (per-file) and `original_size` are **retained unchanged**, so
per-file fail-closed integrity is identical to v2.

---

## 5. Integrity model (unchanged guarantees)

| Layer | Mechanism | v3 behavior |
|---|---|---|
| Chunk ordering/truncation | AEAD AAD = `chunk_index ‖ last_flag` | per group (same as v2 per file) |
| Group authenticity | XChaCha20-Poly1305 tag per chunk | unchanged primitive |
| **Per-file integrity** | BLAKE3 of original file bytes, stored in `FileEntry` | **verified after inflating the group**, fail-closed |
| Whole-archive | BLAKE3 over everything before footer → footer | unchanged |
| Header authenticity | AEAD, AAD = fixed header bytes | unchanged |

No integrity guarantee is weakened. The only behavioral change: a corrupt group
chunk fails the **whole group** (blast radius = one group, not one file) — an
explicit, bounded tradeoff of Maximum mode.

---

## 6. Grouping policy (writer)

```
1. Scan files; classify each via decide_level():
     incompressible (media/archive/pkg)  → per-file region (v2 path, group_id=None)
     compressible (source/text/doc/etc.) → eligible for grouping
2. Bucket eligible files into groups, bounded by:
     - max group plaintext ≤ 16 MiB  (bounds extract memory + blast radius)
     - prefer grouping files that share a top-level dir (locality → better ratio)
3. Per group: concat plaintext (stable sorted by path) → zstd(level=19) → chunk-AEAD.
4. Emit GroupEntry + per-file (group_id, group_offset, blake3_hash, original_size).
5. If only one tiny group results, or grouping doesn't beat per-file, write v2 layout.
```

16 MiB groups keep peak extract memory bounded (one inflated group) and limit
corruption blast radius, while still capturing the cross-file dictionary gain
(PoC groups were whole-dataset and saw 44–56%; 16 MiB buckets capture most of it).

---

## 7. Extraction (reader)

```
Single file in group g:
  read g's chunks at GroupEntry.data_offset
  → decrypt each chunk (verify AEAD) → zstd-inflate stream (bounded: 16 MiB)
  → slice [group_offset .. +original_size] → verify BLAKE3 → write (atomic temp+rename)

Extract-all:
  inflate each group once, slice out all its files, verify each, write.
  (more efficient than v2 for grouped files — one inflate serves many files)

v1/v2 files (group_id == None): unchanged per-file path.
```

Random-access cost for a single grouped file = inflate its ≤16 MiB group. For
Fast/Balanced (no groups) random access is unchanged from v2.

---

## 8. What is NOT decided here

- Exact bucketing heuristic (by-dir vs by-size-bin vs greedy-fill) — to be tuned
  against the PoC datasets during implementation.
- Whether to expose group size as an advanced setting (default 16 MiB).
- Dictionary training (`zstd --train`) — a possible future refinement, out of scope.

---

## 9. Implementation checklist (when/if approved)

- [ ] `FORMAT_VERSION = 3`; `GroupEntry`; additive `FileEntry` fields (serde default).
- [ ] v3 writer behind `CompressionLevel::Maximum` only; v2 fallback when not worthwhile.
- [ ] v3 reader branch; v1/v2 branches untouched.
- [ ] Verifier accepts version 3.
- [ ] Tests: v3 round-trip, per-file BLAKE3 verify within group, group tamper →
      fail-closed, single-file extract from group, v1/v2 back-compat, "fallback to
      v2 when grouping doesn't help".
- [ ] Benchmark: v3 Maximum vs v2 Maximum on source-code, many-small-files, text.
- [ ] Honest UI/result copy ("Maximum: solid compression, slower single-file extract").

**Until all of the above pass review, v2 remains the sole production format.**
