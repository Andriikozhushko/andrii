# ANDRII — Release Checklist (1.0.0)

Step-by-step procedure for cutting and validating an ANDRII release. Honest
statuses only. Do not skip verification steps.

---

## 1. Pre-release validation (local, on Windows)

Run from the repo root:

```bash
cargo test --workspace --exclude andrii-app      # library tests pass
npm run build                                    # frontend (tsc + vite) builds
node scripts/benchmark-andrii.mjs --quick        # quick benchmark sanity (optional)
```

All must pass before proceeding.

## 2. Confirm version agreement

```bash
node -e "const c=require('./src-tauri/tauri.conf.json'); console.log(c.version)"
grep version package.json
grep '^version' Cargo.toml
```

All must read `1.0.0` (or the agreed release version). See
`RELEASE_BUILD_AUDIT.md` for the no-bump rationale.

## 3. Build locally (Windows) and verify artifacts

```bash
npm run tauri build
npm run release:verify        # verifies NSIS + MSI present, non-zero, writes SHA256SUMS.txt
```

Expected artifacts under `target/release/bundle/`:
- `nsis/ANDRII_1.0.0_x64-setup.exe`
- `msi/ANDRII_1.0.0_x64_en-US.msi`

`release:verify` must print `OK: all expected artifacts for platform "windows" present and non-zero.`

## 4. Checksum verification (local)

```bash
# Windows (PowerShell):
Get-FileHash target/release/bundle/nsis/*.exe -Algorithm SHA256
Get-FileHash target/release/bundle/msi/*.msi -Algorithm SHA256
# Compare against the SHA256SUMS.txt written by release:verify.
```

## 5. Git tag procedure

```bash
# Working tree must be clean.
git status
git tag v1.0.0                 # annotated tag preferred: git tag -a v1.0.0 -m "ANDRII 1.0.0"
```

Do **not** push the tag yet — pushing triggers the release workflow.

## 6. GitHub Release workflow

1. Confirm `.github/workflows/release-build.yml` is on the default branch.
2. Push the tag: `git push origin v1.0.0`.
3. Watch the **release-build** workflow on GitHub Actions.
   - `Build (windows-latest)` and `Build (ubuntu-22.04)` must both go green.
   - The `release` job creates a **draft** release with all four artifacts +
     `SHA256SUMS.txt`.
4. **Manual action required (user):** review the draft release, then either
   publish it or discard it. Publishing is the one step that must not happen
   silently.

> `workflow_dispatch` runs the same builds but does **not** create a release —
> use it to test the pipeline without publishing.

## 7. Download and validate Linux artifacts (user manual action)

From the draft release, download the Linux artifacts + `SHA256SUMS.txt`, then:

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

All files must verify `OK`.

## 8. Minimal smoke test

### Windows
- Install via `ANDRII_1.0.0_x64-setup.exe` (or `.msi`).
- Launch ANDRII; create an empty archive; add a file; extract; confirm contents
  match and BLAKE3 integrity holds.
- Double-click a `.andrii` file → opens ANDRII.

### Linux (.deb)
- `sudo apt-get install -y ./andrii-app_1.0.0_amd64.deb`
- Launch from menu; create/add/extract round-trip.
- Double-click a `.andrii` file → opens ANDRII (may require re-login or
  `update-desktop-database`).

### Linux (.AppImage)
- `chmod +x` and run; create/add/extract round-trip.
- Confirm it launches on a clean Ubuntu 22.04 with only runtime deps installed.

## 9. Rollback / revocation guidance

If a released artifact is defective:

1. **Do not delete the tag** silently — keep it for traceability.
2. Convert the GitHub Release to a draft (unpublish) immediately so it is no
   longer publicly downloadable.
3. If the artifact is dangerous (e.g. crashes on valid archives, data-loss
   risk), delete the defective asset files from the draft and add a prominent
   release note: "DO NOT USE — see issue #N".
4. Publish a corrected release with a **patched version** (e.g. `1.0.1`) under
   a new tag; never re-use a published version number.
5. Communicate the revocation in the release notes and any download page.
6. There is no auto-update mechanism, so users must be told to upgrade manually;
   checksums in `SHA256SUMS.txt` let users confirm they have the corrected file.

> Forgotten passwords cannot be recovered — remind users of this in any
> advisory (see `RELEASE_SECURITY_NOTES.md`).
