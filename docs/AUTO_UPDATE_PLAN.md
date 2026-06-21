# ANDRII — Auto-Update Plan (architecture only, no implementation yet)

Status: **planning**. This document prepares the architecture for a future
self-update capability. Nothing here is wired up in 02A.

## 1. Goal

Let an installed ANDRII desktop app discover, download, verify and apply new
versions safely, with the user in control. Updates must never weaken the
security guarantees of the product (signed, verified, local-only archives).

## 2. Recommended mechanism

Use the official **`tauri-plugin-updater`** (Tauri v2). It integrates with the
NSIS/MSI installers we already produce and supports signed update artifacts.

- Add `tauri-plugin-updater` (Rust) + `@tauri-apps/plugin-updater` (JS).
- Add the `updater` config block to `tauri.conf.json` with:
  - `endpoints`: HTTPS URL(s) to a JSON manifest (see §4).
  - `pubkey`: the public half of an update signing key (minisign/ed25519).
- Sign release artifacts at build time with the private key (kept in CI secrets,
  never in the repo). Tauri verifies the signature before applying.

## 3. Update flow (UX)

1. On launch (and via a manual "Check for updates" button in Settings → About),
   query the manifest. Throttle to at most once per N hours.
2. If a newer version is available, show a non-blocking notice with release notes.
3. User chooses **Update now** / **Later**. Never auto-install silently.
4. Download → verify signature → stage → prompt to restart → apply on restart.
5. On failure, keep the current version and surface a clear, recoverable error.

Respect the product's privacy stance: the only network call is the version
check + artifact download. No telemetry, no analytics.

## 4. Manifest format (`latest.json`)

```json
{
  "version": "0.2.0",
  "notes": "Localized changelog or a URL.",
  "pub_date": "2026-07-01T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<minisign signature of the artifact>",
      "url": "https://downloads.andrii.app/0.2.0/ANDRII_0.2.0_x64-setup.exe"
    }
  }
}
```

## 5. Security requirements

- **Signed updates only** — reject any artifact whose signature does not verify
  against the bundled public key. No unsigned/sideloaded fallback.
- **HTTPS only** for manifest + artifacts; pin to the official host.
- Update signing key is **separate** from any archive/format keys and lives only
  in CI secrets. Document a key-rotation procedure before first release.
- Show the version and (eventually) the artifact hash in Settings → About so the
  user can audit what is installed.

## 6. Settings integration (future)

Settings → About will gain:
- Current version (already shown in 02A).
- "Check for updates" button + last-checked timestamp.
- "Install updates automatically" toggle (off by default).
- Channel selector (stable / beta) — optional, later.

## 7. Build / CI changes (future)

- Generate and store the update signing keypair (public bundled, private in CI).
- After `tauri build`, sign artifacts and publish `latest.json` + installers to
  the downloads host.
- Tag releases as `vX.Y.Z`; the manifest mirrors the latest stable tag.

## 8. Out of scope for now

Differential/delta updates, background silent installs, rollback automation, and
multi-platform manifests (macOS/Linux) — revisit once Windows auto-update ships.
