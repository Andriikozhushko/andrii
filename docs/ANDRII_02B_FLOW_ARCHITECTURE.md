# ANDRII 02B — Product Flow Restructure

> ANDRII is **not** a feature dashboard. It is a **flow-based** application.
> The user is always in exactly **one mode**, with exactly **one primary action**.

This milestone changes only product structure / information architecture.
No new features, no icon redesign, no crypto or Rust-core changes.

## 1. Core principle

At any moment the app is in one of three top-level **modes**:

1. **Create** — "How do I seal files?"
2. **Open** — "How do I extract files?"
3. **Verify** — "Is this archive valid?"

Plus a non-mode utility surface: **Settings** (language, password generator, About).

The modes are never shown as equal panels at once. The default state is **Create**.

## 2. Navigation architecture

A **top segmented control** (not a sidebar, not multiple panels) selects the
mode. Settings is a separate, visually subordinate entry at the far right.

```
┌──────────────────────────────────────────────────────────┐
│ [.ANDRII logo]   ( Create │ Open │ Verify )      Settings  │
└──────────────────────────────────────────────────────────┘
```

- The active segment is filled; the others are quiet. The user can always read
  "right now I am in <mode>" from the switcher.
- Switching mode resets that mode to its entry sub-state.

## 3. Mode → sub-state machine (routing logic)

Routing stays a single `CanvasState` discriminated union in `App.tsx`. The top
switcher highlights the **mode group** derived from the current sub-state:

| Mode (switcher) | Sub-states (`CanvasState.mode`)            | Entry sub-state          |
|-----------------|--------------------------------------------|--------------------------|
| Create          | `idle` → `create` → `created`              | `idle`                   |
| Open            | `open` (no path) → `open` (path) → `unlocked` | `open` with empty path |
| Verify          | `verify` (no path) → `verify`/`verified`   | `verify` with no path    |
| Settings        | `settings`                                 | `settings`               |

`modeGroup(state.mode)` → `create | open | verify`:
- `idle, create, created` → **create**
- `open, unlocked` → **open**
- `verify, verified` → **verify**
- `settings` → handled separately (`activeSettings`)

Navigation handler:
```
navigate("create")   → setState({ mode: "idle" })
navigate("open")     → setState({ mode: "open", archivePath: "" })
navigate("verify")   → setState({ mode: "verify" })
navigate("settings") → setState({ mode: "settings" })
```

Drag-drop routing is unchanged: a single `.andrii` file → Open (or Verify if
already in Verify); anything else → Create.

## 4. Screen structure + wireframes (ASCII)

### Create — home (empty)  ·  one primary: **Add files**
```
┌──────────────────────────────────────────────┐
│ [logo]  ( Create │ Open │ Verify )    Settings │
├──────────────────────────────────────────────┤
│                                                │
│                ╭──────────────╮                │
│                │  archive box  │               │
│                ╰──────────────╯                │
│              Drop files to seal                │
│      Create a private .andrii archive only     │
│            your password can open.             │
│                                                │
│        [ Add files ]   ( Add folder )          │   ← 1 primary + 1 secondary
│       Open an archive · Verify an archive      │   ← secondary text links only
│                                                │
└──────────────────────────────────────────────┘
```
No recents. No generator. No clutter.

### Create — files selected  ·  one primary: **Seal archive**
```
├──────────────────────────────────────────────┤
│ 3 files ready · 12.4 MB         +files +folder │
│ [paper][paper][paper]                          │
│ Archive name  [____________________]           │
│ Password      [____________________] 👁         │
│ ▓▓▓░░  Strong key …                            │
├──────────────────────────────────────────────┤
│ Clear                          [ Seal archive ]│   ← single primary
└──────────────────────────────────────────────┘
```

### Open — entry (choose) + recents  ·  one primary: **Choose archive**
```
├──────────────────────────────────────────────┤
│                [paper bundle]                  │
│               Open an archive                  │
│      Drop a .andrii here, or choose one.       │
│              [ Choose archive ]                │   ← single primary
│                                                │
│  RECENT ARCHIVES                               │   ← recents live HERE
│  [vault.andrii] [docs.andrii] [trip.andrii] …  │
└──────────────────────────────────────────────┘
```

### Open — unlock  ·  one primary: **Open box**
```
│                [paper bundle]                  │
│                 name.andrii                    │
│        Enter the password to unlock.           │
│         🔑 [••••••••••••••] 👁                  │
│              [ Open box ]                      │   ← single primary
```

### Open — contents  ·  one primary: **Extract all**
```
│ 🗂 name.andrii    files·size·created·saved·fmt │   ← details panel
│ [filter]  Name Size Date           [Extract all]│  ← primary (Extract N is secondary, only when selected)
│ ☐ report.pdf .......................... 1.2 MB │
│ ☐ photo.png  .......................... 4.8 MB │
```

### Verify — entry  ·  one primary: **Choose archive**
```
│              [seal inspector]                  │
│            Check an archive seal               │
│   Verify that the archive was not modified.    │
│              [ Choose archive ]                │   ← single primary
```

### Verify — result  ·  one action: **Check again**
```
│            [wax seal | cracked seal]           │
│            Seal intact / Seal broken           │
│   This .andrii archive has not been modified.  │
│              ( Check again )                   │
```

### Settings (utility, not a mode)
```
│ Settings                                       │
│ Language   [English][Українська][Русский]…     │
│ Password generator  (Memorable│Random) [pw] ⟳ ⧉│  ← generator lives HERE
│ [ Show the welcome guide again ]               │
│ About  ANDRII · v0.1.0 · MIT · format v1       │
│ ← Back                                         │
```

## 5. What moved (relocations)

| Element            | Before (02A)              | After (02B)                    |
|--------------------|---------------------------|--------------------------------|
| Recent archives    | Create home screen        | **Open mode** entry screen     |
| Password generator | Create password field     | **Settings** only              |
| Open / Verify entry| Top nav only              | Top switcher **+ home links**  |

## 6. Information-architecture rule (enforced)

- Each screen answers exactly one question (Create / Open / Verify).
- Exactly one primary (filled) button is visible per screen; everything else is
  secondary (outline), a quiet text link, a selection toggle, or hidden until
  relevant (e.g. "Extract N" appears only when files are selected).

## 7. Files touched

- `src/components/TitleBar.tsx` — segmented mode control + subordinate Settings.
- `src/App.tsx` — home = Create only (+ secondary links), recents moved into the
  Open entry screen.
- `src/pages/CreateArchive.tsx` — remove the inline password generator.
- `src/components/Settings.tsx` — add the password generator section.
- `src/components/PasswordGenerator.tsx` — `onUse` optional (Settings has no field).

No backend, crypto, format, or icon changes.
