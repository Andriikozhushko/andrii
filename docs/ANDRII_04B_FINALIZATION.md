# ANDRII 04B — Product Finalization Layer

> Product design only. **No code in 04B.** Implementation is a later pass (04C).
> No new features / crypto / architecture / Vault logic / new UI systems.

ANDRII is correct in every layer but still *reads as a system*. 04B makes it feel
**inevitable, calm, minimal, finished** by removing process exposure and
collapsing each flow to its outcome. The user should feel **outcome, not
process**.

**Relationship to 04A:** 04A said "name the real local action" (e.g. "Encrypting
your files locally"). 04B goes further toward outcome + physical metaphor and
**supersedes 04A's wording where they conflict**: prefer *"Sealing your vault…"*
over *"Encrypting files…"*, and collapse to *"Vault created."* 04A's *behavioral*
guarantees (determinism, one-cause errors, "restored not reloaded", truthfulness)
all still hold.

---

## 1. Principles

1. **Outcome over process** — flows collapse to before → after; no visible machinery.
2. **Visual silence** — one focal point (the Vault), fewer elements, more space.
3. **Stillness = trust** — nothing moves unless something changed.
4. **Empty by default** — launch shows the Vault and one way in. Nothing else.
5. **One-sentence errors** — one cause, one action.
6. **No engineering language** — physical metaphor only (vault, seal, key).

---

## 2. UI simplification plan

Target: every screen = the Vault as the single focus + at most one primary
action + minimal caption. Remove anything that is "process visibility."

| Screen | Remove | Keep (only) |
|--------|--------|-------------|
| **Launch / idle** | recents, secondary links, value text, extra buttons | the Vault (idle) + one entry: *"Drop files, or open a vault"* (drag = create, one button = open) |
| **Create · files** | file-card/chip clutter as a focus, headings, "intent" line | the Vault (filling) + a quiet count + one action (continue) |
| **Create · configure** | section labels, hints stacked, strong form framing | the Vault + name + key (two quiet fields) + one action (seal) |
| **Create · sealing** | step ladder, percentages, per-file filenames, progress bar | the Vault transforming + (optionally) one short caption; ideally silent |
| **Create · done** | stat grid, footnote of algorithms, multiple actions | the Vault (sealed) + **"Vault created"** + one primary (Done); secondary tucked |
| **Open · select** | dense recents grid as the focus | the Vault (sealed) + one action (choose); remembered vaults appear *below*, quiet |
| **Open · key** | extra chrome | the Vault + key field + one action |
| **Open · opening** | spinner, technical text | the Vault (unlocking), settling once |
| **Open · contents** | toolbar density, columns clutter | the open Vault + its contents list, calm; one primary (extract) |
| **Verify** | "checking" verbosity, check-rows | the Vault → **"Vault intact"** / **"Vault compromised"** |
| **Settings** | visual noise | plain list; reachable but never on the default path |

Default-state rule (Rule 6): on launch the user sees **only** the idle Vault and
one way in — no recents, no settings prompts, no secondary UI.

---

## 3. Before / after UX comparison

| Flow | Before (process-visible) | After (outcome-first) |
|------|--------------------------|-----------------------|
| Launch | Create hero + Add files/folder + Open/Verify links + recents | idle Vault + "Drop files, or open a vault" |
| Create | files grid → config form → 4-step sealing ladder → stat report | drop → name + key → (vault seals) → **"Vault created"** |
| Sealing feedback | Collecting / Encrypting / Sealing / Finalizing + % + filename | the vault closes; (silent or one word) |
| Open | choose → password (+spinner "Unlocking…") → details panel + table | choose → key → **"Vault opened"** → contents |
| Verify | "Checking the seal…" → seal + checklist-ish copy | **"Vault intact"** / **"Vault compromised"** |
| Errors | cause + context + sometimes detail | one sentence + one action |
| Restart | (already restores) | vaults simply present; "Your vaults are here" |

The machinery (encryption stages, transitions, stores) still runs — it is just
no longer *shown*.

---

## 4. Copy rewrite rules — final voice system

**Voice:** calm, plain, certain, second person, present tense, lower drama. One
short line wherever possible. Never exclamation, never jargon, never absolutes.

**Banned in UI** (Rule 3): `state, processing, encrypting, decrypting, stage,
step, flow, session, store, update, loading, render, cache, hydrate, reducer,
data, operation`. Replace with vault/seal/key metaphors and outcomes.

**Canonical outcome strings (final; localized via existing i18n):**

| Moment | Final copy |
|--------|-----------|
| Idle entry | "Drop files, or open a vault." |
| Locality reassurance (idle, once) | "Everything stays on your device." |
| Sealing (if shown) | "Sealing your vault…" |
| Create success | "Vault created." · sub: "Only your key opens it." |
| Opening (if shown) | "Opening your vault…" |
| Open success | "Vault opened." |
| Inspecting (if shown) | "Checking the seal…" |
| Verify intact | "Vault intact." · sub: "Nothing has changed." |
| Verify compromised | "Vault compromised." · sub: "Don't trust its contents." |
| Restart / list | "Your vaults are here." |

**Error copy (one sentence + one action, Rule 7):**

| Cause | Sentence | Action |
|-------|----------|--------|
| Wrong password | "That password doesn't open this vault." | try again |
| Not a vault | "This isn't an ANDRII vault." | choose another |
| Newer format | "This vault needs a newer ANDRII." | update |
| Tampered | "This vault was changed after it was sealed." | (no extract) |
| Damaged | "This vault is damaged." | choose another |
| Missing file | "This vault is no longer here." | locate / remove |
| Can't write | "Couldn't save the vault there." | choose a folder |

Technical detail (paths, codes, algorithm names) only behind an optional
"Details" expander — never in the first sentence. Algorithm names live solely in
About.

---

## 5. Reduced interaction model

Collapse the number of things a user must do and see.

- **One focal object** at all times: the Vault. Everything else is a caption or a
  single control.
- **One primary action per screen.** Secondary actions are quiet text or hidden
  until relevant (e.g. "Extract selected" only with a selection).
- **Two-decision Create:** what's inside (drop) → the key (name + password) →
  outcome. No third surface that feels like configuration.
- **Drag is the primary create gesture;** a single "Open a vault" control is the
  primary open gesture. The mode switcher remains for deliberate switching but is
  not required on the happy path.
- **Outcome screens are terminal and calm:** a created/opened/verified vault
  state + one short line + one way forward.

---

## 6. Visual silence & stillness (Rules 4, 5)

- **Motion budget:** animate only on a real state change (seal stamps once, lid
  opens once, broken seal shakes once). **Remove looping/idle motion** — no
  perpetual pulses, no constant spinners, no ambient animation. At rest the Vault
  is perfectly still.
- **Density budget:** at most ~3 text elements per screen (focal object excluded);
  generous whitespace; a single accent moment.
- **Signal budget:** never more than one status signal at a time.

Stillness is the trust cue: a calm, unmoving vault reads as solid and finished.

---

## 7. Honest implementation backlog

04B is design only. The behavior/visual specs from **03C, 03D, 04A, 04B** are now
queued for a consolidated implementation pass (suggested **04C**):

- 03C — VaultObject store + `deriveVaultVisual` + single persistent `<CurrentVault/>`
- 03D — VaultStore persistence (DPAPI-encrypted registry, write-through, timeline)
- 04A — error/status copy standardization + persistence confidence copy
- 04B — outcome-first simplification, default-empty launch, stillness, final voice

Recommend implementing 03C→03D→04A→04B together so the product is simplified on
top of the persistent object model, not before it.

---

## 8. Constraints honored

No features, no crypto, no architecture/Vault-logic changes, no new UI systems.
04B only specifies *removal, unification, and collapse*. Design only; code later.

## 9. Success criterion

The user thinks **"this feels like a finished product I can just use,"** not "this
is an impressive system." Reached when each flow shows an outcome rather than its
machinery, the launch screen is near-empty, the vault is the only focus, motion is
rare and meaningful, and errors are a single calm sentence.

## 10. Deliverables map

1. **`docs/ANDRII_04B_FINALIZATION.md`** — this file.
2. **UI simplification plan** — §2.
3. **Before/after UX comparison** — §3.
4. **Copy rewrite rules (final voice system)** — §4.
5. **Reduced interaction model** — §5 (+ §6 stillness).
