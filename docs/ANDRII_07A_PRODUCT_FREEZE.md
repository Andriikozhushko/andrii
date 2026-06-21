# ANDRII 07A — Product Freeze & Ship Spec (v1.0)

> **This document is the immutable v1.0 specification.** It freezes ANDRII as a
> finished product. The design-exploration series (03A–06C) is now **closed**:
> this spec is the single authority. No new UX paradigms, perception layers,
> interaction models, or abstractions may be added. Only freeze, stabilize, ship.

---

## 0. What ANDRII v1.0 is

A local, hand-drawn **secure vault** for Windows. You drop files and seal them
into a private `.andrii` vault only your password opens; you bring a vault to
open it; you check whether a vault's seal is still whole. Everything happens on
the device — no cloud, no accounts, no recovery.

It is one object (the vault) in three interactions. That is the entire product.

---

## 1. Product surface specification (Deliverable 3) — CLOSED set

The complete user-visible surface. **Nothing outside this list may appear.**

| Surface | Path | Result |
|---------|------|--------|
| **Create a vault** | drop/add files → name + password → seal | a sealed `.andrii` vault |
| **Open a vault** | bring/choose a `.andrii` → password → contents → take out | files extracted |
| **Verify a vault** | choose a `.andrii` → (silent inspect) | seal **intact** or **compromised** |
| **Settings** (utility, not a mode) | language · password generator · about | preferences |
| **Welcome** (first run only) | 3 steps → Get started | onboarding flag set |

- The vault is the single central object on every vault surface.
- Recent/remembered vaults appear **only** within Open.
- Settings is reachable but never on the path to act; it adds no vault behavior.
- No other screens, panels, dashboards, modes, or utilities exist in v1.0.

---

## 2. Final UX contract (Deliverable 2) — IMMUTABLE

These rules are frozen. They may not be reinterpreted or extended.

1. **One object.** The vault is the only product object. No icons/cards/lists as
   the subject of a screen (lists exist only as a vault's contents).
2. **One primary action per state.** Each state shows exactly one dominant
   action; secondaries are quiet or hidden until relevant. Never two equal CTAs.
3. **Object truth only.** The UI expresses the vault's truth — *empty · holding ·
   sealed · open · intact · compromised* — plus its name. Nothing else.
4. **Silence during transformation.** Sealing/opening/inspecting are silent
   physical transformations of the vault — no process text, no percent, no
   ladders, no spinners.
5. **No system vocabulary.** The UX never says: state, step, stage, flow, mode,
   session, store, update, loading, processing, encrypting, detected, inferred,
   restoring, transition. Crypto names live only in About.
6. **No inference visibility.** Intent is inferred from the artifact (files →
   create; a single `.andrii` → open) and never narrated.
7. **Deterministic errors.** A failure is the one case where words are required:
   exactly one calm sentence + one action; same cause → same words, every time,
   every language. No generic errors.
8. **Truthful claims only.** Local-only, no cloud, no recovery, one key. Never an
   absolute ("unbreakable", "military-grade").

---

## 3. Frozen models (Deliverable 5 / Rule 5)

### Object model (03C, built)
`VaultObject` truths: empty · holding · sealed · open · intact · compromised.
A pure `deriveVaultVisual(truth) → Vault visual`; the UI never picks the visual.

### Persistence model (03D/04C, built)
Local `VaultStore` registry (survives app restart). Stores **only** non-sensitive
metadata + integrity timeline (`recordCreated/Opened/Verified`). **Never**
passwords, keys, or contents. The `.andrii` file is the canonical artifact; the
registry is recognition memory. A returning user's vaults are simply present.

### Trust model (04A/04C, built)
Behavioral consistency: deterministic flows, deterministic errors, integrity
remembered. Tamper is honest and permanent in memory.

### Affordance model (06C)
One action per truth; unsafe actions are absent, not disabled. A **compromised**
vault offers no open/extract — the absence is the warning.

### Crypto & format (Rust core, built) — FROZEN at v1
XChaCha20-Poly1305 · Argon2id · BLAKE3 · Zstd · `.andrii` **format version 1**.
Frozen for v1.0; only security fixes may touch the core (§7).

---

## 4. v1.0 release definition (Deliverable 4)

**Scope (the shippable product):** the built runtime as of this freeze —
hand-drawn vault identity, 3 vault interactions + Settings + first-run welcome,
7 languages (en/uk/ru/de/fr/es/hy), native drag-drop, persistent vault registry,
deterministic errors, silent operations.

**Platform:** Windows (x64), Tauri v2 / WebView2.

**Quality gates (must pass to ship):**
- `cargo test --workspace --exclude andrii-app` — green.
- `npm run build` — green; `npm run tauri build` — produces the app.
- Real-scenario checks (04C): create → restart → same vault; wrong password →
  same one-sentence error; tampered file → broken seal, remembered; verify is
  stable.

**Release step (not a design change):** bump version `0.1.0 → 1.0.0` in
`package.json` + `src-tauri/Cargo.toml`/`tauri.conf.json`, build the installer,
tag `v1.0.0`. (Version bump is mechanical; it is the only remaining action to
ship and may be done when you choose.)

**Pre-ship hardening permitted (no new concepts):** the single 06C safety gate —
hide open/extract for a vault whose remembered integrity is `compromised`. It is
a safety enforcement of the frozen contract, not a new idea. Optional for v1.0.

---

## 5. Removal list — forbidden forever (Deliverable 5)

After this freeze, the following are **permanently out of scope** for ANDRII v1:

- New UX paradigms, perception layers, interaction models, abstraction systems.
- Any surface beyond §1 (no new modes, dashboards, panels, tools, side areas).
- System vocabulary in the UI (§2.5); process narration; spinners; step ladders;
  progress percentages; per-file narration.
- Visible inference / "detected/opening" lines; the segmented mode switcher
  becoming the *means* of action (it may remain a quiet switch only).
- Multi-choice states; two equal-weight primary actions.
- Optional/alternative behaviors, dual interpretations, "conceptual flexibility."
- Further design-iteration milestones (03x–06x are closed). New ideas → a future
  **v2** with explicit, written justification — never silent drift into v1.

---

## 6. Production readiness (Rule 6)

- **Predictable:** same input → same behavior; same failure → same words.
- **Testable:** the §4 scenarios are the acceptance suite; crypto has unit tests.
- **Stable surface:** §1 is closed; §2 is immutable.
- **No ambiguity / no dual interpretation:** one object, one action per state,
  truth-only output.

## 7. Change control after freeze

Only these changes are allowed to v1 without breaking the freeze:
1. **Bug fixes** (behavior must match this spec).
2. **Security fixes** (crypto/core; must preserve `.andrii` v1 compatibility).
3. **Translations / copy corrections** (within the frozen voice).
4. **The §4 release mechanics** (version bump, installer, signing).

Anything else is a v2 proposal, not a v1 edit.

## 8. Success criterion

A senior engineer reading this concludes: **"this is a finished product, not a
design system."** The surface is closed, the contract is immutable, the models
are frozen, and the only remaining work is the mechanical release.

## 9. Deliverables map

1. **`docs/ANDRII_07A_PRODUCT_FREEZE.md`** — this file (the v1.0 spec).
2. **Final UX contract (immutable)** — §2.
3. **Product surface specification** — §1.
4. **v1.0 release definition** — §4.
5. **Removal list (forbidden forever)** — §5.
