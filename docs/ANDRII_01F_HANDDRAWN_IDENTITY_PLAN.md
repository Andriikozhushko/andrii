# ANDRII 01F — Stylized Identity Reboot: Hand-Drawn Vault

> A magical secure archive box. Hand-drawn ink, parchment, wax seals.
> Premium but weird. Memorable. Light theme only.

This plan supersedes the sterile "refined light" direction (01E). It is the
source of truth for the 01F implementation.

**Inspiration (broad only):** hand-drawn ink lines, parchment/paper surfaces,
strange little vault objects, sealed boxes, wax seals, black ink outlines,
slightly odd handcrafted UI. **Not** an imitation of any game's assets,
characters, fonts, or UI. All illustrations are original inline SVG.

---

## 1. Palette

Light theme only. No dark mode, no neon, no glassmorphism.

| Token | Value | Use |
|---|---|---|
| `--c-bg` (parchment) | `#F3ECDD` warm paper | app background |
| `--c-bg-2` | `#EFE7D4` | deeper parchment / drop zone fill |
| `--c-surface` (off-white card) | `#FBF7EE` | cards, panels |
| `--c-surface-sunken` | `#F0E8D6` | insets |
| `--c-ink` (text/lines) | `#2A2622` near-black brown-ink | text, hand-drawn outlines |
| `--c-ink-soft` | `#5B5347` | secondary text |
| `--c-ink-faint` | `#8B8170` | muted text, captions |
| `--c-line` | `#2A2622` | ink stroke for illustrations (1.75–2.5px) |
| `--c-border` | `#D9CEB6` | card hairlines |
| `--c-accent` (ANDRII violet) | `#5B53C6` muted indigo | primary actions, accent |
| `--c-accent-deep` | `#48409E` | hover/pressed |
| `--c-accent-soft` | `#E7E3F7` | accent wash |
| `--c-wax` (red seal) | `#B23A35` wax red | wax seal, danger/tampered |
| `--c-wax-deep` | `#8E2B27` | wax shadow |
| `--c-safe` (green) | `#3E7D5A` muted green | verified/safe ONLY, used rarely |

Paper texture: a very subtle SVG/dot grain on the parchment background + faint
two-tone radial warmth. No photographic textures.

## 2. Typography

- **Display / wordmark / titles:** a warm humanist serif with character —
  `"Fraunces"` (variable, hand-ish, available on Google Fonts) for headings and
  the ANDRII wordmark. Fallback: `Georgia, serif`.
- **Body / UI:** keep `Inter` for legibility of labels, inputs, file names.
- **Mono:** `JetBrains Mono` for paths/filenames/sizes only.
- Headings use the serif to feel handcrafted; body stays clean for usability.
- Slightly loose tracking on the wordmark; ink color `--c-ink`.

## 3. Icon / Illustration System (ABSOLUTE RULE)

No generic Lucide/Heroicons shields, folders, locks, checkmarks in the **main
UI surfaces** (hero, empty states, results, verdicts, file cards, top bar).
All replaced by original inline-SVG ink illustrations in `src/components/art/`:

| Primitive | Component | Where |
|---|---|---|
| Archive chest / sealed box (open + closed) | `ArchiveBox` | create empty state, results |
| Wax seal (intact, stampable) | `WaxSeal` | protected success, verify intact |
| Cracked / broken wax seal | `CrackedSeal` | tampered verify |
| Paper bundle / tied folder | `PaperBundle` | open flow, folder selection |
| Ink file card (paper slip) | `InkFileCard` | selected files |
| Keyhole | `Keyhole` | password field affordance |
| Seal inspector (box + magnifier) | `SealInspector` | verify empty state |

Style rules: black-ink outlines (`--c-ink`, 1.75–2.5px, round caps/joins),
slightly irregular/handcrafted geometry, parchment/off-white fills, wax-red and
muted-violet sparingly. No gradients-as-decoration beyond soft paper shading.

Small functional affordances (window controls, the show/hide-password eye, the
remove-file ✕, chevrons) may remain simple strokes — they are controls, not
identity icons — but drawn in the same ink weight.

## 4. App Shell

- Remove the three tiny unclear top-right icon buttons.
- Custom top bar: **ANDRII** wordmark (serif, ink) at left; centered/left text
  nav with labels — **New Archive · Open Archive · Verify**; **Settings** as
  small text/ink at far right. Active item underlined with a hand-drawn ink
  underline + violet ink.
- Window controls (min / max / close) remain functional, drawn as thin ink
  glyphs; close hover = wax red.
- The bar sits on parchment with a hand-drawn bottom rule (slightly wavy ink
  line), so it does not read as a Windows form titlebar.
- Whole window draggable from the bar (keep `startDragging`).

## 5. Screen Layout Plan

### Create — empty
- Large central `ArchiveBox` (open chest) illustration.
- Title (serif): **"Drop files to seal"**.
- Subtext: "Create a private .andrii archive only your password can open."
- Buttons: **Add files**, **Add folder**.
- Drop response: box lid lifts / glow + parchment darkens on drag-over.

### Create — files selected
- Files shown as **InkFileCard** paper slips (filename, size, remove ✕) — not
  tiny rows, not generic file icons.
- Section with clear labels: **Archive name**, **Password** (+ keyhole), strength.
- Primary button: **"Seal archive"** (consistent metaphor; never "Protect 2 files").

### Create — sealing (progress)
- Box closing + wax seal stamping animation; progress %, current file.
- Copy: "Sealing your files…" → "Pressing the seal…".

### Protected — success (full screen)
- Large sealed `ArchiveBox` with stamped `WaxSeal` (stamp-in animation).
- Title (serif): **"Archive sealed"**.
- Subtitle: "Only the password can open it. There is no recovery."
- Details: archive name · file count · final size · compression savings.
- Actions: **Show in folder · Seal another · Done**.

### Verify — empty
- `SealInspector` (sealed box + magnifier) illustration.
- Title: **"Check an archive seal"**.
- Subtext: "Verify that the archive was not modified after creation."
- Button: **Choose archive**.

### Verify — intact
- Large intact `WaxSeal`. Title: **"Seal intact"**.
- Subtext: "This .andrii archive has not been modified." (green used sparingly).

### Verify — tampered
- `CrackedSeal` with a short shake animation. Title (wax red): **"Seal broken"**.
- Subtext: "This archive was modified. Do not trust it."

### Open — unlock + contents
- Keep functional contents browser, restyled to parchment/ink; identity via
  `PaperBundle` + `Keyhole`, no generic folder/lock icons in headers.

## 6. Password Logic Rules (Rust: `crates/andrii-crypto/src/password.rs`)

Rewrite the analyzer to be conservative and pattern-aware.

**Must be weak (never Strong/Excellent):** `test123`, `asdasdasd`,
`asdqwerty123`, `qwerty123`, `password123`, `admin123`, `123456789`,
repeated keyboard patterns, repeated chunks (`asd/asd/asd`).

**Detection added/strengthened:**
- Expanded common-password list + **base-word + digit/symbol suffix** stripping
  (`password123` → `password` ⇒ treated as common).
- **Keyboard runs** (`qwerty`, `asdf`, `zxcv`, `1234…`, reverses) of length ≥4
  collapse to a few bits.
- **Repeated chunks** via smallest-period detection: `asdasdasd` ⇒ entropy of one
  unit + log2(repeats).
- **Word+digits(+symbols)** structure capped by a dictionary-style estimate
  (single alpha run of any length, not just ≤8).
- Sequence/repetition penalties retained.
- Random/high-entropy passwords keep full per-character entropy (so genuine
  strong passwords still score Strong/Excellent).

**Buckets (displayed crack time derived from level — never absurd):**

| Level (score) | Displayed time |
|---|---|
| Very weak (0) | Instantly / seconds |
| Weak (1) | Minutes to hours |
| Fair (2) | Days to weeks |
| Strong (3) | Months to years |
| Excellent (4) | Many years |

**Never display** "Millions of years" or "Billions of years".

**Entropy → level thresholds (bits):** `<18` Very weak · `18–34` Weak ·
`34–50` Fair · `50–68` Strong · `≥68` Excellent. Common ⇒ Very weak.

**UI copy:** labels = Very weak / Weak / Fair / Strong / Excellent.
Recommendation: "Use 12+ characters with unrelated words, numbers and symbols,
or use a password manager."

(Rename `StrengthLevel::VeryStrong` display label to **"Excellent"**; score
stays 0–4 so the frontend bar is unchanged.)

## 7. Animation

- Drop zone reacts on drag-over (lid lift / parchment darken / soft scale).
- Seal **closes** during creation; **wax stamp** appears on success.
- **Broken seal shake** on tampered verify.
- Buttons: tactile hover/press (ink press, slight translate). Keep 150–260ms,
  ease-out; respect restraint — no cartoon chaos. Honor `prefers-reduced-motion`.

## 8. Acceptance Checklist

- [ ] No Lucide/Heroicons shield/folder/lock/check in main UI surfaces.
- [ ] Parchment light theme; no dark mode / neon / glass.
- [ ] Serif identity type for wordmark + titles; Inter for body.
- [ ] Top bar uses text labels (New Archive / Open Archive / Verify) + Settings.
- [ ] Create empty: archive-box illustration + "Drop files to seal".
- [ ] Selected files render as ink paper cards (name, size, remove).
- [ ] Labels are "Archive name" / "Password"; button "Seal archive".
- [ ] Protected: sealed box + stamped wax seal + details + 3 actions.
- [ ] Verify: inspector empty state; intact seal; broken seal (shake).
- [ ] Password: `asdqwerty123` ≤ Fair; common/pattern passwords weak.
- [ ] No "millions/billions of years" anywhere.
- [ ] Animations present but restrained.
- [ ] `cargo test --workspace --exclude andrii-app` green.
- [ ] `npm run build` green; `npm run tauri build` produces exe.
- [ ] Commit + tag `snapshot/andrii-01f-handdrawn-identity`.
