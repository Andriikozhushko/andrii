# ANDRII — Security Design Document

## Threat Model

### Assets

- File content of archived files
- File names and directory structure
- File metadata (timestamps, permissions, sizes)
- The user's password

### Adversaries

- **Passive observer** with access to the archive file (e.g., cloud storage provider, attacker with filesystem access)
- **Active attacker** who can modify the archive file
- **Brute-force attacker** with GPU clusters attempting offline password guessing

### Out of Scope

- Malware on the user's own machine (if the machine is compromised, the password in memory is exposed at extraction time — this is unavoidable for any encryption tool)
- Side-channel attacks against the running process
- Coercion attacks (rubber-hose cryptanalysis)

---

## Cryptographic Choices

### Why XChaCha20-Poly1305 over AES-GCM?

| Property | AES-GCM | XChaCha20-Poly1305 |
|----------|---------|---------------------|
| Nonce size | 96-bit | 192-bit |
| Nonce reuse risk | High (birthday at 2^32 msgs) | Negligible (2^96 msgs) |
| Hardware acceleration | Yes (AES-NI) | No (but fast in software) |
| Audited implementations | Many | Many (`chacha20poly1305` crate) |
| Constant-time guarantee | AES-NI yes; software vulnerable | Yes |

XChaCha20-Poly1305 is chosen for the **extended nonce**: generating random nonces for each encryption is safe without global state tracking. This eliminates an entire class of nonce-reuse bugs.

On systems without AES-NI, XChaCha20-Poly1305 is also faster than software AES-GCM.

### Why Argon2id?

Argon2id is the [PHC (Password Hashing Competition) winner](https://www.password-hashing.net/). The `id` variant is hybrid:
- **Argon2i** half: provides side-channel resistance (cache-timing attacks)
- **Argon2d** half: provides maximum GPU/ASIC resistance (data-dependent memory access)

Alternative considered: `scrypt` — rejected because Argon2id is newer, better parameterized, and has a more active ecosystem.

Alternative considered: `bcrypt` — rejected because it cannot be parallelized on GPUs (limiting cost), has an input length limit (72 bytes), and is not memory-hard in the modern sense.

### Why BLAKE3?

- Fastest cryptographically secure hash function in widespread use
- Parallelizable (Merkle tree internally)
- Designed by authors of ChaCha20 and BLAKE2
- No length-extension attacks (unlike SHA-2)
- Used for both per-file integrity and archive-wide integrity

---

## Key Derivation Parameters

Default Argon2id parameters (v1 archives):

```
m_cost = 65536  (64 MiB)
t_cost = 3      (3 passes)
p_cost = 4      (4 lanes)
```

Estimated computation time per attempt:
- Modern laptop CPU: ~300-800ms
- High-end desktop CPU: ~150-400ms
- GPU (limited by memory bandwidth): ~2-5x slower than CPU

At 2 attempts/second on a dedicated GPU cluster:
- 8-character random lowercase: ~5 days
- 12-character random alphanumeric: effectively impossible
- Passphrase (4+ common words): effectively impossible

---

## Authentication Coverage

| Component | Authenticated By |
|-----------|-----------------|
| Fixed header | Included as AAD in header AEAD |
| Encrypted header | AEAD tag (Poly1305) |
| File path / name | Inside encrypted header (implicit) |
| File content | AEAD tag per file block |
| File content vs. metadata | AAD = blake3_hash ties content to its entry |
| Entire archive | BLAKE3 footer hash |

**Double protection:** A file block is authenticated twice:
1. Its AEAD tag (cryptographic authentication)
2. The BLAKE3 hash in the encrypted header (explicit content hash verification after decryption)

This is intentionally redundant — the AEAD tag is sufficient, but the BLAKE3 hash provides an additional explicit integrity signal and a content fingerprint.

---

## Data Handling

### Password Handling

- Passwords are received as `SecretString` (from the `secrecy` crate) wrapping a `String`
- On drop, the memory is overwritten via `zeroize`
- Passwords are never logged or stored
- Derived keys (`master_key`) are wrapped in `Zeroizing<[u8; 32]>` from the `zeroize` crate

### Temporary Files

- During archive creation, file content is encrypted to an in-memory buffer
- No temporary plaintext files are created on disk
- For archives > available RAM (Stage 3+): streaming to a temp file on the same filesystem as the output, with secure deletion on completion or error

### Memory

- Sensitive key material uses `Zeroizing<T>` for automatic zeroing on drop
- The Rust ownership model ensures no dangling references to key material
- Future: `mlock` to prevent key material from being swapped to disk

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Weak user password | High | High | Mandatory password strength display; minimum entropy guidance |
| Nonce reuse | Very Low | Critical | 192-bit random nonces; no counter-based nonces |
| Library vulnerability (chacha20poly1305, argon2) | Low | High | `cargo audit` in CI; pin dependency versions |
| Archive truncation undetected | Low | Medium | Footer BLAKE3 hash covers all data |
| Metadata leakage (file count, sizes) | Medium | Low | Documented limitation; padding reserved for future |
| Side-channel timing attacks | Low | High | Use of `chacha20poly1305` crate (constant-time); Rust `subtle` crate for comparisons |
| Wrong password gives garbled data | N/A | N/A | AEAD authentication: decryption fails cleanly on wrong password |

---

## Dependency Security Profile

| Crate | Purpose | Audit Status |
|-------|---------|-------------|
| `chacha20poly1305` | AEAD encryption | RustCrypto project; widely audited |
| `argon2` | Key derivation | RustCrypto project; audited |
| `blake3` | Hashing | Designed by well-known cryptographers; reference impl |
| `rand` | Random number generation | Uses OS CSPRNG (`getrandom`) |
| `zeroize` | Memory hygiene | RustCrypto project |
| `zstd` | Compression | Binding to Facebook's libzstd; widely deployed |
| `serde_json` | Header serialization | Non-cryptographic; well-tested |
| `tauri` | GUI framework | Actively maintained; security-focused team |
