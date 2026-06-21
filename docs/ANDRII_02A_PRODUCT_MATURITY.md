# ANDRII 02A — Product Maturity

Focus of this milestone: **product maturity, not visuals**. Internationalization
and professional product features on top of the 01F hand-drawn identity.

## Phase 1 — Multi-language (i18n)

- 7 languages: **English, Ukrainian, Russian, German, French, Spanish, Armenian**.
- Architecture: `src/i18n/` with one JSON dictionary per language
  (`en/uk/ru/de/fr/es/hy.json`) + a tiny custom provider (`src/i18n/index.tsx`):
  `I18nProvider`, `useI18n()`, `useT()`, dotted-key lookup, `{var}` interpolation,
  English fallback for any missing key.
- First launch detects system language (`navigator.language`); unsupported → English.
- Selection persists in `localStorage` (`andrii.lang`) and changes **instantly**,
  no restart (React context re-render).
- No hardcoded user-facing strings in components — all via `t("…")`. Crack-time
  labels are derived from the strength **score** and translated, not pulled as
  English from the backend.
- Language selector lives in **Settings**.

## Phase 2 — First-run onboarding

- `src/components/Onboarding.tsx`: full-screen welcome shown once.
- Three steps: protect files & folders · only the password can open them ·
  everything stays local. **Get started** sets the `andrii.onboarded` flag
  (`src/lib/storage.ts`). Re-show via Settings.

## Phase 3 — Recent archives

- `src/lib/storage.ts` keeps up to **20** recents (`name, path, date, size`) in
  `localStorage`, most-recent-first, de-duplicated by path.
- Recorded after sealing (SecurityReport) and after opening (OpenArchive).
- Shown on the start screen (`RecentArchives`) with one-click reopen + remove.

## Phase 4 — Archive details

- After opening, the header shows a human-readable details panel: **files, size,
  created date, space saved, format version** — no crypto jargon.
- Backend now exposes `format_version` on the open response
  (`ArchiveInfo`/`OpenArchiveResponse`, read from the archive header).

## Phase 5 — Password generator

- `src/components/PasswordGenerator.tsx`, reachable from the create password field
  ("Generate"). Modes: **memorable passphrase** and **strong random** with a
  custom length slider. Generated locally via `crypto.getRandomValues`. Copy +
  "Use this password".

## Phase 6 — Password check

- The conservative, pattern-aware analyzer (`crates/andrii-crypto/src/password.rs`)
  now also penalizes **predictable year suffixes** (e.g. `Summer2026`).
- Guaranteed never "Strong": `test123`, `password123`, `qwerty123`,
  `asdqwerty123`, `admin2026` — covered by unit tests.

## Phase 7 — Auto-update preparation

- `docs/AUTO_UPDATE_PLAN.md` — architecture only (tauri-plugin-updater, signed
  manifest, user-controlled flow, security requirements). No implementation.

## Phase 8 — About

- Settings → **About**: app version (`get_app_info` Tauri command), author
  (Andrii Kozhushko), license (MIT), website placeholder, archive format version.

## Quality

- `cargo test --workspace --exclude andrii-app`
- `npm run build`
- `npm run tauri build`

Tag: `snapshot/andrii-02a-product-maturity`.

## Notes / future

- Persistence uses WebView2 `localStorage`; could move to a Tauri store/file if
  cross-profile sync is ever needed.
- Slavic plural forms are simplified (single plural word form after counts).
- Recent-archive entries are not validated for existence on display; opening a
  moved/deleted archive surfaces a normal "file not found" error.
