# ANDRII — Release Matrix

Version: **1.0.0** (first public release; includes v1/v2/v3 archive format support)

Status labels are honest: nothing is claimed as "released" until real CI
artifacts exist and have been verified.

| Platform | Architecture | Artifact | Status | File association | Notes |
|---|---|---|---|---|---|
| Windows x64 | x86_64 | `ANDRII_1.0.0_x64-setup.exe` (NSIS) | Configured, pending CI | Yes — registered via NSIS/MSI (ProgID + shell open verb + icon) | Built on `windows-latest` |
| Windows x64 | x86_64 | `ANDRII_1.0.0_x64_en-US.msi` (MSI) | Configured, pending CI | Yes — registered via MSI | WiX-based; Tauri downloads WiX automatically |
| Linux x64 | x86_64 | `andrii-app_1.0.0_amd64.AppImage` | Configured, pending CI | No — portable format; no system-wide MIME registration | Built on `ubuntu-22.04`. Requires WebKitGTK 4.1 at runtime |
| Linux x64 | x86_64 | `andrii-app_1.0.0_amd64.deb` | Configured, pending CI | Yes — installs `.desktop` + MIME xml package for `application/x-andrii-archive` | Primary Linux desktop/MIME package. Runtime deps: `libwebkit2gtk-4.1-0`, `libgtk-3-0` |

**Not produced:**
- RPM — intentionally excluded (adds maintenance burden; not required).
- macOS / arm / 32-bit builds — out of scope for this release candidate.

**Filename note:** exact filenames follow Tauri 2.11's bundler convention
(productName `ANDRII`, version `1.0.0`). The artifact verifier
(`scripts/verify-release-artifacts.mjs`) matches by extension pattern
(`*-setup.exe`, `*.msi`, `*.AppImage`, `*.deb`), so it tolerates minor
suffix/locale variations.

## Checksums

Every release artifact gets a SHA-256 entry in a single `SHA256SUMS.txt`
published alongside the artifacts. The file lists `<sha256>  <basename>` lines
(assets are distributed flat).

## How artifacts are produced

1. A version tag `v1.0.0` is pushed (or `workflow_dispatch` is triggered).
2. `.github/workflows/release-build.yml` runs the build matrix on
   `windows-latest` and `ubuntu-22.04`.
3. Each job runs `cargo test --workspace --exclude andrii-app`, then
   `npm run tauri build`, then the verifier (per-platform).
4. Artifacts are uploaded as GitHub Actions artifacts.
5. On tag builds, a `release` job downloads both, flattens them, verifies all
   four are present, writes a combined `SHA256SUMS.txt`, and creates a **draft**
   GitHub Release with the assets attached.

See `RELEASE_CHECKLIST.md` for the full procedure and `LINUX_RELEASE_NOTES.md`
for Linux-specific usage.
