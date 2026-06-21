# ANDRII 03B — Vault Component Implementation

Implements 03A: one real reusable component, **`<Vault />`**, is now the single
visual center of the whole app. Create / Open / Verify are the same object in
different states. No new features, no crypto/flow/mode/nav changes.

## 1. `Vault.tsx`

A pure, deterministic component (`src/components/Vault.tsx`). Renders only from
props — no screen logic, no time/random — so it is reusable and testable.

```ts
type VaultState = "idle" | "filling" | "sealed" | "unlocking" | "opened" | "broken";
type VaultTone  = "neutral" | "safe" | "danger";

<Vault state={VaultState} size={number} tone={VaultTone} />
```

One hand-drawn archive box + wax seal. Across states only four things change —
**lid angle, wax (none / intact / cracked), contents, glow** — everything else
(silhouette, ink weight, palette) is invariant, so it reads as the *same* object
transforming. Behavior per state:

| State | Lid | Wax | Contents | Motion |
|-------|-----|-----|----------|--------|
| idle | open | — | none | calm |
| filling | open | — | paper slips ease in | slips rise |
| sealed | closed | intact | hidden | wax **stamps in** |
| unlocking | closed | intact (keyhole) | hidden | keyhole/glow **pulses** (no spinner) |
| opened | open | — | slips visible | lid lifts |
| broken | closed | **cracked** | hidden | short **shake** |

`tone` only tints the glow (`safe` = green for an intact verified seal, `danger`
= wax red; `broken` forces danger). Lid is a `<g>` rotated via CSS
`transform-box: view-box` with a spring-ease transition; wax/contents/glow
cross-fade. Respects `prefers-reduced-motion` (global rule).

`VaultScene` (same file) is the standard page layout: Vault centered, with only
secondary caption text + affordances beneath it — `<Page><Vault/></Page>`.

## 2. Vault state machine mapping (app sub-state → VaultState)

The 02C flow architecture is unchanged; each flow sub-state simply maps to a
Vault state. The Vault is the visual; the flow is internal.

| Mode | App sub-state | `VaultState` (tone) |
|------|---------------|---------------------|
| Create | idle (empty) | `idle` |
| Create | files gathered | `filling` |
| Create | configure (name + key) | `filling` |
| Create | sealing (in progress) | `sealed` (stamps in) |
| Create | success | `sealed` (tone `safe`) |
| Open | select | `sealed` |
| Open | password | `sealed` |
| Open | unlocking | `unlocking` |
| Open | contents (header) | `opened` |
| Verify | choose | `sealed` |
| Verify | checking | `unlocking` |
| Verify | intact | `sealed` (tone `safe`) |
| Verify | broken / not-an-archive | `broken` |
| Onboarding | step 1 / 2 / 3 | `idle` / `sealed` / `opened` |
| Settings | About mark | `sealed` |

## 3. Refactored screen wrappers

Screens keep their logic (files, password, metadata, current operation) but no
longer own the visual identity — they render the Vault in the right state and
arrange only secondary text/affordances around it.

- **`App.tsx`** — Create/Open/Verify entry heroes pass `<Vault state=…/>`
  (idle / sealed / sealed); the drag overlay shows `filling`.
- **`CreateArchive.tsx`** — `filling` (files gathered → shown as quiet chips,
  not a card grid) → `filling` (name + key as secondary inputs under the Vault)
  → `sealed` (the **step-ladder removed**; the closing vault is the progress).
- **`SecurityReport.tsx`** — success is `sealed` + `safe` glow with details as
  secondary text.
- **`OpenArchive.tsx`** — `sealed` (password) → `unlocking` (replaces the
  spinner) → `opened` header above the contents (the list reads as the vault's
  interior).
- **`VerifyArchive.tsx`** — `unlocking` (inspecting) → `sealed`+`safe` (intact) /
  `broken` (compromised). No spinner.
- **`Onboarding.tsx` / `Settings.tsx`** — also use the Vault, so the object is
  literally everywhere.

The five separate illustrations (ArchiveBox / WaxSeal / CrackedSeal / PaperBundle
/ SealInspector) are no longer used as screen subjects — replaced by the one
Vault. (Their source remains in `art/` but unused; small ink glyphs like
`InkFileGlyph` stay for list-item/label decoration only.)

## 4. Before / after architecture

| | Before (02C) | After (03B) |
|-|--------------|-------------|
| Visual subject | a different illustration per screen/state (box, paper bundle, seal inspector, wax seal, cracked seal) | **one `<Vault>`** in different states, everywhere |
| Create files | grid of file **cards** | Vault `filling` + quiet chips (secondary) |
| Sealing | 4-row **step ladder** (Collecting/Encrypting/Sealing/Finalizing) | Vault **closing/stamping** + one caption |
| Open unlocking | **spinner** loader | Vault `unlocking` (seal tension) |
| Verify result | separate WaxSeal / CrackedSeal illustrations | same Vault → `sealed`(safe) / `broken` |
| Identity | "screens with similar styling" | "the same object transforming" |
| Component reuse | per-screen illustrations | single deterministic `Vault` (state + data props) |

## 5. Success criterion

Any screen now answers "this is the Vault changing state," not "multiple UI
sections." The object is the constant; the flow is the path it takes.

## 6. Constraints honored

No features, no crypto, no flow/mode/nav changes, no dashboards, no forms-first
design, no settings-feature changes. Only the central visual system was
introduced and the screens refactored around it.

Deliverables: (1) `src/components/Vault.tsx`; (2) state-machine mapping (§2);
(3) refactored wrappers (§3); (4) this doc; (5) before/after (§4).
