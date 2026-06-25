# ANDRII — Release Matrix

Version: **1.0.0** (first public release; includes v1/v2/v3 archive format support)

Status labels are honest: nothing is claimed as "released" until real CI
artifacts exist and have been verified.

| Platform | Architecture | Artifact | Status | File association | Notes |
|---|---|---|---|---|---|
| Windows x64 | x86_64 | `ANDRII_1.0.0_x64-setup.exe` (NSIS) | Configured, pending CI | Yes — registered via NSIS/MSI (ProgID + shell open verb + icon) | Built on `windows-latest` |
| Windows x64 | x86_64 | `ANDRII_1.0.0_x64_en-US.msi` (MSI) | Configured, pending CI | Yes — registered via MSI | WiX-based; Tauri downloads WiX automatically |
| Linux x64 | x86_64 | `ANDRII_1.0.0_x64.AppImage` | Configured, pending CI | No — portable format; no system-wide MIME registration | Built on `ubuntu-22.04`. Requires WebKitGTK 4.1 at runtime |
| Linux x64 | x86_64 | `ANDRII_1.0.0_amd64.deb` | Configured, pending CI | Yes — installs `.desktop` + MIME xml package for `application/x-andrii-archive` | Primary Linux desktop/MIME package. Runtime deps: `libwebkit2gtk-4.1-0`, `libgtk-3-0`. Internal package identity remains lowercase `andrii-app`; only the published filename is branded |

**Not produced:**
- RPM — intentionally excluded (adds maintenance burden; not required).
- macOS / arm / 32-bit builds — out of scope for this release candidate.

**Filename note (native vs. public):** Tauri 2.11's bundler emits native names
that follow its own convention — on Windows these already match the public
names (`ANDRII_1.0.0_x64-setup.exe`, `ANDRII_1.0.0_x64_en-US.msi`), but on Linux
the native output is lowercase (`andrii-app_1.0.0_amd64.AppImage`,
`andrii-app_1.0.0_amd64.deb`). The release workflow therefore runs a **staging
step** that copies/renames the native output to the exact public filenames
listed in the table above. The artifact verifier
(`scripts/verify-release-artifacts.mjs`) has two modes:

- **native mode** (build jobs, pre-staging) — matches Tauri output by extension
  pattern (`*-setup.exe`, `*.msi`, `*.AppImage`, `*.deb`), tolerating minor
  suffix/locale variations.
- **branded mode** (`--branded`, post-staging + release job) — requires the exact
  public filenames and fails if any unexpected release-type file is present, so
  only the branded names reach `SHA256SUMS.txt` and the GitHub Release.

## Checksums

Every release artifact gets a SHA-256 entry in a single `SHA256SUMS.txt`
published alongside the artifacts. The file lists `<sha256>  <basename>` lines
using the branded public filenames (assets are distributed flat). Per-platform
`SHA256SUMS-<platform>.txt` intermediates are also generated from the staged
branded names during the build jobs but are not published.

## How artifacts are produced

1. A version tag `v1.0.0` is pushed (or `workflow_dispatch` is triggered).
2. `.github/workflows/release-build.yml` runs the build matrix on
   `windows-latest` and `ubuntu-22.04`.
3. Each job runs `cargo test --workspace --exclude andrii-app`, then
   `npm run tauri build`, then verifies the native artifacts (native mode).
4. A staging step copies the native output into a flat `staging/` directory
   under the exact branded public filenames, then verifies them (branded mode)
   and writes a per-platform `SHA256SUMS-<platform>.txt`.
5. The branded staged files are uploaded as GitHub Actions artifacts.
6. On tag builds, a `release` job downloads both, flattens only the `ANDRII_*`
   branded files into a single `release/` directory, verifies all four are
   present in branded mode, writes a combined `SHA256SUMS.txt`, and creates a
   **draft** GitHub Release with the branded assets attached.

See `RELEASE_CHECKLIST.md` for the full procedure and `LINUX_RELEASE_NOTES.md`
for Linux-specific usage.
