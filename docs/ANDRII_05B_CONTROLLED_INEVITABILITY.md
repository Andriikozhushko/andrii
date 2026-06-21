# ANDRII 05B — Controlled Inevitability Layer

> UX balance layer, **design only — no code** (implementation would follow).
> Do not reintroduce mode selection, add complexity, reduce inference, add
> features, or change architecture. Only add *control visibility* and
> *predictability* on top of 05A's inference.

05A removed decisions (intent is inferred: drop files → create; bring a `.andrii`
→ open). The risk is **"magic UX"** — actions happen without the user feeling in
control or able to predict them. 05B keeps zero forced decisions but adds
**control through visibility**: every inferred action is announced before, and
confirmed after, against one stable anchor — the Vault.

**The balance:** *"I don't need to choose, but I always understand what
happened."*

---

## 1. Principles

1. **Inferred, but confirmed** — every inference shows what it's doing and what it
   did.
2. **No hidden behavior** — nothing automatic goes unacknowledged.
3. **One control anchor** — the Vault surface always shows state · identity · next.
4. **Inference is transparent** — a subtle, human line states the detected intent.
5. **Predictable, not magical** — learnable in 1–2 uses; no surprise automation.
6. **Deterministic & symmetric** — same input → same behavior; same error → same
   words; no hidden branching.

---

## 2. Control anchor — the Vault surface (Deliverable 3)

There is one persistent anchor the user can always read. It is the Vault plus a
single status line. It never lets a transition happen "off-screen."

**The anchor always shows three things, and nothing more:**

| Slot | Always answers | Example |
|------|----------------|---------|
| **State** | "what is the vault right now?" | the Vault visual + one word: *new · filling · sealed · open · broken* |
| **Identity** | "which vault is this?" | a name: *"documents"* (or *"New vault"* before naming) |
| **Context** | "what happens next / just happened?" | one line: *"Set the key"* / *"Vault created · 3 files"* |

Rules:
- The anchor is **continuous** (05A): screens change around it; it does not
  blink in and out. Every change to it is a visible transition the user can see.
- There are **no hidden transitions**: the vault never silently becomes something
  else. State changes are always accompanied by the anchor's state word + context
  line updating.
- The anchor is the answer to "where am I / what is this" at all times — which is
  the control 05A removed from the (now-gone) mode switcher, returned as
  *information* rather than as a *choice*.

---

## 3. Inference → confirmation mapping (Deliverable 2)

Every inferred action has: a **transparency line** the instant intent is detected,
and a **confirmation** of the outcome, and an **escape** (it isn't committed until
an explicit step).

| Input (what the user did) | Detected intent (transparency line, shown at once) | Outcome confirmation (what just happened) | Reversible until |
|---------------------------|----------------------------------------------------|-------------------------------------------|------------------|
| Drop / add ordinary files | "3 files — building a new vault." | (after seal) "Vault created · 3 files." | sealing (Clear / cancel anytime before) |
| Drop / choose a single `.andrii` | "A sealed vault — opening it." | (after key) "Vault opened." + seal shown | always (opening only reads) |
| `.andrii` whose seal is broken | "A sealed vault — its seal looks broken." | "This vault was changed after sealing." | n/a (read-only) |
| Mixed selection (files **and** a vault) | "Several files — building a new vault." (deterministic: any non-single-vault drop = create) | "Vault created · N files." | sealing |
| Empty/idle | (no inference) "Drop files, or bring a vault." | — | — |

The transparency line is the *contract*: it tells the user what will happen
**before** it commits, so the inference never feels like a surprise.

---

## 4. Inference transparency (Rule 4)

The detected-intent line must be:

- **Subtle** — one quiet line near the anchor, not a dialog, not a toast pile.
- **Human, not technical** — "A sealed vault — opening it.", never "Detected
  MIME/magic ANDRII v1 → route=open."
- **Brief** — one short sentence; auto-settles as the action proceeds.
- **Intent-level** — names *what* and *why-it-thinks-so* in plain words, not the
  mechanism.

It appears the instant intent is inferred and is replaced by the outcome
confirmation when the action resolves — so there is always exactly one current
statement of "what's happening," never silence and never a stack of messages.

---

## 5. UX predictability rules (Deliverable 4)

1. **Determinism (Rule 6 / 04C):** the same input always yields the same inferred
   action, the same vault behavior, and (on failure) the same message. The
   inference function is pure: artifact → intent, no context-dependent surprises.
2. **One simple rule, always shown:** *a single sealed vault opens; anything else
   becomes a new vault.* Because the transparency line states it every time, the
   user internalizes it in 1–2 uses.
3. **No surprise automation:** nothing irreversible happens from an inference
   alone. Creating requires the explicit *seal*; extracting requires the explicit
   *take out*. Inference only *prepares* the obvious next step.
4. **Reversibility:** any inferred path can be abandoned before its committed step
   (Clear before sealing; just close before extracting). Opening/inspecting are
   inherently reversible (read-only).
5. **Consistency of reaction:** the same gesture produces the same anchor change
   in the same place with the same wording, every time and in every language.

---

## 6. Reversibility & escape (Rule 1)

The "reversible mental model" is guaranteed by a single invariant:

> **Inference never commits.** It only sets up the one obvious next action. The
> user always performs the committing step explicitly (seal / take out), and can
> always back out before it.

So "drop files → vault created" is really "drop files → *a vault is being
prepared* → you seal it." The confirmation *"Vault created · 3 files"* appears
only after the user's explicit seal — honoring Rule 1's example while keeping the
mental model reversible.

---

## 7. Error + action symmetry (Rule 6)

- Inference adds **no hidden branches**: a `.andrii` always routes to open; other
  inputs always route to create — there is no secret third path.
- **Ambiguity is resolved deterministically and shown:** a mixed drop is always
  "build a new vault," stated in the transparency line — never a guess that
  varies.
- **Errors stay symmetric (04C):** same failure → same one-sentence cause,
  regardless of how the action was entered (dropped vs chosen). Entry method
  never changes the outcome or the message.

---

## 8. Before / after UX clarity comparison (Deliverable 5)

| Measure | 05A (pure inference) | 05B (controlled inevitability) |
|---------|----------------------|--------------------------------|
| Forced decisions | 0 | 0 (unchanged) |
| "What did the system just do?" | sometimes unclear | always stated (transparency + confirmation) |
| Predictability of an inferred action | learn by trial | stated every time → learned in 1–2 uses |
| Sense of control | "magic" risk | anchored: state · identity · next always visible |
| Reversibility understood | implicit | explicit invariant (inference never commits) |
| Hidden transitions | possible | none (anchor shows every change) |
| Mental model | "I'm not sure what it decided" | "I didn't choose, but I see what happened" |

---

## 9. Implementation notes (deferred — no code now)

- Keep the single Vault (04C) as the anchor; add a persistent two-part status
  (state word + context line) bound to the current vault.
- Add the transparency line at the drag-drop / choose moment, driven by the
  existing deterministic intent rule in `handlePaths`; replace it with the
  outcome confirmation on resolve.
- All strings via i18n (7 languages), outcome-only voice (04B).
- No new routes, no switcher revival, no new inference branches.

---

## 10. Constraints honored

No mode selection reintroduced, no added complexity, inference not reduced, no
features, no architecture/crypto/persistence/Vault changes. 05B only adds control
*visibility* and predictability. Design only.

## 11. Success criterion

The user feels **"I don't need to choose, but I always understand what
happened,"** not "I don't know what the system decided." Reached when every
inferred action is announced and confirmed against the one stable Vault anchor,
the inference rule is visible and deterministic, and nothing commits without an
explicit, reversible step.

## 12. Deliverables map

1. **`docs/ANDRII_05B_CONTROLLED_INEVITABILITY.md`** — this file.
2. **Inference → confirmation mapping table** — §3.
3. **Control anchor specification (Vault surface)** — §2.
4. **UX predictability rules** — §5 (+ §6 reversibility, §7 symmetry).
5. **Before/after UX clarity comparison** — §8.
