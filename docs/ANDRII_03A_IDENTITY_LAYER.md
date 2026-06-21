# ANDRII 03A — Product Identity Core Layer

> Design + system only. **No code, no implementation** in this milestone.
> Architecture and flows from 02C stay exactly as they are. What changes is the
> *visual identity*: every screen must revolve around **one object** that the
> user remembers — "ANDRII is the app with the sealed vault."

This document is the deliverable. It defines the central object, the visual
system rules, the object lifecycle (with diagram), per-mode screen descriptions,
and a before/after of UI language. Implementation lands later (03B).

---

## 0. Problem → goal

ANDRII has flows, states, animations and a crypto core, but reads as "different
screens with similar styling." There is no central identity object, no single
visual metaphor, no anchor, no emotional memory.

**Goal:** introduce ONE central product metaphor present in Create / Open /
Verify. The user must perceive **the same thing transforming**, not a set of
modes. Flows continue to exist internally but become visually secondary to the
object.

---

## 1. The central object — **The Vault**

> A small, hand-drawn **archive box** closed by a **wax seal** with a keyhole.
> One artifact. It is never decoration and never an icon — it is the subject of
> every screen. All other UI (text, fields, buttons) arranges itself *around*
> the Vault as captions and affordances.

We already own the raw form (01F `ArchiveBox` + `WaxSeal`). 03A elevates it from
"illustration that appears" to "the thing the app is about."

### Anatomy (fixed across all states — this is what makes it recognizable)
- **Body** — the box/chest: parchment-filled, black-ink outline, slightly
  irregular/handcrafted.
- **Lid** — opens (idle/opened) or closes (sealing/sealed).
- **Wax seal** — wax-red disc on the front/lid; carries a small keyhole/monogram.
  Its state is the product's emotional signal: pristine = safe, cracked = danger.
- **Keyhole** — the single point of access; the password "turns" it.
- **Contents** — paper slips that peek out when open, hidden when sealed.

### Invariants
- Same silhouette, line weight, palette (parchment / ink / wax-red / petrol
  accent / rare green) in every state. Only **lid angle, wax state, contents
  visibility, and glow** change. Continuity of these invariants = the "same
  object transforming."
- Exactly **one** Vault on screen at any time. Never two, never a grid of them.

---

## 2. Visual system rules (object-first)

1. **One object per screen.** The Vault is the largest, most central element of
   every mode's primary state. Everything else is subordinate.
2. **No icons as subjects.** Small ink glyphs may still label controls, but the
   *subject* of a screen is always the Vault, never an icon/card/list.
3. **Chrome recedes.** Titles become short captions under/over the object;
   inputs and buttons sit beneath it as quiet affordances. No panels competing
   with the object for attention.
4. **The object carries progress, not a checklist.** Process is shown by the
   Vault transforming (lid closing, wax stamping, keyhole turning), not by step
   indicators, progress dashboards, or "stage N of M" UI.
5. **Continuity over transition.** Moving between states animates the *same*
   Vault (lid/seal/glow), never a hard cut to a different illustration.
6. **One emotional signal: the seal.** Intact wax = trust; cracked wax = danger;
   forming wax = in progress. Color is reinforcement, the seal is the message.
7. **Calm, physical motion only.** 160–460ms, ease-out / spring-settle; respects
   `prefers-reduced-motion`. No neon, no gaming FX, no chaotic motion.
8. **Copy is physical, not technical.** UI language describes what is happening
   to the object ("Sealing the box"), never the machine ("Configuration state").

---

## 3. Object lifecycle (the single artifact's states)

The Vault has a small, fixed vocabulary of visual states. Every mode is just a
path through these states — that is the whole product.

```
                         ┌──────────────────────────────────────────────┐
                         │                 THE VAULT                      │
                         └──────────────────────────────────────────────┘

   OPEN ──fill──▶ FILLING ──close──▶ SEALING ──stamp──▶ SEALED ──┐
   (lid up,        (papers           (lid lowers,        (lid shut, │
    empty)          gather in)        wax dripping)       wax intact)│
                                                                     │
                          ┌──────────────────────────────────────────┘
                          │
              key turns   ▼                       inspect
   SEALED ───────────▶ UNLOCKING ──open──▶ OPENED        SEALED ───────▶ INSPECTING
   (keyhole glows,     (wax lifts,         (lid up,      (magnifier      │
    turning)            lid cracks open)    contents)     over seal)     │
                                                                          ▼
                                                          ┌──────────────────────────┐
                                                          │  INTACT          BROKEN   │
                                                          │ (whole seal,   (cracked   │
                                                          │  soft glow)     wax, shake)│
                                                          └──────────────────────────┘
```

### Per-state visual description (frames to build in 03B)

| State | Lid | Wax seal | Contents | Glow / motion |
|-------|-----|----------|----------|---------------|
| **OPEN** (idle) | up / open | none yet | empty, faint | still; gentle hover |
| **FILLING** | up | none | paper slips slide/settle in | slips ease in (stagger) |
| **SEALING** | lowering | wax forming, dripping | hidden as lid closes | lid descends, wax pours |
| **SEALED** | shut | intact, monogram pressed | hidden | wax **stamps in** (scale+settle), brief glow |
| **UNLOCKING** | shut→ajar | intact, keyhole lit | hidden | keyhole turns, wax lifts at one edge |
| **OPENED** | up | set aside / broken-open (by owner) | slips visible (the file list) | lid opens, contents fade in |
| **INSPECTING** | shut | intact, under magnifier | hidden | magnifier glides over seal; slow |
| **INTACT** | shut | whole, soft green-tinged glow | hidden | seal pulses once, settles |
| **BROKEN** | shut/ajar | cracked in two, chip missing | hidden | short shake, then still |

Implementation note (03B): one `Vault` component with a `state` prop animating
lid angle, wax opacity/crack, contents and glow — **not** separate illustrations.

---

## 4. Per-mode screen descriptions (revolving around the Vault)

Each mode is a transformation of the same Vault. Flow states (02C) persist
internally; they are no longer the visual subject.

### CREATE — "the box being formed and sealed"
- **Empty:** OPEN vault, centered. Caption: *"An empty vault. Drop your things in."*
  Affordances beneath: Add files · Add folder.
- **Filling:** vault stays open; dropped items become paper slips that **gather
  into the vault** (the old file cards become the vault's contents, not a grid
  floating beside it). Caption shows what's inside ("3 things, 12 MB"). One
  action: *Close the lid →*.
- **Lock the box:** the vault sits closed-but-unsealed; the **keyhole** is the
  focal affordance — name + the password (the "key") appear *attached to the
  vault* (a label tag for the name, the keyhole for the key), not as a form card.
  One action: *Seal it*.
- **Sealing:** the lid lowers and **wax pours and stamps** on the vault itself —
  the transformation IS the progress. No visible 4-row step ladder; any sub-phase
  text is a single quiet line under the object ("Sealing your things…").
- **Sealed:** the SEALED vault stamps in, monogram pressed. Caption: *"Sealed.
  Only your key opens it."* Affordances: Show in folder · Seal another · Done.

### OPEN — "the box being unlocked"
- **Select:** a SEALED vault (closed, intact wax). Caption: *"Bring a sealed
  vault."* Affordances: Choose · recents (small sealed-vault thumbnails, the only
  place more than one appears, clearly miniatures of the same object).
- **Unlock:** the SEALED vault, **keyhole front-and-center**; the password field
  is the key entering the keyhole. One action: *Turn the key*.
- **Unlocking:** keyhole **glows and turns**, wax lifts at one edge — the vault is
  opening. (Replaces the spinner-as-subject.)
- **Opened:** the vault is OPEN; its **contents become the file list** — the list
  reads as "the things inside this vault," framed by the open lid. Action: take
  everything out (Extract all) / take selected.

### VERIFY — "the box being inspected"
- **Choose:** a SEALED vault under a resting magnifier. Caption: *"Is this seal
  still whole?"* Action: Choose.
- **Inspecting:** the **magnifier glides over the wax seal** (slow, deliberate).
- **Result — intact:** the seal is whole with a soft glow. Caption: *"The seal is
  whole. Nothing has been touched."*
- **Result — broken:** the wax is **cracked**, a chip missing, a short shake.
  Caption: *"The seal is broken. Don't trust what's inside."*

---

## 5. UI language — before → after

The point of 03A is also verbal: stop naming machine states; narrate the object.

| Where | Before (02C — state-machine / form) | After (03A — object / physical) |
|-------|-------------------------------------|---------------------------------|
| Create empty | "Drop files to seal" | "An empty vault — drop your things in" |
| Files state heading | "3 files ready" | "3 things waiting in the vault" |
| Files → next | "Continue →" | "Close the lid →" |
| Config heading | "Seal archive" / "Name & key" | "Lock the vault" |
| Name field | "Archive name" | "Name this vault" |
| Password field | "Password" | "Your key" |
| Seal action | "Seal archive" | "Seal it" |
| Sealing screen | 4-row ladder: *Collecting files · Encrypting content · Sealing archive · Finalizing* | one line under the transforming vault: "Sealing your things…" (phases implied by the wax forming) |
| Success | "Archive sealed" | "Sealed — only your key opens it" |
| Open entry | "Open an archive" | "Bring a sealed vault" |
| Unlock button | "Open box" | "Turn the key" |
| Unlocking | "Unlocking…" (spinner) | keyhole turns; "Opening the vault…" |
| Contents header | "Archive details" | "Inside this vault" |
| Verify entry | "Check an archive seal" | "Is this seal still whole?" |
| Verify checking | "Checking the seal…" | magnifier glides; "Inspecting the seal…" |
| Verify intact | "Seal intact" | "The seal is whole" |
| Verify broken | "Seal broken" | "The seal is broken — don't trust it" |
| Nav (kept) | Create / Open / Verify | unchanged (mode switch stays minimal) |

Terms to **delete from the UI** entirely: "state", "configuration", "step",
"stage", "progress", "form", "panel", "dashboard". Keep technical names only in
the About footnote, never in the flow.

---

## 6. What to remove (generic / developer UI)

- The visually dominant **step ladder** in the sealing screen (the object's
  transformation replaces it; an optional single caption line may remain).
- File cards rendered as a **grid beside** the object → contents belong *in/under*
  the open vault.
- Any heading that announces a state ("Configuration", "Files selected").
- Any second instance of the object except the Open-mode recents row, which must
  read unmistakably as **miniatures of the same vault**, not generic file rows.

What stays (02C architecture, unchanged): the three modes, the internal
`files → config → sealing → success` / `select → unlock → opened` /
`choose → inspect → result` state machines, the routing, and the crypto core.

---

## 7. Success criterion

Show any screen → the user says **"this is the same thing transforming."**
If instead they think "different screens with similar styling," it failed.

Checklist for 03B implementation review:
- [ ] One Vault is the visual subject of every primary state.
- [ ] The Vault is literally the same component, animated by a `state` prop.
- [ ] No step ladder / dashboard / state-name headings in the flow.
- [ ] File list reads as the open vault's contents, not a detached grid.
- [ ] Recents read as miniatures of the vault.
- [ ] UI copy is physical (object) language, per §5.
- [ ] Motion is calm; reduced-motion respected.

---

## 8. Constraints honored

No features added, no crypto changed, no flow/mode-system changed, no dashboard
elements, no forms-first design. This milestone outputs **design + system only**;
the single `Vault` component and copy changes are implemented in **03B**.

## 9. Deliverables map

1. **`docs/ANDRII_03A_IDENTITY_LAYER.md`** — this file.
2. **Updated visual system rules** — §2.
3. **Object lifecycle diagram** — §3.
4. **Updated screen descriptions (Create/Open/Verify)** — §4.
5. **Before/after of UI language** — §5.
