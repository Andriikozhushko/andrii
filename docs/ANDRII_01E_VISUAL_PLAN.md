# ANDRII 01E — Visual Design Plan

## Problems being fixed

1. **Drag & drop broken** — `dataTransfer.files[n].path` is undefined in Tauri webview. Fix: use `listen("tauri://file-drop", ...)` native Tauri events.
2. **Dark theme reads as hacker toy** — switching to light-first theme.
3. **Everything too small** — increasing icon sizes, headings, card dimensions.
4. **No product identity** — indigo brand mark + consistent accent throughout.
5. **Password KDF estimate not believable** — weak passwords (score ≤ 1) override to honest text.

---

## Brand Identity

**Wordmark:** ■ ANDRII  (6×6 indigo square + spaced uppercase letters)

**Accent:** Indigo-600 `#4F46E5` — distinctive, premium, reads as "secure + trusted"

**Not:** generic blue, hacker green, or dark backgrounds

---

## Color Tokens (Light Theme)

```
Background    #F9FAFB  gray-50
Surface       #FFFFFF  white
Elevated      #F3F4F6  gray-100
Border        #E5E7EB  gray-200
Text primary  #111827  gray-900
Text muted    #9CA3AF  gray-400
Accent        #4F46E5  indigo-600
Success       #059669  emerald-600
Warning       #D97706  amber-600
Danger        #DC2626  red-600
```

---

## Typography Scale

```
2xs    11px / 1rem    — metadata, timestamps, tech details
xs     12px / 1rem    — labels, subtitles
sm     13px / 1.25   — body text
base   14px / 1.5    — form inputs, descriptions
lg     16px / 1.5    — section headings
xl     20px / 1.75   — canvas headings
2xl    24px / 2rem   — drop zone heading
3xl    32px / 2rem   — score number (large)
8xl    96px           — security score number
```

---

## Spacing System

```
xs    4px
sm    8px
md    16px
lg    24px
xl    32px
2xl   48px
```

---

## Icon Sizes

```
Window controls   10px SVG
Navigation        15px Lucide
Inline / labels   13–14px Lucide
Value strip       20px Lucide  (in 44px colored container)
File card type    22px Lucide  (in 48px colored container)
Drop zone         56px Lucide
Security score    96px numeric text
```

---

## Layout Structure

```
┌──────────────────────────────────────────────────────┐  ← 40px title bar
│ ■ ANDRII              [New][Open][Verify]  [─][□][×] │
│──────────────────────────────────────────────────────│
│                                                      │
│                     CANVAS                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Window: 1100 × 760, min 880 × 600
Title bar background: white, subtle border-b (gray-100)

---

## State Wireframes

### 1. Idle — Create (drop zone)

```
┌────────────────────────────────────────────────────────────────────┐
│ ■ ANDRII                    [+][⊡][✓]            [─][□][×]       │  40px
│────────────────────────────────────────────────────────────────────│
│                                                                    │
│  ╔══════════════════════════════════════════════════════════════╗  │
│  ║                                                              ║  │
│  ║                                                              ║  │
│  ║                     [Shield 56px]                            ║  │
│  ║                                                              ║  │
│  ║            Drop files or folders here                        ║  │ ← 24px heading
│  ║                                                              ║  │
│  ║        Files become encrypted .andrii archives.              ║  │ ← 14px muted
│  ║        Only you can open them.                               ║  │
│  ║                                                              ║  │
│  ║          [Add Files]          [Add Folder]                   ║  │
│  ║                                                              ║  │
│  ║              or open an existing .andrii archive ↗           ║  │
│  ║                                                              ║  │
│  ╚══════════════════════════════════════════════════════════════╝  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

Note: The dashed box IS the entire canvas (24px inset). Full height.
      Border pulses to accent on drag-hover.
```

### 2. Create — Files selected (cards + form)

```
┌────────────────────────────────────────────────────────────────────┐
│ ■ ANDRII                    [+][⊡][✓]            [─][□][×]       │
│────────────────────────────────────────────────────────────────────│
│                                                                    │
│  3 files selected                          [+ Add]  [+ Folder]   │ ← header row
│  ────────────────────────────────────────────────────────────     │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│  │        [×]│ │        [×]│ │        [×]│ │        [×]│        │
│  │           │ │           │ │           │ │           │        │
│  │  [PDF 🔴] │ │  [IMG 🟣] │ │  [XLS 🟢] │ │  [ZIP 🟡] │        │ ← 48px icon
│  │           │ │           │ │           │ │           │        │
│  │ report.pdf│ │ photo.jpg │ │ budget.xls│ │ backup.zip│        │ ← 13px semibold
│  │   2.3 MB  │ │  880 KB   │ │   45 KB   │ │  12.1 MB  │        │ ← 11px muted
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘        │
│                                                                    │
│  ──────────────────────────────────────────────────────────────── │
│   [🔒] End-to-end    [🙈] Names    [🛡] Tamper    [💾] No cloud  │ ← value strip
│        encrypted          hidden       proof                      │
│  ──────────────────────────────────────────────────────────────── │
│                                                                    │
│  Archive name   [quarterly-report                               ]  │ ← underline input
│  Password       [••••••••••                              [👁]]    │
│                 ████████░░░░░  Strong · 78-bit entropy            │ ← strength bar
│                 Without: 3 months  |  With ANDRII: > 50 years    │
│                                                                    │
│────────────────────────────────────────────────────────────────── │
│  [Clear all (ghost)]                  [Create encrypted archive →]│
└────────────────────────────────────────────────────────────────────┘
```

### 3. Security Report (replaces canvas, no modal)

```
┌────────────────────────────────────────────────────────────────────┐
│ ■ ANDRII  Protected                 [+][⊡][✓]     [─][□][×]     │
│────────────────────────────────────────────────────────────────────│
│                                                                    │
│                            100                                     │ ← 96px indigo
│                          PERFECT                                   │ ← 11px tracked
│                                                                    │
│               quarterly-report.andrii · 4 files [📋]              │
│                                                                    │
│   ──────────────────────────────────────────────────────────────  │
│   ✓ File contents encrypted                                        │
│   ✓ File names hidden inside archive                               │
│   ✓ Integrity sealed — tamper-evident                              │
│   ──────────────────────────────────────────────────────────────  │
│                                                                    │
│   Password strength       Very Strong                              │
│   Without protection      < 1 second                               │
│   With ANDRII KDF         > 50 years                               │
│                                                                    │
│   ▸ Technical details                                              │
│                                                                    │
│────────────────────────────────────────────────────────────────── │
│   [Encrypt another (ghost)]                            [Done →]   │
└────────────────────────────────────────────────────────────────────┘
```

### 4. Open Archive — idle

```
┌────────────────────────────────────────────────────────────────────┐
│ ■ ANDRII                    [+][⊡][✓]            [─][□][×]       │
│────────────────────────────────────────────────────────────────────│
│  ╔══════════════════════════════════════════════════════════════╗  │
│  ║                                                              ║  │
│  ║                   [FolderOpen 56px]                          ║  │
│  ║                                                              ║  │
│  ║          Drop an .andrii archive here                        ║  │
│  ║                                                              ║  │
│  ║              or [Browse archive]                             ║  │
│  ║                                                              ║  │
│  ╚══════════════════════════════════════════════════════════════╝  │
└────────────────────────────────────────────────────────────────────┘
```

### 5. Open Archive — unlock form

```
┌────────────────────────────────────────────────────────────────────┐
│                         [centered, max-w-sm]                       │
│                                                                    │
│   backup-2026.andrii                                               │ ← filename
│   /Users/andrii/Documents/backup-2026.andrii                      │ ← path, muted
│                                                                    │
│   Password  [•••••••••••••••••••••••••••••••••••••••••]  [👁]    │
│                                                                    │
│   [Wrong password or file error message]                           │
│                                                                    │
│             [Unlock archive →          (full width btn)]           │
└────────────────────────────────────────────────────────────────────┘
```

### 6. Verify — idle / result

```
┌────────────────────────────────────────────────────────────────────┐
│                     [centered content]                             │
│                                                                    │
│              [ShieldCheck 56px, indigo]                            │
│                                                                    │
│          Drop an .andrii archive to verify it                      │
│          No password needed — integrity check only                 │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

On result (valid):
│   [ShieldCheck 32px]  Archive is authentic                         │
│                       contents unmodified since creation           │
│                                                                    │
│   ✓ Valid ANDRII format                                            │
│   ✓ Supported version    (v1)                                      │
│   ✓ Content integrity    BLAKE3 matches                            │

On result (tampered):
│   [ShieldX 32px, red]  Archive has been modified                  │
│                        Do not extract. Cannot be trusted.          │
```

---

## Password Fix (score ≤ 1)

| Password  | score | Without         | With ANDRII KDF (display) |
|-----------|-------|-----------------|---------------------------|
| `test123` |   0   | Instantly       | Seconds to minutes        |
| `fluffy1` |   1   | Instantly       | Minutes to hours           |
| `M0nkey!` |   2   | Minutes         | *actual estimate*          |
| `Tr0ub4d` |   3   | Hours           | *actual estimate*          |
| strong pw |   4   | Centuries       | *actual estimate*          |

Score 0–1 with KDF: override display with honest dictionary-attack-aware text.

---

## Drag & Drop Fix

**Problem:** `dataTransfer.files[n].path` is undefined in Tauri's webview when dragging from Windows Explorer.

**Fix:** Use Tauri's native file drop events:
```typescript
import { listen } from "@tauri-apps/api/event";

listen<string[]>("tauri://file-drop", e => handlePaths(e.payload));
listen("tauri://file-drop-hover", () => setIsDragging(true));
listen("tauri://file-drop-cancelled", () => setIsDragging(false));
```

Remove all DOM `dragenter`/`dragleave`/`dragover`/`drop` listeners.

---

## Value Strip Items

```
Lock        End-to-end encrypted    Files encrypted individually
EyeOff      File names hidden       Archive contents not visible
ShieldCheck Tamper detection        BLAKE3 hash verifies every byte
HardDrive   Stays on your device    No cloud upload, ever
```

---

## File Card Type Icons

| Extension           | Icon      | Color   | Background |
|---------------------|-----------|---------|------------|
| pdf                 | FileText  | #DC2626 | #FEF2F2    |
| jpg/png/gif/webp    | Image     | #7C3AED | #F5F3FF    |
| xlsx/xls/csv        | Table2    | #059669 | #ECFDF5    |
| docx/doc/txt        | FileText  | #2563EB | #EFF6FF    |
| zip/rar/7z/tar/gz   | Archive   | #D97706 | #FFFBEB    |
| mp4/mov/avi/mkv     | Video     | #EA580C | #FFF7ED    |
| mp3/wav/flac        | Music     | #DB2777 | #FDF2F8    |
| (folder)            | Folder    | #F59E0B | #FFFBEB    |
| (other)             | File      | #6B7280 | #F9FAFB    |

---

## Commit Target

Tag: `snapshot/andrii-01e-product-ui-reboot`
