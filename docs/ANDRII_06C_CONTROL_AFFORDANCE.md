# ANDRII 06C — Control Affordance Layer

> Control layer, **design only — no narration, no code**. Preserve 06B silence.
> Do not reintroduce system language, modes, flows, features, or change the Vault
> model. Only restore *what can I do next* — visually, not verbally.

06B achieved perceptual silence. The risk: a silent app can leave the user unsure
**what they may do**. 06C restores control **without breaking silence** — through
affordance (the presence, position, and availability of one action), never through
explanation.

**The balance:** *"I always know exactly what I can do next without being told,"*
while still *"I see no system talking."*

---

## 1. Principles

1. **Action clarity without narration** — the next action is obvious, unspoken.
2. **One affordance per state** — exactly one dominant action, never competing.
3. **Visual affordance only** — position, object state, presence/absence — not
   sentences.
4. **Silence preserved** — no process text, no transition narration (06B holds).
5. **Object leads, control follows** — controls are extensions of the vault, not
   UI laid over a system.
6. **No multi-choice states** — the user never asks "what can I do here?".

---

## 2. The affordance model

Control is derived from truth, exactly as the visual is (03C). A pure
`deriveAffordance(truth)` yields **one** action, mirroring `deriveVaultVisual`:

- **Affordance forms (visual, not verbal):**
  - *object interaction* — drop onto the vault; turn the key; lift the lid.
  - *one anchored primary control* — a single button in a fixed position.
  - *presence / absence* — an action exists only when it is safe and relevant; an
    unavailable action is **not shown** (not merely disabled).
  - *spatial position* — the one action always lives in the same place, so the
    hand learns it without reading.
- **Allowed label = a single verb** naming the *physical* action (Seal · Open ·
  Take out). This is an affordance label, not narration.
- **Banned = any explanatory sentence** about system behavior (06B). A button may
  say "Open"; it may never say "Opening vault… / decrypting…".

---

## 3. State → single-action mapping (Deliverable 2)

| Vault truth | The ONE dominant action | Affordance form | Secondary (quiet / hidden) |
|-------------|-------------------------|-----------------|----------------------------|
| **empty** | drop files | the vault surface is the drop target | "open a vault" as a quiet alternate entry |
| **holding** | **seal** the vault | one primary button (fixed slot) | add more · clear (quiet) |
| **sealed** | **open** the vault | the key / one primary button | inspect the seal (quiet) · remove (quiet) |
| **intact** | **open** the vault | same as sealed (whole seal reassures) | inspect (quiet) |
| **open** | **take out** (all) | one primary button | take selected (appears only with a selection) |
| **compromised** | *inspect only* — **no open, no extract** | the open/extract control is **absent** | remove from list (quiet) |

Exactly one dominant action per row. The compromised row's control is its
**absence** (§5).

---

## 4. Affordance placement rules (Deliverable 3)

1. **The vault is the drop target.** In `empty`/`holding`, dropping onto the
   vault is the primary affordance — no separate dropzone chrome.
2. **One primary slot, fixed.** The single dominant control lives in a consistent
   position (the bottom-right primary slot) every time, so its location is
   learned, not read.
3. **On-object affordances for the seal.** Opening/sealing read as acting on the
   object (the key/lid), reinforcing "object leads, control follows."
4. **Secondary actions are visually subordinate** — quiet text or ghost controls,
   never a second filled button competing with the primary.
5. **Reveal-on-relevance.** Context actions appear only when they apply ("take
   selected" only with a selection); otherwise they don't exist on screen.
6. **Unsafe actions are absent, not disabled.** A disabled button still says "you
   could do this"; for `compromised` the open/extract control is removed entirely.

---

## 5. Affordance by absence (the compromised vault)

The strongest control signal is **what is not offered**. A compromised vault
shows a broken seal and presents **no open and no extract** — the absence is the
instruction: *this is not safe.* The only quiet affordance is to remove it from
the list. No warning sentence is needed; the missing action plus the broken seal
say it. (This is the one place where control is communicated by removing, not
adding, an affordance — and it preserves silence completely.)

---

## 6. Interaction constraint specification (Deliverable 5)

- **One primary per state.** Rendering two equally-weighted actions is a defect.
- **Affordance derives from truth.** `deriveAffordance(truth) → single action`;
  screens never invent affordances outside this map.
- **Availability = safety + relevance.** An action is rendered only when it is
  both safe and meaningful for the current truth; else it is absent.
- **Labels are single verbs**, localized (i18n); no sentences, no process words.
- **No mode/flow controls.** No tabs/steps/switchers as the means of action; the
  action is the affordance on/under the vault.
- **Destructive/unsafe paths blocked by absence**, never offered-then-warned.

---

## 7. Silence preserved (Rule 4)

Affordance ≠ narration. The product still says nothing about the system: the only
characters on screen are the vault, its name, and at most one verb on one button.
Operations remain silent (06B). The user reads availability from *presence and
position*, not from text.

---

## 8. Before / after control clarity analysis (Deliverable 4)

| Measure | After 06B (silent) | After 06C (afforded) |
|---------|--------------------|----------------------|
| "What can I do here?" | possibly unclear | one obvious action, always |
| How control is shown | (mostly buttons, ad hoc) | one primary, fixed slot, derived from truth |
| Competing actions | possible | none (one dominant per state) |
| Unsafe action (extract compromised) | could be reachable | **absent** by rule |
| Words on screen | none (operations) | none added; at most one verb per button |
| Silence | preserved | preserved |

---

## 9. Current runtime compliance + gaps (honest)

The built 06B app already largely complies: each screen has one primary button in
a fixed slot (Seal / Open / Take out), secondaries are quiet, and operations are
silent. Gaps an implementation pass would close:

- **Compromised → absence:** today a tampered vault listed in Open is still
  openable; 06C requires the open/extract affordance to be **absent** for a
  vault whose remembered integrity is `compromised` (use 04C `entryVisual` /
  integrity to gate the affordance).
- **Affordance derivation:** centralize a `deriveAffordance(truth)` so the single
  action is computed from vault truth rather than per-screen markup.
- **Holding state:** ensure exactly one primary ("seal" path) with add/clear as
  quiet secondaries (already close).

These are gating/derivation changes only — no new UI, no narration, no features.

---

## 10. Constraints honored

No system language, no broken silence, no added feature complexity, no modes/flows
reintroduced, no Vault-model change. Design only; control via affordance.

## 11. Success criterion

The user always knows the one thing to do next from the vault alone — and the
system never speaks to tell them. Reached when each truth maps to exactly one
visible affordance (or, for compromised, one telling absence).

## 12. Deliverables map

1. **`docs/ANDRII_06C_CONTROL_AFFORDANCE.md`** — this file.
2. **State → single-action mapping table** — §3.
3. **Affordance placement rules** — §4 (+ §5 absence).
4. **Before/after control clarity analysis** — §8.
5. **Interaction constraint specification** — §6.
