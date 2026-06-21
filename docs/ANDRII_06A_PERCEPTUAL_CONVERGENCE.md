# ANDRII 06A — Perceptual Convergence Layer

> Perception layer, **design only — no code**. Do not reintroduce modes, flows,
> inference visibility, or system explanations; no features; no architecture
> change. Only collapse perception so the user experiences **one continuous
> object**, not a system.

Everything ANDRII does is now correct *and* low-friction, but the product is
still **perceivable as a system**: the user can still sense modes, inference,
transitions, lifecycle. 06A removes that awareness. The architecture stays; it
simply drops below perception.

**The shift:** from *"the system is doing things with a vault"* → *"I am
interacting with a vault."*

---

## 1. Principles

1. **No conceptual layers perceived** — Create/Open/Verify, inference, state,
   lifecycle exist only in code.
2. **One experience** — "I interact with a vault." No branching, no
   classification.
3. **Zero system language** — even 05B's transparency wording disappears.
4. **Continuous object** — the vault never "changes states"; it **reveals
   different truths**.
5. **No memory burden** — the user only needs to know *what the vault is now*.
6. **Object truth only** — sealed · open · intact · compromised.

---

## 2. The perceptual surface (what the user may perceive)

The user's entire perceivable world is reduced to **three things**, all belonging
to the object:

| Perceivable | Is | Is NOT |
|-------------|----|--------|
| **The vault** | a single continuous physical object | a screen / panel / view |
| **Its identity** | a name (the user's own word) | an id / path / "session" |
| **Its truth** | empty · holding · sealed · open · intact · compromised | a "state" / "step" / "mode" |

Plus the one **natural physical interaction** the object affords right now
(put things in · turn the key · take things out). Nothing else is perceivable —
no modes, no inference lines, no transitions, no status of "the system."

---

## 3. System invisibility model (Deliverable 2)

Everything ANDRII *is* collapses beneath one perceived object:

```
   PERCEIVED (visible)        ┌───────────────────────────────┐
                              │   one vault · its name · its    │
                              │   truth · one physical action   │
                              └───────────────▲───────────────┘
   ────────────────────────────────────────── │ ─────────────── perception line
   INTERNAL (invisible)                        │
      flows (02C) · modes (02B) ───────────────┤
      inference / handlePaths (05A/05B) ───────┤
      VaultObject + deriveVaultVisual (03C) ───┤   all of this exists,
      VaultStore persistence (03D/04C) ────────┤   none of it is perceived
      trust + error mapping (04A/04C) ─────────┤
      crypto core (Rust) ──────────────────────┘
```

The perception line is the contract: **nothing below it may surface as words,
cues, or transitions above it.** The internal machinery is how the vault is true,
never what the user perceives.

---

## 4. UX layer collapse diagram (Deliverable 3)

The historical conceptual layers converge to a single object:

```
 BEFORE (perceived as layers)            AFTER (perceived as one object)

  mode choice                                   ┌──────────┐
     ↓                                          │          │
  inference ("detected…")                       │  VAULT   │
     ↓                                          │  name +  │
  flow / step / state                  ─────▶   │  truth   │
     ↓                                          │          │
  object lifecycle                              └──────────┘
     ↓                                        "I interact with it.
  outcome                                      It reveals what's true."
```

Five perceived layers → zero. One object remains.

---

## 5. Object truth states (Rule 6)

The object speaks only in truths. Each is a *condition of the vault*, never an
action of a system:

| Truth | The vault is… | Replaces (former system language) |
|-------|---------------|-----------------------------------|
| **empty** | open and holding nothing | "Create — idle" |
| **holding** | open with your things inside | "files selected / filling" |
| **sealed** | closed, its seal pressed | "Archive created / encrypted / created from N files" |
| **open** | unsealed, its contents shown | "Opened / unlocking done" |
| **intact** | sealed, its seal whole | "Verify result: valid" |
| **compromised** | sealed, its seal broken | "Verify result: tampered" |

The vault does not "transition" between these — it **reveals** whichever is true
now. The user reads truth, not process.

---

## 6. Object-only perception rules (Deliverable 4)

1. **Only object truth is shown.** Every former status/confirmation becomes the
   vault's current truth + its name. ("Vault created · 3 files" → the vault simply
   *is* **sealed**, named, with 3 inside as a quiet property.)
2. **No system narration.** Nothing says what was detected, inferred, processed,
   transitioned, restored, or decided. (Rule 3 — supersedes 05B's visible line;
   §8.)
3. **No mode/flow cues.** No labels, tabs, steps, or "where am I" beyond the
   vault's identity + truth.
4. **Physical transformation, not narrated transition.** The vault may *visibly
   transform* (lid closing, seal pressing, lid lifting) because that is the
   object being true — but it is never accompanied by words describing a
   transition. Motion is the object, not a status.
5. **Identity is the user's word.** The vault is referred to by its name, never by
   a path, id, or "the archive."
6. **Truth is self-evident.** Sealed looks sealed; open looks open; a broken seal
   looks broken. Confirmation is the look of the object, not a message.

---

## 7. Truth, not transition (Rule 4)

The distinction that makes invisibility possible:

- **Allowed:** the object *physically* becoming sealed/open — the wax presses, the
  lid lifts. This is the vault revealing its new truth; it is the experience.
- **Banned:** any *narration* of that change — "sealing", "processing",
  "transitioning", progress ladders, percent, "detected", "restoring". These
  expose the system.

So the sealing moment is silent: the vault closes and the seal presses; when it
settles, the truth **sealed** is simply there. No words mediate it.

---

## 8. Zero system language (Rule 3) — superseding 05B's transparency line

05B made the inference *visible* ("A sealed vault — opening it.") to add control.
06A removes that visibility: the **control is preserved** because the vault's
truth is always plainly visible, but it is expressed as **object truth, not
system narration**.

Re-expression:

| 05B (system narration) | 06A (object truth) |
|------------------------|--------------------|
| "A sealed vault — opening it." | the vault is shown **sealed**, then **open** when its key is turned |
| "3 files — building a new vault." | the vault is **open and holding** your things |
| "Vault created · 3 files." | the vault is now **sealed** (named, 3 inside) |
| "Verifying… → intact." | the vault simply shows **intact** |

**Banned in UX entirely:** detected, inferred, processing, transitioning,
restoring, created (as an event), state, step, stage, flow, mode, session, store,
update, loading. Allowed vocabulary describes only the object and its truths.

---

## 9. Eliminate UX memory burden (Rule 5)

The user carries nothing between moments. There is no "which mode am I in," no
"what did it just decide," no "what happened internally." The only present
question — *what is this vault now?* — is answered by looking at it. Continuity
(04C persistence) means a returning user's vaults are simply true again, never
"reloaded."

---

## 10. Reconciliation with 05A / 05B

- **05A (modes inferred):** unchanged internally; now even the *inference* is
  imperceptible.
- **05B (controlled visibility):** its goal — "I always understand what happened"
  — is kept, but satisfied by **visible truth** instead of a visible system line.
  Where they conflict, **06A wins on wording**: no narrated inference/transition;
  the vault's look is the understanding.

The result is not less control than 05B — it is the same understanding, achieved
without exposing the system.

---

## 11. Before / after cognitive model comparison (Deliverable 5)

| Measure | Before (05B) | After (06A) |
|---------|--------------|-------------|
| What the user perceives | object + a system narrating intent | only the object + its truth |
| Conceptual layers perceived | inference + control + outcome | none (one object) |
| System words in UX | minimal but present ("detected/opening") | zero |
| Feedback form | short sentences about actions | the look of the vault (truth) |
| What must be remembered | nothing to choose, something to read | only "what is the vault now" |
| Mental model | "I didn't choose, but I see what it did" | "I am interacting with a vault" |

---

## 12. Implementation notes (deferred — no code now)

- Remove any narrated inference/transition copy; express all feedback as the
  vault's truth + name (sealed/open/intact/compromised, holding/empty).
- Sealing/opening are silent physical transformations of the one Vault — no
  ladders, no percent, no status words.
- Keep i18n, but the string set shrinks to truths + identity + the single
  physical affordance label.
- No new routes, no switcher, no inference lines, no system text.

---

## 13. Constraints honored

No modes/flows/inference-visibility/system-explanations reintroduced, no features,
no architecture/crypto/persistence/Vault changes. 06A is perception design only.

## 14. Success criterion

The user thinks **"I am interacting with a vault,"** not "the system is doing
things with a vault." Reached when the only perceivable things are one vault, its
name, and its truth; the machinery never surfaces; and every confirmation is the
look of the object rather than a message about the system.

## 15. Deliverables map

1. **`docs/ANDRII_06A_PERCEPTUAL_CONVERGENCE.md`** — this file.
2. **System invisibility model** — §3 (+ §2 perceptual surface).
3. **UX layer collapse diagram** — §4.
4. **Object-only perception rules** — §6 (+ §5 truth states, §7 truth-not-transition).
5. **Before/after cognitive model comparison** — §11.
