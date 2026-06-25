# ANDRII — Linux Release Notes (1.0.0)

ANDRII is a secure archive utility: encrypt, compress, and protect files with
XChaCha20-Poly1305, Argon2id key derivation, and BLAKE3 integrity verification,
stored in the custom `.andrii` archive format.

This is the **first Linux build** of ANDRII. It is a **release candidate**:
artifacts are produced by GitHub Actions but are **unsigned** and have not been
independently audited. See `RELEASE_SECURITY_NOTES.md`.

Two Linux packages are produced:

| Package | Type | Best for |
|---|---|---|
| `ANDRII_1.0.0_amd64.deb` | Debian/Ubuntu installer | Desktop integration + `.andrii` file association (Ubuntu 22.04 / 24.04, Debian 12+) |
| `ANDRII_1.0.0_x64.AppImage` | Portable single-file | Distros without `.deb`, portable use, no install |

> The published filenames are branded (`ANDRII_*`). The internal package
> identity registered with `apt` remains the lowercase `andrii-app`, so
> `apt-get remove andrii-app` still works after installing the `.deb`.

---

## Installing the `.deb` (Ubuntu / Debian)

```bash
# 1. Download ANDRII_1.0.0_amd64.deb and SHA256SUMS.txt from the release.
# 2. Verify the checksum (recommended):
sha256sum -c SHA256SUMS.txt --ignore-missing
# 3. Install:
sudo apt-get install -y ./ANDRII_1.0.0_amd64.deb
#    (apt resolves the runtime deps: libwebkit2gtk-4.1-0, libgtk-3-0)
```

Then launch **ANDRII** from your application menu, or run `andrii-app`.

The `.deb` installs:
- the `andrii-app` binary,
- a `.desktop` entry (menu integration + icon),
- a MIME package registering `application/x-andrii-archive` for `.andrii` files,
  so `.andrii` archives show the ANDRII icon and open with ANDRII on
  double-click (after the desktop refreshes its MIME cache).

### Uninstall

```bash
sudo apt-get remove andrii-app
```

---

## Running the `.AppImage` (portable)

```bash
# 1. Download ANDRII_1.0.0_x64.AppImage and SHA256SUMS.txt.
# 2. Verify:
sha256sum -c SHA256SUMS.txt --ignore-missing
# 3. Make executable:
chmod +x ANDRII_1.0.0_x64.AppImage
# 4. Run:
./ANDRII_1.0.0_x64.AppImage
```

The AppImage bundles the application and its libraries (except the system
WebKitGTK runtime, which must be present on the host). On first run, some
desktops prompt to integrate the AppImage into the menu; this is optional and
provided by tools like AppImageLauncher / `appimaged`, which ANDRII does not
bundle.

### Runtime requirements

The AppImage needs the WebKitGTK 4.1 runtime on the host. On Ubuntu/Debian:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-0 libgtk-3-0
```

---

## Desktop integration status

| Feature | `.deb` | `.AppImage` |
|---|---|---|
| Application menu entry | Yes | Only via optional AppImageLauncher/appimaged |
| Icon | Yes | Embedded in AppImage |
| `.andrii` file association (double-click opens) | Yes | No (portable; not registered system-wide) |
| MIME type `application/x-andrii-archive` | Yes (registered) | No |

If you use the AppImage and want `.andrii` files to open with it, you can
manually create a `.desktop` file pointing at the AppImage and register the
MIME type yourself; this is not done automatically.

---

## Known Linux limitations

- **Unsigned.** No code signing; package managers / desktops may warn.
- **AppImage file association is not persistent.** Use the `.deb` for desktop
  integration.
- **WebKitGTK 4.1 required at runtime.** Older distributions (e.g. Ubuntu 20.04
  and earlier) ship WebKitGTK 4.0 and are not supported by this build.
- **x64 only.** No arm64 / 32-bit Linux builds in this release.
- **No auto-update.** ANDRII does not auto-update; check for new releases
  manually.
- **Wayland:** the custom chromeless window (decorations disabled) is tested
  under X11; Wayland behavior may differ for window dragging.

---

## How GitHub Actions creates the artifacts

The workflow `.github/workflows/release-build.yml` builds on `ubuntu-22.04`:

1. Installs Linux build dependencies (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`,
   `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`, …).
2. Runs `cargo test --workspace --exclude andrii-app`.
3. Runs `npm run tauri build`, producing `deb` and `appimage` bundles under
   their native names (`andrii-app_1.0.0_amd64.*`).
4. Runs `scripts/verify-release-artifacts.mjs --platform linux` (native mode) to
   confirm both native artifacts exist and are non-zero.
5. Stages the native output into a flat `staging/` directory under the branded
   public filenames (`ANDRII_1.0.0_x64.AppImage`, `ANDRII_1.0.0_amd64.deb`),
   then runs the verifier in `--branded` mode and writes a per-platform
   `SHA256SUMS-linux.txt` from the branded names.
6. Uploads the branded staged artifacts. On tag builds, a `release` job
   downloads both platforms' staged artifacts, flattens only the `ANDRII_*`
   branded files, verifies all four in branded mode, writes a combined
   `SHA256SUMS.txt` referencing only the branded names, and attaches everything
   to a **draft** GitHub Release.

---

## Verifying SHA-256 checksums

```bash
# Place the downloaded artifact(s) and SHA256SUMS.txt in one directory, then:
sha256sum -c SHA256SUMS.txt --ignore-missing
```

`--ignore-missing` lets you verify just the file(s) you downloaded. A successful
check prints `OK` for each file; a mismatch prints `FAILED` and a non-zero exit
code — do not use a file that fails verification.

`SHA256SUMS.txt` lines use bare filenames (assets are flat), so run the command
from the directory containing the downloaded files.
