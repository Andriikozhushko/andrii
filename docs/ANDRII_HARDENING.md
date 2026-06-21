# ANDRII — Final Production Hardening (v1.0.0)

Stability + security hardening only. No features, no UX/architecture changes.

## 1. Edge-case / stability

- **Atomic archive write.** `ArchiveWriter` now assembles the vault in a sibling
  temp file (`.andrii-build-…tmp`) and `fs::rename`s it over the target (atomic,
  replaces on Windows & Unix). A crash mid-write never leaves a half-written
  vault; the previous file (if any) stays intact until the swap. (std only — no
  new crates.)
- **Bounded memory (large files).** Encrypted blocks are spooled to a temp file
  (`.andrii-spool-…tmp`) and streamed back during the final write, so peak memory
  is ~one file instead of the whole archive. Verify streams the integrity hash in
  64 KiB chunks instead of reading the whole archive into memory.
- **Corrupted `.andrii` is safe.** `verify_archive` wraps the read/parse in a
  fallible block; any I/O or footer error → `is_valid = false` (compromised),
  never a crash. A corrupted file deterministically reports as broken.
- **Empty input blocked.** Creating a vault with zero files fails closed
  (`No files to add to the vault`) in the core writer, not just the UI.
- **Concurrency.** Archive build is sequential (one file at a time); no unbounded
  parallelism or thread fan-out.

## 2. Security behavior

- **Fail-closed everywhere.** Wrong password / tamper / corruption return errors;
  content is never written unless its per-file AEAD tag *and* BLAKE3 hash both
  verify. No partial open, no degraded mode.
- **Deterministic responses.** Wrong password is always `InvalidPassword`
  (single message). The cost is dominated by Argon2id (fixed work that always
  runs before the header is touched), so the wrong/right timing difference is the
  KDF-dominated constant — no password-dependent fast path.
- **Tamper always compromised.** Footer hash mismatch ⇒ `is_valid = false`,
  always; recorded permanently in the vault's integrity memory (04C).
- **Memory safety.** Decrypted plaintext (header, per-file compressed + content)
  is wrapped in `Zeroizing` and wiped on drop; the master key was already
  zeroized.
- **No crypto leakage in UI.** The Verify screen no longer renders raw backend
  error strings; failures surface only as deterministic, mapped messages
  (`src/lib/errors.ts`). Algorithm names appear solely in About.

## 3. Installer / release

- Version set to **1.0.0** across `package.json`, root `Cargo.toml`
  (`workspace.package`), and `tauri.conf.json`.
- Installer metadata: productName **ANDRII**, publisher **ANDRII**, default
  install path `Program Files/ANDRII` (NSIS default for the product name).
- `.andrii` file association is configured (`bundle.fileAssociations`) →
  double-click opens the app at that archive; drag-drop routes to the open flow.
- App/installer icons present in `src-tauri/icons/`.

## 4. Verification done

- `cargo test --workspace --exclude andrii-app` — **62 passing** (roundtrip,
  tamper, password, integrity) with the atomic/streaming writer + zeroize +
  graceful verify.
- `tsc --noEmit` clean; `npm run build` (frontend) clean.

## 5. Build note (environment)

The final Windows build/installer is produced by `npm run tauri build`. It
requires the GNU toolchain's **`windres`** (MinGW binutils) to compile the app
icon resource (or the MSVC toolchain + Windows SDK). This must be run in an
environment where `windres` is on PATH. The source here is release-ready and
test-validated; only the icon-resource compile + bundling depend on that tool.
