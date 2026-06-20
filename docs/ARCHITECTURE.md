# ANDRII — Architecture Document

**Version:** 1.0  
**Status:** Foundation  
**Date:** 2026-06-20

---

## 1. Overview

ANDRII is a production-grade desktop secure archive application. It provides compression, authenticated encryption, metadata protection, and archive integrity verification inside a modern enterprise-grade GUI.

### Design Goals

| Goal | Principle |
|------|-----------|
| User simplicity | One password, one file, done |
| Security depth | Defense-in-depth at every layer |
| Format integrity | Tamper-evident, self-describing, versioned |
| Extensibility | Signatures, recipients, HSM support reserved |
| Performance | Streaming I/O, parallel compression |
| Cross-platform | Windows and Linux via Tauri v2 |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     ANDRII Application                   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │              React Frontend (TypeScript)          │  │
│  │  Home │ Create Archive │ Open Archive │ Verify    │  │
│  └─────────────────────┬────────────────────────────┘  │
│                        │ Tauri IPC (invoke/emit)         │
│  ┌─────────────────────▼────────────────────────────┐  │
│  │              Tauri v2 Command Layer (Rust)         │  │
│  │  create_archive │ open_archive │ verify_archive    │  │
│  └──┬────────────────────────────────────────────┬──┘  │
│     │                                            │      │
│  ┌──▼──────────────┐              ┌──────────────▼──┐  │
│  │  andrii-core     │              │  andrii-crypto  │  │
│  │  ─────────────  │              │  ─────────────  │  │
│  │  ArchiveWriter   │◄────────────►│  Argon2id KDF   │  │
│  │  ArchiveReader   │              │  XChaCha20-P1305│  │
│  │  Format types    │              │  BLAKE3         │  │
│  │  Verifier        │              │  PasswordScore  │  │
│  └──┬──────────────┘              └─────────────────┘  │
│     │                                                    │
│  ┌──▼──────────────┐                                    │
│  │  andrii-compress │                                    │
│  │  ─────────────  │                                    │
│  │  Zstd compress  │                                    │
│  │  Zstd decompress│                                    │
│  │  Level profiles │                                    │
│  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Crate Responsibilities

### `andrii-crypto`

Pure cryptographic primitives. No I/O, no archive logic.

- **KDF:** Argon2id with configurable parameters (m_cost, t_cost, p_cost)
- **AEAD:** XChaCha20-Poly1305 encrypt/decrypt
- **Hash:** BLAKE3 streaming and one-shot hashing
- **Password analysis:** Entropy estimation, strength scoring

Dependencies: `argon2`, `chacha20poly1305`, `blake3`, `rand`, `zeroize`

### `andrii-compress`

Compression abstraction layer. Wraps zstd with typed profiles.

- `CompressionLevel::Fast` → zstd level 1
- `CompressionLevel::Balanced` → zstd level 6
- `CompressionLevel::Maximum` → zstd level 19
- Streaming compress/decompress via `Read`/`Write` adapters

Dependencies: `zstd`

### `andrii-core`

Archive format implementation. Orchestrates crypto and compress.

- `format/` — Binary format types, serialization
- `archive/writer.rs` — Create `.andrii` archives
- `archive/reader.rs` — Open and decrypt `.andrii` archives
- `archive/verifier.rs` — Integrity and version verification

Dependencies: `andrii-crypto`, `andrii-compress`, `serde`, `serde_json`, `bincode`

### `src-tauri` (Tauri Application)

Tauri v2 backend. Bridges core logic to the frontend via typed commands.

- `commands/archive.rs` — IPC commands
- `commands/password.rs` — Password analysis command
- Progress events via `tauri::Emitter`

Dependencies: `andrii-core`, `tauri`, `tauri-plugin-dialog`

---

## 4. Data Flow

### Create Archive

```
User provides: files[], password, compression_level, output_path
│
├─ Validate password strength (andrii-crypto)
├─ Derive master key: Argon2id(password, random_salt) → [u8; 32]
├─ For each file:
│   ├─ Read file content (streaming)
│   ├─ Compress: zstd(content, level) → compressed_bytes
│   ├─ Encrypt: XChaCha20-P1305(compressed_bytes, master_key, random_nonce)
│   ├─ Record: FileEntry { path, sizes, nonce, offset, blake3_hash }
│   └─ Append encrypted bytes to data section buffer
│
├─ Serialize file table → JSON → Encrypt as header block
│   (Additional data = unencrypted fixed header bytes)
│
├─ Write final file:
│   [Fixed Header][Encrypted Header Block][Data Blocks][Footer]
│
└─ Footer = BLAKE3(all bytes above)
```

### Open Archive

```
User provides: archive_path, password
│
├─ Read fixed header (74 bytes): magic, version, flags, salt, nonce, header_len
├─ Validate magic bytes "ANDRII"
├─ Derive master key: Argon2id(password, salt from header)
├─ Decrypt header block → FileEntry[]
│   (wrong password → authentication failure → clear error)
│
├─ Present file list to user
│
└─ For each file user selects to extract:
    ├─ Seek to content_offset in data section
    ├─ Read encrypted_bytes (compressed_size + 16 tag bytes)
    ├─ Decrypt: XChaCha20-P1305.decrypt(encrypted_bytes, master_key, content_nonce)
    ├─ Decompress: zstd.decompress(decrypted_bytes)
    ├─ Verify: BLAKE3(decompressed) == entry.blake3_hash
    └─ Write to output_path
```

---

## 5. Security Architecture

### Key Derivation

```
password (UTF-8)  +  random_salt (32 bytes)
         │
         ▼
    Argon2id (m=65536 KiB, t=3, p=4)
         │
         ▼
    master_key (32 bytes)
```

Parameters are stored unencrypted in the archive header (salt, Argon2 parameters). The master key is never stored.

### Encryption

- **Algorithm:** XChaCha20-Poly1305
- **Key:** 32-byte master key (from Argon2id)
- **Nonces:** Randomly generated per-use (24 bytes each)
  - Header nonce: stored in fixed header
  - Per-file nonce: stored in encrypted file entry
- **Authentication:** Poly1305 tag covers ciphertext + nonce + associated data
- **Associated data for header block:** Fixed header bytes (binds decryption to this specific archive)
- **Associated data for file content:** Serialized file entry hash (binds content to its metadata)

### Integrity

- **Per-file:** BLAKE3 hash of original plaintext, stored in encrypted header
- **Archive-wide:** BLAKE3 hash of entire file content (excluding footer), stored in footer

### What is encrypted

| Data | Encrypted |
|------|-----------|
| File content | Yes |
| File names | Yes (in encrypted header) |
| Directory structure | Yes (in encrypted header) |
| File sizes (original) | Yes (in encrypted header) |
| File timestamps | Yes (in encrypted header) |
| Archive creation time | Yes (in encrypted header) |
| KDF salt | **No** (required for key derivation) |
| Format version | **No** (required for parsing) |
| KDF parameters | **No** (required for key derivation) |
| Archive total size | **No** (implicit from file size) |

---

## 6. Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Rust | Memory safety, performance, cross-platform |
| GUI framework | Tauri v2 | Native webview, small binary, Rust backend |
| Frontend | React + TypeScript | Component model, type safety, wide ecosystem |
| Styling | Tailwind CSS | Utility-first, no runtime overhead |
| Compression | Zstandard (zstd) | Best ratio/speed tradeoff; widely trusted |
| AEAD | XChaCha20-Poly1305 | Extended nonce (no reuse risk), fast, audited |
| KDF | Argon2id | Memory-hard, PHC winner, GPU-resistant |
| Hash | BLAKE3 | Fastest cryptographic hash, parallelizable |
| Serialization (header) | serde_json | Human-debuggable, forward-compatible |

---

## 7. Extension Points

The format and architecture are designed to support future features without breaking existing archives:

| Feature | How Reserved |
|---------|-------------|
| Digital signatures | 512-byte signature block in footer (zeroed in v1) |
| Recipient encryption | Flags field in fixed header; encrypted header can contain per-recipient key wrapping |
| Key comments | Flags field; additional JSON fields in encrypted header |
| Parallel chunks | Flags field; per-file chunking metadata in FileEntry |
| Compression algorithm | `compression` field in encrypted header enum |
| Archive comments | `metadata` map in encrypted header |

---

## 8. Error Handling Philosophy

- All errors are typed (`thiserror`-derived enums)
- Cryptographic errors are opaque to callers: "Decryption failed" not "Authentication tag mismatch on byte 1024"
- Wrong password and corrupted archive produce the same external error message
- No panics in library code (use `Result`, never `unwrap` on user input)

---

## 9. Testing Strategy

| Layer | Test Type |
|-------|-----------|
| andrii-crypto | Unit tests, known-answer vectors |
| andrii-compress | Round-trip tests, edge cases (empty, large) |
| andrii-core | Integration tests: create → open → verify |
| Format | Fuzzing targets (planned, Phase 3) |
| CLI smoke tests | Planned for CI |
