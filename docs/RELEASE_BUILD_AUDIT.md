# ANDRII — Release Build Audit

Audit date: 2026-06-25
Scope: prepare a cross-platform (Windows x64 + Linux x64) release candidate.

---

## 1. Toolchain versions (installed, actual)

| Component | Version |
|---|---|
| Tauri CLI (`@tauri-apps/cli`) | 2.11.3 |
| `tauri` crate (Cargo.lock) | 2.11.3 |
| `tauri-build` | 2.6.3 |
| Rust / cargo | 1.96.0 |
| Node.js | 24.13.1 |
| npm | 11.8.0 |
| Tauri config schema | `https://schema.tauri.app/config/2` (Tauri v2) |

The project pins Tauri v2 (`"@tauri-apps/api": "^2"`, `tauri = "2"`). All release
configuration must use the **Tauri v2** schema. Do not use v1 field names.

---

## 2. Version values across Rust / Node / Tauri

| Location | Value |
|---|---|
| `Cargo.toml` → `[workspace.package] version` | `1.0.0` |
| `package.json` → `version` | `1.0.0` |
| `src-tauri/tauri.conf.json` → `version` | `1.0.0` |
| `crates/*` | `version.workspace = true` → resolves to `1.0.0` |
| `src-tauri/Cargo.toml` (`andrii-app`) | `version.workspace = true` → `1.0.0` |

**Agreement: YES — all three sources agree on `1.0.0`.** No drift.

### Should the next public version stay 1.0.0 or be incremented (v3 format support)?

**Decision: stay on `1.0.0`.**

Reasoning:
- No public release has shipped. The existing tag `v1.0.0-release-ready` is a
  readiness marker, not a published GitHub Release with verified artifacts.
  There are no release binaries in the repository (Windows bundles were
  gitignored and are not present in the tree).
- v3 (solid groups / Maximum compression) is **backward-compatible and
  additive**: the readers support v1/v2/v3, and v3 does not change the crypto
  primitives, parameters, or existing v1/v2 behavior. It is a new optional
  compression mode, not a breaking format change.
- Because 1.0.0 is the *first* public release, it legitimately includes all
  format versions (v1/v2/v3) supported to date. There is no prior public 1.0.0
  audience to break.
- Bumping to 1.1.0 would imply a post-release minor update, but there has been
  no prior release to update from.

Therefore the first public release is **1.0.0**, including v3 support. No bump.

---

## 3. Product / binary identity

| Field | Value |
|---|---|
| Product name (`productName`) | `ANDRII` |
| Identifier | `com.andrii.secureArchive` |
| Binary name (`[[bin]] name`) | `andrii-app` |
| Crate name (app) | `andrii-app` |
| Publisher | `ANDRII` |
| Copyright | `Copyright 2026 Andrii Kozhushko` |
| Category | `Utility` |
| Short description | `Secure archive utility` |

The executable name `andrii-app` is preserved. Tauri derives the installed
binary name from the crate/bin name; the Linux desktop file and deb package
will use `andrii-app` as the executable. Product display name remains `ANDRII`.

---

## 4. Current bundle configuration (`tauri.conf.json` → `bundle`)

- `active: true`
- `targets: "all"` — on Windows this yields NSIS + MSI; on Linux it would
  attempt deb + AppImage + RPM. **For the release matrix we override with
  explicit targets** (`-b` on the CLI / explicit `targets` list) to avoid
  unwanted RPM and to match the required artifact set exactly.
- `icon`: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`.
  All present under `src-tauri/icons/`. Linux deb/AppImage bundlers use the PNG
  entries; 32x32 and 128x128 are present (minimum required). A 512x512 PNG is
  not in the configured list — not strictly required by the Tauri deb bundler,
  but noted as a minor gap for high-DPI Linux integration.
- `fileAssociations`: `ext: ["andrii"]`, `name: "ANDRII Archive"`,
  `description: "ANDRII Encrypted Archive"`,
  `mimeType: "application/x-andrii-archive"`.

### Existing `.andrii` file-association behavior

- **Windows**: Tauri's NSIS and MSI bundlers register the `.andrii` extension
  and ProgID from `fileAssociations`, installing the icon and shell open verb.
  This is existing, working behavior and must be preserved.
- **Linux (deb)**: Tauri v2's deb bundler installs a `.desktop` file and
  registers the MIME type from `fileAssociations`, installing an
  `application/x-andrii-archive.xml` mime package so `.andrii` files are
  recognized and opened with the app. This is the supported mechanism — no
  custom desktop files are needed.
- **Linux (AppImage)**: AppImage is a portable, non-installed format. It does
  not register system-wide MIME associations reliably. We treat AppImage as
  portable distribution and do **not** promise persistent file association for
  it. (The `airootfs`/desktop integration depends on tools like `AppImageLauncher`
  or `appimaged` which the user may or may not have.)

---

## 5. Linux packaging state

A partial `bundle.linux` block already exists (added in the pre-release
checkpoint):

```json
"linux": {
  "deb": {
    "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0"],
    "section": "utils",
    "priority": "optional"
  },
  "appimage": {
    "bundleMediaFramework": false
  }
}
```

This is correct for Tauri 2.11 on Ubuntu 22.04 (WebKitGTK 4.1). Phase 2 keeps
this and adds the explicit targets list so RPM is not built.

### Linux readiness gaps

1. **No CI workflow** — Linux artifacts have never been built by automation.
   Status today: *configured, pending CI*. This is the primary gap.
2. **No 512x512 icon** in the configured icon list (minor; not blocking).
3. **AppImage file association** is not guaranteed (portable format) — must be
   documented honestly, not promised.
4. **System dependencies for building** (not runtime) must be installed in CI:
   `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`,
   ` librsvg2-dev`, `build-essential`, `patchelf`, `file`. The runtime `depends`
   in the deb cover end-user machines; the `-dev` packages cover the builder.

---

## 6. Existing Windows artifacts / version identifiers

- No release artifacts are tracked in the repository
  (`target/` is gitignored). Builds emit to the workspace-root
  `target/release/bundle/` (cargo uses the root `target/` because `andrii-app`
  is a workspace member).
- Prior Windows bundles were built locally and not committed.
- Version identifier for Windows installers will be `1.0.0.0` (Tauri derives
  the four-part MSI/ProductVersion from the config `version` `1.0.0`).

**Expected Windows artifact names (Tauri 2.11, productName=ANDRII, version=1.0.0):**
- NSIS setup: `ANDRII_1.0.0_x64-setup.exe`
- MSI: `ANDRII_1.0.0_x64_en-US.msi`

(Exact suffixes confirmed against Tauri 2.x naming; the verifier script matches
by glob to tolerate locale/arch suffix variations.)

---

## 7. Existing build scripts

- `package.json` scripts: `dev`, `build` (`tsc && vite build`), `preview`, `tauri`.
- `scripts/benchmark-andrii.mjs` — wraps the Rust benchmark example; supports
  `--quick` (default) / `--full` / `--release`.
- `src-tauri/build.rs` — Windows manifest embedding via `embed-manifest`, then
  `tauri_build::build()`. The manifest embedding is `#[cfg(windows)]` and is a
  no-op on Linux. The `[patch.crates-io] tauri-winres` vendor patch is also
  Windows-only in effect (only invoked by the Windows resource embed path).

No release/verification scripts exist yet — Phase 4 adds
`scripts/verify-release-artifacts.mjs` and `release:verify` / `release:checksums`
npm scripts.

---

## 8. Release risks

1. **Unsigned installers.** No code-signing certificate is configured. Windows
   SmartScreen and Linux package managers will show trust warnings. Documented
   honestly in `RELEASE_SECURITY_NOTES.md`; not a blocker for a release
   *candidate*.
2. **No cryptographic audit.** Crypto is standard (XChaCha20-Poly1305, Argon2id,
   BLAKE3) but has not been independently audited. Must not claim compliance or
   audit status.
3. **RPM excluded.** Building RPM requires `rpmbuild` and adds maintenance
   burden; intentionally not in the matrix. `targets` will be set explicitly to
   avoid accidental RPM attempts.
4. **AppImage portability.** No persistent file association; documented.
5. **WebKitGTK version drift.** deb `depends` pins `libwebkit2gtk-4.1-0`. Newer
   Ubuntu (24.04+) also provides 4.1; older (20.04) does not. We target
   Ubuntu 22.04 as the CI builder, which is compatible.
6. **`targets: "all"` default.** If left as `all`, Linux CI could attempt RPM
   and fail. Mitigated by explicit targets.
7. **Forgotten passwords are unrecoverable.** No KDF escrow; user-side risk,
   documented.
8. **`vendor/tauri-winres` patch.** Windows-specific; must not affect Linux
   builds. Verified it is only used under `cfg(windows)`.

---

## 9. Recommended artifact matrix

| Platform | Arch | Runner | Artifacts | File association |
|---|---|---|---|---|
| Windows x64 | x86_64 | `windows-latest` | NSIS setup `.exe` + `.msi` | Yes (NSIS/MSI registry) |
| Linux x64 | x86_64 | `ubuntu-22.04` | `.AppImage` + `.deb` | deb: yes (MIME+xml); AppImage: no (portable) |

RPM: not produced.

Each artifact gets a SHA-256 checksum; a single `SHA256SUMS.txt` is published
alongside.

---

## 10. Summary

- Versions agree at 1.0.0 → **no bump**; first public release includes v3.
- Windows bundling is already functional; preserve as-is, override targets to
  `msi,nsis` in CI.
- Linux: deb block present and correct; add explicit targets (`deb,appimage`),
  add CI, add verifier, add docs. Status today: *configured, pending CI*.
- Primary deliverable of this phase set: a reproducible GitHub Actions pipeline
  that produces real Windows + Linux artifacts, plus verification tooling and
  honest documentation.
