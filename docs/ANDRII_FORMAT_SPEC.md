# ANDRII Archive Format Specification

**Format Name:** ANDRII Secure Archive  
**File Extension:** `.andrii`  
**Current Version:** 3 (writer emits v2 for Fast/Balanced, v3 for Maximum; reader opens v1/v2/v3)  
**Document Version:** 1.2  
**Status:** Implemented

> **Note.** Sections §2–§8 describe the v1 baseline. Chunked streaming (v2) and
> solid groups (v3) are additive and documented in **§11**. The reader selects
> the read path from `FixedHeader.version`; v1, v2 and v3 archives all open.

---

## 1. Overview

The `.andrii` format is a self-describing, versioned, encrypted archive format. All file content, file names, directory structure, and metadata are encrypted with authenticated encryption. The format is designed for long-term extensibility and forward compatibility.

### Design Principles

- **Encrypt everything possible** — file names, paths, sizes, timestamps, and content are all encrypted
- **Authenticate everything** — AEAD prevents undetected tampering
- **Minimal unencrypted surface** — only what is required to begin decryption is in plaintext
- **Single-key simplicity** — one password derives all necessary keys
- **Streaming-friendly** — data blocks can be extracted independently without reading the entire archive
- **Fail closed** — wrong password and corruption are indistinguishable to the caller

---

## 2. Archive Layout

```
┌─────────────────────────────────────────────────────────────┐
│  FIXED HEADER (74 bytes, plaintext)                         │
│  ─ Magic bytes: "ANDRII"                                    │
│  ─ Format version                                           │
│  ─ Archive flags                                            │
│  ─ KDF salt                                                 │
│  ─ Header nonce                                             │
│  ─ Encrypted header length                                  │
├─────────────────────────────────────────────────────────────┤
│  ENCRYPTED HEADER BLOCK (variable, AEAD-authenticated)      │
│  ─ Archive metadata (name, creation time, creator)          │
│  ─ Compression algorithm identifier                         │
│  ─ File entry table (one entry per file)                    │
│    Each entry: path, sizes, nonce, offset, hash, timestamps │
├─────────────────────────────────────────────────────────────┤
│  DATA SECTION (variable)                                    │
│  ─ File Block 0: compressed + encrypted file content        │
│  ─ File Block 1: compressed + encrypted file content        │
│  ─ ...                                                      │
│  ─ File Block N                                             │
├─────────────────────────────────────────────────────────────┤
│  FOOTER (548 bytes, plaintext)                              │
│  ─ Footer magic                                             │
│  ─ Archive integrity hash (BLAKE3 of all preceding bytes)   │
│  ─ Signature block (reserved, zeroed in v1)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Fixed Header (74 bytes)

All multi-byte integers are little-endian.

| Offset | Length | Type     | Name              | Description                                |
|--------|--------|----------|-------------------|--------------------------------------------|
| 0      | 6      | [u8; 6]  | `magic`           | ASCII `ANDRII` (0x41 0x4E 0x44 0x52 0x49 0x49) |
| 6      | 2      | u16 LE   | `version`         | Format version (currently `1`)             |
| 8      | 4      | u32 LE   | `flags`           | Archive flags (see §3.1)                   |
| 12     | 32     | [u8; 32] | `kdf_salt`        | Argon2id salt (random, generated at create time) |
| 44     | 24     | [u8; 24] | `header_nonce`    | XChaCha20-Poly1305 nonce for header block  |
| 68     | 8      | u64 LE   | `enc_header_len`  | Byte length of the encrypted header block  |

**Total: 76 bytes**

### 3.1 Flags Field (u32)

| Bit | Name               | Meaning when set          |
|-----|--------------------|---------------------------|
| 0   | `HAS_SIGNATURE`    | Footer signature block is populated |
| 1   | `COMPRESSED_HEADER`| Header block is also zstd-compressed before encryption (v2+) |
| 2   | `MULTI_RECIPIENT`  | Archive has per-recipient key wrapping (v2+) |
| 3-31| Reserved           | Must be zero in v1; parsers must reject if set and version < 2 |

---

## 4. Encrypted Header Block

### 4.1 Encryption

```
key         = Argon2id(password, kdf_salt, m=65536, t=3, p=4) → [u8; 32]
nonce       = fixed_header.header_nonce                        → [u8; 24]
aad         = fixed_header bytes [0..76]                       → [u8; 76]
plaintext   = JSON-serialized EncryptedHeader
ciphertext  = XChaCha20-Poly1305.encrypt(key, nonce, plaintext, aad)
```

The associated data (AAD) binds the header ciphertext to this specific archive's fixed header. Copying the encrypted header to a different archive file would cause authentication failure.

The stored encrypted header block is: `ciphertext || poly1305_tag` (16-byte tag appended by the AEAD).

### 4.2 Plaintext Structure (JSON)

```json
{
  "archive_name": "my-backup",
  "created_at": 1750000000,
  "creator_version": "andrii/0.1.0",
  "compression": "Zstd",
  "argon2_params": {
    "m_cost": 65536,
    "t_cost": 3,
    "p_cost": 4
  },
  "extra": {},
  "entries": [
    {
      "path": "documents/report.pdf",
      "original_size": 1048576,
      "compressed_encrypted_size": 524320,
      "content_nonce": "base64url-encoded-24-bytes",
      "data_offset": 0,
      "blake3_hash": "hex-encoded-32-bytes",
      "modified_at": 1749999000,
      "unix_mode": 420
    }
  ]
}
```

### 4.3 EncryptedHeader Fields

| Field | Type | Description |
|-------|------|-------------|
| `archive_name` | string | User-provided archive name (no extension) |
| `created_at` | u64 | Unix timestamp of creation (seconds) |
| `creator_version` | string | Application version that created the archive |
| `compression` | string enum | `"Zstd"`, `"None"` (future: `"Brotli"`, `"Lz4"`) |
| `argon2_params` | object | KDF parameters used (for future re-keying) |
| `extra` | object | Reserved for future extensibility; must be ignored if unknown keys present |
| `entries` | array | File entry table (see §4.4) |

### 4.4 FileEntry Fields

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Relative path using forward slashes, UTF-8 |
| `original_size` | u64 | Size of original file content in bytes |
| `compressed_encrypted_size` | u64 | Size of the stored block (compressed + encrypted, including 16-byte tag) |
| `content_nonce` | string | Base64url-encoded 24-byte XChaCha20 nonce for this file |
| `data_offset` | u64 | Byte offset within the data section where this file's block begins |
| `blake3_hash` | string | Hex-encoded BLAKE3 hash of the **original** (pre-compression, pre-encryption) content |
| `modified_at` | u64 | File modification time as Unix timestamp |
| `unix_mode` | u32 | Unix permission bits (e.g., 0o644 = 420); zero on Windows |

---

## 5. Data Section

The data section immediately follows the encrypted header block. It contains file blocks in the order they appear in `entries`.

### 5.1 File Block Format

Each file block is:

```
compressed_content = Zstd.compress(original_file_bytes, level)
encrypted_block    = XChaCha20-Poly1305.encrypt(
    key   = master_key,
    nonce = entry.content_nonce,
    plain = compressed_content,
    aad   = entry.blake3_hash (32 bytes)
)
stored = encrypted_block || poly1305_tag   (tag is 16 bytes)
```

`compressed_encrypted_size` = `len(compressed_content) + 16`

The AAD for file content is the BLAKE3 hash of the original file. This cryptographically binds each data block to its metadata entry: swapping content blocks between files would cause authentication failure on extraction.

### 5.2 Data Section Offset

```
data_section_start = 76 + enc_header_len
file_block_absolute_offset = data_section_start + entry.data_offset
```

---

## 6. Footer (548 bytes)

| Offset | Length | Type      | Name               | Description                              |
|--------|--------|-----------|--------------------|------------------------------------------|
| 0      | 4      | [u8; 4]   | `footer_magic`     | ASCII `ENDR` (0x45 0x4E 0x44 0x52)      |
| 4      | 32     | [u8; 32]  | `archive_hash`     | BLAKE3 hash of all bytes before the footer |
| 36     | 512    | [u8; 512] | `signature_block`  | Reserved for digital signature (zeroed in v1) |

**Total: 548 bytes**

### 6.1 Archive Hash

```
archive_hash = BLAKE3(archive_bytes[0 .. footer_start])
```

This hash covers the fixed header, encrypted header block, and all data blocks. It does not cover the footer itself to avoid a circular dependency.

A verifier should:
1. Read the last 548 bytes as the footer
2. Validate `footer_magic == b"ENDR"`
3. Compute BLAKE3 of everything before the footer
4. Compare to `archive_hash`

### 6.2 Signature Block (Reserved)

In format version 1, the 512-byte signature block is all zeros. A parser must not reject archives where this field is non-zero (forward compatibility).

In a future version (when `HAS_SIGNATURE` flag is set), this block will contain an Ed25519 or similar signature over the archive hash, signed by the creator's private key. The public key or key identifier will be stored in the encrypted header's `extra` field.

---

## 7. KDF Parameters

### 7.1 Argon2id Default Parameters (v1)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Algorithm | Argon2id | Hybrid, memory-hard |
| `m_cost` | 65536 KiB | 64 MiB memory usage |
| `t_cost` | 3 | 3 iterations |
| `p_cost` | 4 | 4 parallel lanes |
| `output_len` | 32 bytes | 256-bit master key |
| `version` | 0x13 | Argon2 version 1.3 |

These parameters are stored in the encrypted header. A future implementation may use higher parameters (the decryptor reads them from the archive, not hardcoded defaults).

### 7.2 Brute-Force Resistance

With these parameters, a single Argon2id computation requires:
- ~64 MiB of RAM
- ~100-500ms on a modern CPU
- GPU acceleration is severely limited by memory requirements

---

## 8. Parsing Algorithm

### 8.1 Opening an Archive

```
1. Read bytes [0..6]: check magic == b"ANDRII"
   → FAIL: "Not a valid ANDRII archive"

2. Read bytes [6..8]: version = u16_le
   → if version > SUPPORTED_VERSION: FAIL: "Archive version X not supported"

3. Read bytes [8..12]: flags = u32_le
   → if (flags & KNOWN_FLAGS_MASK) != flags and version <= OWN_VERSION:
       FAIL: "Unknown archive flags"

4. Read bytes [12..44]: kdf_salt
5. Read bytes [44..68]: header_nonce
6. Read bytes [68..76]: enc_header_len

7. Derive master_key = Argon2id(password, kdf_salt, params)

8. Read bytes [76 .. 76+enc_header_len]: encrypted_header_block

9. Decrypt:
   plaintext = XChaCha20_Poly1305.decrypt(
       key   = master_key,
       nonce = header_nonce,
       ct    = encrypted_header_block,
       aad   = archive_bytes[0..76]
   )
   → FAIL (authentication): "Invalid password or corrupted archive"

10. Parse JSON: encrypted_header = JSON.parse(plaintext)

11. Present encrypted_header.entries to the user.
```

### 8.2 Extracting a File

```
1. entry = selected FileEntry
2. data_section_start = 76 + enc_header_len
3. abs_offset = data_section_start + entry.data_offset
4. Read bytes [abs_offset .. abs_offset + entry.compressed_encrypted_size]
5. nonce = base64url_decode(entry.content_nonce)
6. aad = hex_decode(entry.blake3_hash)
7. compressed = XChaCha20_Poly1305.decrypt(key=master_key, nonce, ct, aad)
   → FAIL (auth): "File content corrupted or tampered"
8. original = Zstd.decompress(compressed)
9. actual_hash = BLAKE3(original)
10. assert actual_hash == hex_decode(entry.blake3_hash)
    → FAIL: "File integrity check failed"
11. Write original bytes to output path.
```

### 8.3 Verifying an Archive

```
1. Perform step 1-6 of §8.1 (no password required for structure check)
2. Read footer: last 548 bytes
3. Check footer_magic == b"ENDR"
   → FAIL: "Footer corrupt or missing"
4. Compute actual_hash = BLAKE3(archive_bytes[0 .. file_len - 548])
5. Check actual_hash == footer.archive_hash
   → FAIL: "Archive integrity check failed (data may be corrupted)"
6. If password provided: proceed with §8.1 decryption to verify header
7. PASS: "Archive integrity verified"
```

---

## 9. Versioning Strategy

### 9.1 Minor Changes (same major version)

- New fields in the `extra` JSON object → unknown fields MUST be ignored by older parsers
- New flag bits → older parsers reject if flag bit set (security: unknown feature may change semantics)
- New compression algorithms → rejected by older parsers (unknown enum variant in `compression`)

### 9.2 Major Version Changes

A new format version may change:
- The fixed header layout (new fields, different sizes)
- The encryption scheme
- The data block format

An older parser encountering a newer version MUST refuse to open the archive with a clear error: `"Archive version N requires ANDRII vX.Y or later"`.

### 9.3 Version History

| Version | Description |
|---------|-------------|
| 1 | Initial format: XChaCha20-Poly1305, Argon2id, Zstd, JSON header. One compressed+encrypted block per file (whole-file buffered). |
| 2 | Per-file **chunked streaming**: each file is a sequence of independently-sealed 1 MiB chunks (nonce = base16 ‖ chunk_index, AAD = chunk_index ‖ last_flag). Bounds create/extract memory to ~one chunk. Random-access per file. |
| 3 | **Solid groups for Maximum mode only.** Compressible, small-enough files are bundled into ≤16 MiB groups compressed as one zstd stream; incompressible/large files stay per-file (v2-style). Fast/Balanced still write v2. Per-file BLAKE3 integrity retained. See §11. |

---

## 10. Security Considerations

### 10.1 Nonce Reuse

XChaCha20-Poly1305 requires unique nonces per (key, nonce) pair. ANDRII generates nonces using a cryptographically secure random number generator (`getrandom` via `rand::CryptoRng`). The 192-bit nonce space makes birthday collisions negligible (2^96 archives before 50% probability of nonce reuse with the same key).

### 10.2 Metadata Leakage

The following is **not** hidden from an adversary without the password:

- The total size of the archive file
- The approximate number of files (inferrable from encrypted header length + data block sizes)
- KDF parameters (intentionally exposed for key derivation)

The following **is** hidden:

- File names, paths, and directory structure
- Individual file sizes
- File content
- File timestamps and permissions
- Archive name and creation time

### 10.3 Chosen-Ciphertext Attacks

The Poly1305 authentication tag provides integrity. Any modification to the ciphertext causes decryption to fail before any plaintext is returned. Callers never see partially decrypted output.

### 10.4 Padding

Individual file blocks are not padded. An adversary can observe the distribution of encrypted block sizes, which may reveal file count and approximate sizes. Padding is reserved for a future "stealth" mode via the flags field.

---

## 11. Chunked Streaming (v2) and Solid Groups (v3)

Both v2 and v3 reuse the v1 framing — `[FixedHeader][EncryptedHeader][Data section][Footer]` — the same crypto primitives (XChaCha20-Poly1305, Argon2id, BLAKE3), and the same encrypted JSON header envelope. Only the **data section** and a few **additive, `serde(default)` header fields** change. Older fields keep their meaning; new fields default to `0` / `false` / `null` / `[]`, so a v3 reader transparently reads v1 and v2.

### 11.1 v2 — per-file chunked regions

Each file's content is split into 1 MiB plaintext chunks, each sealed independently:

```
chunk_nonce  = base16 ‖ chunk_index (u64 BE)          # 16 + 8 = 24 bytes
chunk_aad    = chunk_index (u64 BE) ‖ last_flag (u8)  # 9 bytes
sealed_chunk = XChaCha20-Poly1305(key, chunk_nonce, zstd(chunk)?, chunk_aad)
on-disk      = u32_le(len(sealed_chunk)) ‖ sealed_chunk     # length-prefixed
```

The AAD binds chunk **ordering** and **truncation** (the last chunk's `last_flag = 1`). `FileEntry` gains: `chunk_count` (chunks in this file), `stored_raw` (content stored without zstd — already-compressed data), and `compressed_size` (post-zstd, pre-encryption payload, for honest ratio display). Create and extract hold ~one chunk at a time regardless of file size.

### 11.2 v3 — solid groups (Maximum mode only)

The writer emits v3 **only** when the user selects Maximum *and* grouping is worthwhile (≥1 group of ≥2 files); otherwise it writes v2. Compressible files no larger than `GROUP_TARGET` (16 MiB) are bucketed (sorted by path for directory locality, greedy-filled to ≤16 MiB uncompressed). Each group is:

```
plaintext  = file₀ ‖ file₁ ‖ … (concatenated, in bucket order)
stream     = zstd(plaintext, level 19)        # or raw plaintext if incompressible
            → split into 1 MiB chunks, sealed exactly as a v2 region
```

Incompressible (media/archive/package) and large files are **not** grouped — they remain v2-style per-file regions in the same archive.

#### New `GroupEntry` (one per group, in the encrypted header)

| Field | Type | Description |
|-------|------|-------------|
| `group_id` | u32 | 0-based group id, matched by `FileEntry.group_id` |
| `data_offset` | u64 | Offset of the group's first chunk in the data section |
| `chunk_count` | u64 | Number of 1 MiB chunks in the group stream |
| `stored_size` | u64 | On-disk region bytes (Σ ciphertext + length prefixes + tags) |
| `content_nonce` | string | Base64url 16-byte base nonce (chunk counter appended) |
| `compressed_size` | u64 | Post-zstd, pre-encryption stream size |
| `uncompressed_size` | u64 | Σ original member sizes (≤ `GROUP_TARGET`); inflate capacity bound |
| `stored_raw` | bool | True when the group was stored without zstd (incompressible) |

#### Additive `FileEntry` fields

| Field | Type | Description |
|-------|------|-------------|
| `group_id` | u32? | `Some(g)` → file lives in group `g`; `None` (default) → per-file region |
| `group_offset` | u64 | Byte offset of this file within the group's **decompressed** plaintext |

A grouped file is located by: inflate `group_id`'s stream → slice `[group_offset .. group_offset + original_size]` → verify `blake3_hash`. `blake3_hash` and `original_size` are unchanged from v2, so **per-file fail-closed integrity is identical**.

### 11.3 Integrity & blast radius

- **Chunk ordering/truncation** — AEAD AAD = `chunk_index ‖ last_flag`, per group (same mechanism as a v2 file).
- **Per-file integrity** — each file still carries its own BLAKE3; after a group is decrypted and inflated, every member's bytes are re-hashed and checked. Mismatch → no extraction.
- **Fail closed** — group decrypt failure, decompression failure, an inflated-size mismatch, or any per-file hash mismatch aborts before a single byte is written (atomic temp-file + rename).
- **Bounded blast radius** — corruption affects only the one group it occurs in, not the whole archive. This is the single behavioral change versus v2 (a corrupt chunk fails its whole group rather than one file) — an explicit, bounded tradeoff of Maximum mode.

### 11.4 Extraction cost

- **Extract all** — each group is inflated once and all its members are sliced out of the single decompressed buffer (more efficient than v2 for grouped files).
- **Extract selected** — only the groups containing selected files are decrypted/inflated; unrelated groups are never touched. The tradeoff: selecting one file in a group still inflates that whole group (≤16 MiB). Fast/Balanced (v2) keep instant per-file random access.

### 11.5 Compatibility matrix

| Reader → Writer | v1 | v2 | v3 |
|---|---|---|---|
| **v3 reader (this build)** | ✅ | ✅ | ✅ |
| v2 reader (older) | ✅ | ✅ | ❌ rejects via version check (`UnsupportedVersion`) |
| v1 reader (oldest) | ✅ | ❌ | ❌ |

`FixedHeader::from_bytes` rejects any `version` greater than the build's `FORMAT_VERSION`, so older builds fail closed on newer archives — they never mis-parse.
