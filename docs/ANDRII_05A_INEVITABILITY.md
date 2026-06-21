# ANDRII 05A — Product Inevitability Layer

> UX finalization, **design only — no code** (implementation would be 05B).
> No new features / architecture / crypto / persistence / Vault-system changes.

ANDRII is architecturally complete and trustworthy. The last gap is cognitive:
the product still asks to be *understood*. 05A removes that — the user should
**just know what to do**, never reason about a system.

**The shift:** from *"I understand how this works"* → *"I just know what to do."*
From *explainable* → *inevitable*.

---

## 1. Principles

1. **One obvious action, always** — never "what do I click next?"
2. **The artifact decides intent** — modes are inferred, not chosen.
3. **The vault is the experience** — not Create/Open/Verify.
4. **The system is invisible** — store/state/persistence exist only in code.
5. **Continuity is felt, never announced** — vaults are simply present.
6. **Trust through simplicity** — less surface, consistent reactions.

---

## 2. The single-action model (Rules 1, 2)

There is one surface and one vault. The user does not pick a mode — **what they
bring determines what happens**:

```
                       ┌──────────────────────────────┐
                       │            the vault           │
                       └──────────────────────────────┘
   drop files ───────────────▶ it fills, then seals        (was: "Create")
   bring a .andrii ──────────▶ it opens (seal checked as it arrives)  (was: "Open" + "Verify")
```

- **Dropping files** → the vault gathers them → set the key → it seals. The word
  "Create" never needs to appear; the action is self-evident.
- **Bringing a vault** (drop or choose a `.andrii`) → the vault **opens**, and its
  **seal is inspected as part of arriving** — so "Verify" is no longer a place you
  go; integrity is something the vault *tells you* (whole seal vs broken seal)
  the moment it appears. A standalone "check the seal" is a single contextual tap
  on a sealed vault, not a mode.
- **The mode switcher is demoted** from the happy path to an optional, quiet
  affordance for deliberate switching. Perceptually, modes disappear.

> Foundation already exists: drag-drop already routes a single `.andrii` to open
> and other files to create (App `handlePaths`). 05A makes that inference the
> *primary, choice-free* path and removes the conscious mode decision.

---

## 3. UX decision collapse map (Deliverable 2)

Every decision the user currently makes, and how it collapses to zero/one.

| Decision (before) | Cognitive cost | After (collapsed) |
|-------------------|----------------|-------------------|
| "Which mode — Create / Open / Verify?" | choose among 3 | **inferred from the artifact** (files → fill; vault → open). No conscious choice. |
| "Do I need to Verify before/after opening?" | extra step + judgement | **automatic** — the seal is shown whenever a vault appears. |
| "Continue vs configure vs seal?" (create) | 3 labels | one obvious next each: drop → key → (it seals). |
| "Which recent / browse?" | scan + choose | one obvious action; remembered vaults are just *there*. |
| "Is my data still here after restart?" | doubt | never asked — vaults are present on launch (Rule 5). |
| "Where are settings / generator?" | hunt | off the main path entirely; never needed to act. |
| "What does this status mean?" | parse system text | outcomes only (04B), nothing to interpret. |

Result: the **only** decision left is the natural one — *what do I want to put in,
or take out.* Everything else is inferred or automatic.

---

## 4. Single-action flow specification (Deliverable 4)

At every moment there is exactly one obvious action; the UI guarantees no
ambiguity (zero-decision design, Rule 4).

| Moment | The one obvious action | Everything else |
|--------|------------------------|-----------------|
| Launch (empty) | drop files (or pick a vault) | nothing else on screen |
| Files in the vault | "set the key" (one control) | edit is a quiet affordance |
| Key set | "seal it" (one button) | — |
| Sealing | (none — wait; it's happening) | no controls |
| Sealed | "done" | show-in-folder is secondary |
| A vault brought in | "enter the key" | seal status already visible |
| Opened | "take things out" | per-item select is secondary |
| Seal broken | (read it) "don't trust this" | one quiet "remove" |

Rule: if a screen would present two equally-weighted actions, it is wrong — one
must become primary, the other quiet or deferred until relevant.

---

## 5. Interaction minimization plan (Deliverable 3)

Drive the number of deliberate interactions to the floor.

- **Create** = 2 deliberate inputs: *drop* → *key* (name+password) → it seals.
  No mode click, no "continue" as a thinking step (it's just forward motion).
- **Open** = 2: *bring* → *key* → opened. Seal check is free (0 extra).
- **Verify (standalone)** = 1: it's a single contextual tap, rarely needed since
  opening already shows the seal.
- **Removed interactions:** choosing a mode, deciding to verify, interpreting
  status text, navigating to find the next step.
- **Inventory after minimization:** drop · key · seal · bring · key · take out.
  That is the entire vocabulary of the product.

---

## 6. Continuity illusion (Rule 5)

- On launch the vaults are simply **present** — by name, with their seal — as if
  they were never gone. No "restoring", no "loading", no reconstruction language.
- The vault is the constant the user holds onto across everything; screens change
  around it, it does not "reappear."
- The truthful basis (04C) is real persistence; 05A only ensures the *experience*
  never exposes the machinery behind it.

---

## 7. System invisibility & trust through simplicity (Rules 3, 6)

- The UX never names: store, state, persistence, mapping, lifecycle, object,
  session, registry, hydrate, mode. These live only in `docs/` and source.
- Fewer elements, more silence (04B), one accent moment, consistent reactions.
- Trust is the by-product of there being *nothing to figure out*.

---

## 8. Before / after cognitive load comparison (Deliverable 5)

| Measure | Before | After (05A) |
|---------|--------|-------------|
| Modes the user must choose between | 3 (Create/Open/Verify) | 0 (inferred) |
| Conscious decisions to protect files | mode → add → configure → seal (~4) | drop → key (2) |
| Conscious decisions to open + trust | mode → choose → unlock, + decide to verify (~4) | bring → key (2); seal shown free |
| System concepts surfaced in UX | several (states/steps/recents/settings) | one (the vault) |
| "What do I click next?" moments | multiple | none (one obvious action each) |
| Mental model required | "I understand the system" | "I just act on the vault" |

---

## 9. Where "Verify" goes

Verify stops being a destination. Integrity becomes a **property of the vault you
can always see**: any vault that appears shows its seal — whole or broken — so the
user *learns trust by looking*, not by running a tool. The explicit check remains
as a one-tap reassurance, never a required step. (Architecture unchanged; this is
perception.)

---

## 10. Implementation notes (deferred to 05B — no code now)

- Make drop/choose the primary entry; demote the segmented switcher to a quiet,
  optional control (kept for deliberate switching, off the happy path).
- On bringing a vault, surface its seal state immediately (integrity from 04C
  memory, or a quick check) so opening and "is it intact" are one arrival.
- Ensure every state renders exactly one primary action (audit against §4).
- Keep all copy outcome-only (04B) and continuity silent (§6).

None of this adds features or changes architecture/crypto/persistence/Vault — it
removes choices and visibility.

---

## 11. Constraints honored

No features, no architecture/crypto/persistence/Vault changes. 05A is design
only; it specifies how to collapse decisions and hide the system.

## 12. Success criterion

The user says **"I just know what to do here,"** not "I understand this system."
Reached when modes are imperceptible, intent is inferred from the artifact, every
moment has one obvious action, and the vault simply persists without explanation.

## 13. Deliverables map

1. **`docs/ANDRII_05A_INEVITABILITY.md`** — this file.
2. **UX decision collapse map** — §3.
3. **Interaction minimization plan** — §5.
4. **Single-action flow specification** — §4.
5. **Before/after cognitive load comparison** — §8.
