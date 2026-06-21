# ANDRII 02C — Flow Depth System

> Each mode is a **stateful flow**, not a page. At any instant exactly **one
> state** is active — no mixed UI, no permanent sections, no forms shown before
> they're relevant. The user should feel they are *performing a secure action*,
> not filling a form.

Scope: deepen UX flow only. No new features, no crypto/Rust changes, no change to
the Create/Open/Verify mode system, no icon redesign.

## 1. Create mode — state machine

Stages 1–3 + 5/6 are React `CanvasState` modes in `App.tsx`; stages 2/3/4 are an
**internal step** inside `CreateArchive` (`step: "files" | "config"` + `sealing`).

```
 (idle/empty) ──add/drop files──▶ FILES ──Continue──▶ CONFIG ──Seal──▶ SEALING ──▶ (created/success) ──Done/Seal another──▶ (idle)
      ▲                              │  ▲                 │                                                          │
      └──────────── Clear ──────────┘  └──── Edit files ──┘                                                          │
      └──────────────────────────────────────── exit ◀───────────────────────────────────────────────────────────┘
```

| # | State | Canvas / step | Shows (only this) | Primary action |
|---|-------|---------------|-------------------|----------------|
| 1 | Empty | `idle` | archive-box hero, "Drop files to seal" | Add files |
| 2 | Files selected | `create` · `step=files` | file cards (assemble-in) + add more | **Continue** |
| 3 | Configuration | `create` · `step=config` | files recap + **name + password** (first appearance) | **Seal archive** |
| 4 | Sealing | `create` · `sealing=true` | full-screen staged progress | — (locked) |
| 5 | Success | `created` | sealed-archive object stamps in | Done |
| 6 | Exit | `idle` | back to empty | — |

Name + password **do not exist** in states 1–2. They mount only in state 3.

### Sealing sub-steps (state 4)

Driven by the `archive-progress` events; the UI shows a 4-step ladder:

```
 sealStage:  0 Collecting files → 1 Encrypting content → 2 Sealing archive → 3 Finalizing
 derivation: progress==null →0 ; 0<cur<total →1 ; cur>=total →2 ; invoke resolved →3 (≈500ms) → success
```

## 2. Open mode — state machine

```
 SELECT ──choose/recent/drop──▶ PASSWORD ──unlock──▶ UNLOCKING ──ok──▶ CONTENTS ──extract──▶ EXTRACTING ──▶ DONE(banner)
   ▲                               │  (error → back to PASSWORD)            │                                  │
   └─────────────── Back ──────────┘                                        └──────────── stays in CONTENTS ───┘
```

| # | State | Canvas / local | Shows | Primary |
|---|-------|----------------|-------|---------|
| 1 | Select | `open` (no path) | paper-bundle hero + recents | Choose archive |
| 2 | Password | `open` (path), `!loading` | bundle + password field | Open box |
| 3 | Unlocking | `open` (path), `loading` | bundle + animated "Unlocking…" (replaces form) | — |
| 4 | Contents | `unlocked` | details + file list | Extract all |
| 5 | Extracting | `unlocked` + `extracting` | list dimmed + "Extracting…" overlay | — |
| 6 | Done | `unlocked` + status | success banner | Close |

## 3. Verify mode — state machine (already staged in 02B)

```
 CHOOSE ──choose/drop──▶ CHECKING (animated inspector) ──▶ RESULT { intact | broken | no-seal }
   ▲                                                            │
   └───────────────────────── Check again ─────────────────────┘
```

## 4. React state structure proposal

```ts
// App.tsx — top-level mode/sub-state (unchanged union, drives which flow renders)
type CanvasState =
  | { mode: "idle" }                       // Create · empty
  | { mode: "create"; files: string[] }    // Create · files+config+sealing (internal)
  | { mode: "created"; ... }               // Create · success
  | { mode: "open"; archivePath: string }  // Open · select/password/unlocking
  | { mode: "unlocked"; ... }              // Open · contents/extract/done
  | { mode: "verify"; archivePath?: string }
  | { mode: "verified"; ... }
  | { mode: "settings" };

// CreateArchive.tsx — internal flow state (the new depth)
const [step, setStep]       = useState<"files" | "config">("files");
const [creating, setCreating] = useState(false);   // → SEALING
const [sealStage, setSealStage] = useState<0|1|2|3>(0);

// OpenArchive.tsx
const [loading, setLoading] = useState(false);     // PASSWORD → UNLOCKING
// UnlockedArchive.tsx
const [extracting, setExtracting] = useState(false); // CONTENTS → EXTRACTING
```

Rendering is a single switch — only the active state's JSX is mounted:
`if (creating) return <Sealing/>; if (step==="config") return <Config/>; return <Files/>;`

## 5. Transition rules

| From | Event | To | Guard | Motion |
|------|-------|----|-------|--------|
| Empty | add/drop files | Files | ≥1 file | cards stagger-in (slide-up) |
| Files | Continue | Config | ≥1 file | crossfade / slide-up |
| Files | Clear | Empty | — | fade |
| Config | Edit files | Files | — | crossfade back |
| Config | Seal archive | Sealing | name+password set, save-dialog confirmed | fade to centered process |
| Sealing | progress events | (sub-steps) | — | step ladder advances, box pulses |
| Sealing | invoke resolved | Success | — | sealed object stamps in (scale/rotate settle) |
| Sealing | error | Config | — | fade back, error text |
| Success | Done / Seal another | Empty | — | fade |
| Password | Open box | Unlocking | password non-empty | form → animated unlocking |
| Unlocking | ok / error | Contents / Password | — | fade |
| Choose(verify) | file chosen | Checking | — | inspector pulse |
| Checking | result | Result | — | wax seal stamp / cracked-seal shake |

## 6. Animation language (calm · premium · deliberate)

- Durations 160–420ms, ease-out / spring-settle. Respect `prefers-reduced-motion`.
- File cards **assemble**: staggered `slide-up` (≈40ms × index).
- State changes **crossfade** within the same container (no hard cuts).
- Sealing: box `scale-in`, a gentle pulse, the step ladder advances one row at a time.
- Success: sealed archive **stamps in** (`stamp-in`).
- No neon, no flashy/gaming effects, no chaotic motion.

## 7. Information-priority rule (enforced)

Each state renders only its own controls. The password input literally does not
exist in the DOM during Empty/Files. "Extract N" appears only with a selection.
Exactly one primary (filled) button per state.

## 8. Files touched

- `src/pages/CreateArchive.tsx` — internal `files → config → sealing` states +
  staged sealing ladder + card stagger.
- `src/pages/OpenArchive.tsx` — distinct Unlocking state + Extracting overlay.
- `src/i18n/*.json` — step labels (`create.stepCollecting…`, `continue`, `editFiles`).
- `src/styles/globals.css` / `tailwind.config.ts` — only if a stagger util is needed.

No backend, crypto, mode-system, or icon changes.
