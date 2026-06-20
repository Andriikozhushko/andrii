# ANDRII — Development Roadmap

## Stage 1 — Foundation (Current)

**Goal:** Working Rust workspace, crypto/compress layers, archive format skeleton, Tauri app skeleton.

### Milestones

- [x] Architecture document
- [x] Format specification
- [x] Security design
- [x] Cargo workspace setup
- [x] `andrii-crypto` crate (Argon2id, XChaCha20-Poly1305, BLAKE3, password scoring)
- [x] `andrii-compress` crate (Zstd, compression profiles)
- [x] `andrii-core` crate (format types, ArchiveWriter, ArchiveReader, Verifier)
- [x] Tauri v2 application shell
- [x] Basic routing (Home, Create, Open, Verify)
- [x] Dark enterprise UI foundation

---

## Stage 2 — Core Features (Current)

**Goal:** Fully working archive creation, opening, and verification through the GUI.

### Milestones

- [x] Create Archive screen with drag-and-drop
- [x] Password strength meter (live, client-side analysis)
- [x] Compression profile selector (Fast / Balanced / Maximum)
- [x] Security Report modal after archive creation
- [x] Open Archive screen with file listing
- [x] Extract selected files / Extract all
- [x] Verify Archive screen with BLAKE3 integrity check
- [x] Tauri IPC commands: `create_archive`, `open_archive`, `extract_archive`, `verify_archive`
- [x] Progress events for large archives
- [ ] End-to-end integration tests

---

## Stage 3 — Polish & Robustness

**Goal:** Production-quality error handling, UX polish, performance.

### Milestones

- [ ] Streaming I/O for files > 500 MiB (chunked encryption)
- [ ] Progress bar with speed and ETA
- [ ] Cancel in-progress operations
- [ ] Keyboard navigation throughout UI
- [ ] Accessibility audit (ARIA, focus management)
- [ ] Localization infrastructure (en-US baseline)
- [ ] Robust error messages (user-friendly, no internal details exposed)
- [ ] Recent archives history
- [ ] Drag-drop onto app icon (OS integration)
- [ ] Comprehensive unit + integration test suite
- [ ] CI/CD pipeline (GitHub Actions)

---

## Stage 4 — Security Hardening

**Goal:** Security audit readiness, fuzz testing, hardened build.

### Milestones

- [ ] Fuzz targets: `fuzz_parse_header`, `fuzz_decrypt_header`, `fuzz_extract`
- [ ] Secrets zeroized on drop (`zeroize` in all crypto types)
- [ ] Memory locking for key material (`mlock` via `memsec`)
- [ ] Code audit checklist completion
- [ ] Dependency audit (`cargo audit` in CI)
- [ ] Platform-specific secure deletion of temp files
- [ ] SBOM generation

---

## Stage 5 — Advanced Features

**Goal:** Signature support, advanced encryption, extensibility.

### Milestones

- [ ] Ed25519 digital signatures (archive signing + verification)
- [ ] Key pair management UI
- [ ] Public key import/export
- [ ] Recipient-based encryption (hybrid: X25519 ECDH + XChaCha20 content key)
- [ ] Multiple recipients per archive
- [ ] File Explorer shell extension (Windows)
- [ ] Nautilus/Dolphin integration (Linux)
- [ ] Archive merging
- [ ] Archive splitting (multi-volume)
- [ ] Benchmarking suite

---

## Stage 6 — Distribution

**Goal:** Installable, signed, distributable packages.

### Milestones

- [ ] Code signing (Windows: EV cert, macOS: Developer ID)
- [ ] Windows installer (NSIS via Tauri)
- [ ] Linux packages: .deb, .rpm, AppImage
- [ ] Auto-update (Tauri updater)
- [ ] Website & documentation
- [ ] License (MIT or commercial dual-license decision)
