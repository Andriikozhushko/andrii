# ANDRII 04A — Product Reality & Trust Layer

> System design only. **No code in 04A.** Implementation lands later (04B).
> No new features / Vault logic / crypto / persistence / flow changes.

ANDRII's *technical* reality is strong (real encryption, object model,
persistence). Its *perceived* reality is still weak — it reads as a
well-architected tool, not a product you'd trust with private files. 04A closes
that gap with **behavioral trust**, not decoration.

**Core principle: trust is not UI — trust is consistency of behavior.** Every
spec below is about making the product behave the same way every time, name what
it is actually doing, fail predictably, and remember the user's vaults.

**Truthfulness guardrail (applies to everything here):** trust copy must never
claim more than the crypto delivers. We state real facts only — local-only, no
cloud, no recovery, password is the single key — and never marketing absolutes
("unbreakable", "military-grade"). A trust signal that isn't literally true is a
liability, not an asset.

---

## 1. Trust signal map (where confidence is communicated)

Confidence is asserted at specific moments, by behavior + plain language, not by
badges. Each signal must be **true, consistent, and repeatable**.

| Moment / surface | What the user must believe | How (behavior + copy) |
|------------------|----------------------------|-----------------------|
| First launch | "My vaults are still here" | known vaults restored from the registry, named, with their last-known seal — before any action (see §6) |
| Idle (Create) | "This works entirely on my machine" | quiet locality line: *"Everything happens on your device. Nothing is uploaded."* |
| Adding files | "It sees exactly what I gave it" | deterministic count/size echo; the same files always produce the same vault contents |
| Sealing | "It's encrypting, locally, right now" | *"Encrypting your files locally…"* then *"Sealing the vault…"* — names the real local action (§4) |
| Sealed (success) | "It's protected and only I can open it" | *"Sealed on your device. Only your password opens it — there's no recovery."* (literally true) |
| Vault list (Open) | "These are my real, persistent vaults" | each entry shows remembered name + when last opened/verified; identical visual signature across sessions (§3) |
| Unlocking | "It's checking my key locally" | *"Opening your vault…"* — never a bare spinner/"Loading" |
| Verifying | "It's checking the seal, locally, honestly" | *"Verifying integrity locally…"* → a deterministic verdict (§5) |
| Intact | "Nothing has changed since I sealed it" | whole seal + *"The seal is whole. Nothing has changed."* |
| Tampered | "It will tell me the truth if something's wrong" | broken seal + specific cause; recorded to history (§5, §6) |
| Any error | "It fails clearly, never randomly" | one specific cause + one consistent response (§5) |
| About | "I can see exactly what this is" | version, format version, author, license, "local-only, no telemetry" |

---

## 2. Predictability — behavioral invariants (Rule 1)

Trust is destroyed by variability. The following must hold deterministically:

- **Same flow every time.** Create always: gather → name & key → seal → sealed.
  Open always: choose → key → open → contents. Verify always: choose → inspect →
  verdict. No conditional shortcuts that change the felt sequence.
- **Same identity every time.** Opening the same `.andrii` always yields the same
  vault identity, name and visual signature (03C/03D). Never a "new" object for
  an old file.
- **Deterministic results.** Verify on an unchanged file is always "intact"; on a
  tampered file always "broken." Wrong password is always the same message. No
  randomness in outcomes or wording.
- **Idempotence.** Re-running an action (verify again, re-open) yields the same
  result and the same UI, with no accumulating side effects the user can see.
- **No hidden state.** The visible state is always a function of the vault object
  (03C) — nothing the user can't account for.

---

## 3. Object belief system — recognizable vault identity (Rule 2)

To believe a vault is "real," the user must **recognize the same vault** every
time, by more than its filename.

- **Stable identity feedback.** The same vault always shows the same name and the
  same id-derived identity across Create/Open/Verify and across sessions.
- **Consistent naming.** The name set at creation is what is shown everywhere,
  always; the app never silently renames or shows a path where a name belongs.
- **Persistent visual signature ("vault personality").** A small, deterministic
  mark derived purely from the vault id — e.g. a wax-seal monogram/sigil and a
  subtle wax-tone — so a given vault *looks like itself* every time. Deterministic
  (same id → same sigil), computed locally, no new data stored. (Design only;
  rendered on the existing Vault wax in a later visual pass — no Vault logic
  change in 04A.)
- **Recognition over recall.** In the vault list, users recognize their vault by
  signature + name, not by reading paths.

---

## 4. State transparency — UI language replacement rules (Rules 3, 6)

Replace abstract system/engineer language with concrete statements of the **real
local action**. Every status line answers "what is it doing, and where."

| Before (abstract / engineer) | After (concrete / local / trust) |
|------------------------------|----------------------------------|
| "Loading…" | "Opening your vault…" / "Restoring your vaults…" |
| "Processing…" / "Working…" | "Encrypting your files locally…" |
| "Saving…" | "Sealing the vault on your device…" |
| "Unlocking…" (bare) | "Opening your vault…" |
| "Checking…" | "Verifying integrity locally…" |
| "Done" (after seal) | "Sealed on your device" |
| "Error" / "Something went wrong" | a specific cause (see §5) |
| "Data restored" / "Reloaded" | "Your vaults are here" (§6) |

**Rules:**
1. Name the **action**, not the machine ("Encrypting your files", not
   "Processing").
2. Affirm **locality** wherever credible ("locally", "on your device").
3. Never expose architecture vocabulary in the UI: no "state", "store",
   "reducer", "session", "object", "render", "cache", "hydrate", "thread". (Rule 6)
4. One voice: calm, plain, second person, present tense. No exclamation, no
   jargon, no marketing absolutes.
5. All status strings are localized via the existing i18n keys (7 languages) —
   no hardcoded English.

---

## 5. Error behavior standardization (Rule 4)

Failures must be **deterministic, explainable, specific** — never generic. Each
known failure maps to exactly one cause, one message, one recovery, one Vault
appearance. The backend already distinguishes these conditions; the trust layer
guarantees the *consistent surfacing* of them.

| Condition (deterministic detection) | Cause shown | Response / recovery | Vault appearance |
|--------------------------------------|-------------|---------------------|------------------|
| Wrong password (`InvalidPassword`) | "That password doesn't open this vault." | stay on key entry; let retry; field keeps focus | stays `sealed` (unchanged) |
| Not an ANDRII file (`InvalidMagic`) | "This isn't an ANDRII vault." | offer to choose another | no seal / not-a-vault |
| Unsupported version (`UnsupportedVersion`) | "This vault was made by a newer ANDRII." | suggest updating the app | `sealed`, neutral |
| Tampered (integrity hash mismatch) | "The seal is broken — this vault was changed after sealing." | refuse to trust; advise not extracting; record to history | `broken` (compromised) |
| Corrupted/unreadable | "This vault is damaged and can't be opened." | offer to verify / choose another | `broken` |
| File missing (`os error 2`) | "That vault is no longer at this location." | offer to locate / remove from list | grayed / absent |
| Write/permission failure on seal | "Couldn't write the vault here — check the folder and try again." | keep drafts, let retry/choose location | returns to pre-seal, drafts intact |
| User cancelled a dialog | (no error) | silently return to the same state | unchanged |

**Principles:**
- **No generic errors.** "Something went wrong" is banned. Every surfaced failure
  names a cause from the table.
- **Same cause → same words, always.** Wrong password reads identically every
  time, in every mode, in every language.
- **Failure is non-destructive where possible.** A failed seal keeps the user's
  selected files; a failed open keeps them on the key screen.
- **Failure is honest.** Tamper is reported as tamper (never softened); we never
  claim a vault is fine when integrity didn't verify.

---

## 6. Persistence confidence model — "restored, not reloaded" (Rule 5)

Cross-session trust is the most important signal: the app must feel like it
*kept* the user's vaults, not like it *reloaded data*.

- **On launch:** known vaults are present immediately, by name, with their
  last-known seal and a recognizable signature (§3) — before the user does
  anything. The felt message: *"This is the same vault I left."*
- **Remembered facts, surfaced plainly:** "Last opened …", "Last verified …" read
  as the vault's own memory, not as a log. A vault ever found tampered keeps that
  state visibly (§5, integrity history from 03D).
- **Language:** never "Loading data" / "Restoring session" / "Reloaded." Use
  *"Your vaults are here."* The continuity is stated as fact, not as a system
  operation.
- **Resilience framing:** if the local memory is gone, the truthful fallback is
  *"Open a vault file to add it back"* — reinforcing that the file is the real
  artifact and nothing was lost (03D two-layers model).
- **No surprise:** the set of vaults shown after restart equals the set before
  restart (minus files the user moved/deleted) — never more, never fewer
  unexplained.

---

## 7. Reduce "engineer feel" (Rule 6)

- The UI never reveals the architecture: no state/store/reducer/flow words, no
  technical IDs, no raw paths where a name suffices, no stack traces, no
  millisecond timings, no debug affordances.
- Micro-copy voice is unified and human across every surface and language.
- Motion and timing are consistent (the 02C/03B language), so interactions feel
  like one product, not assembled parts.
- Crypto names (XChaCha20/Argon2id/BLAKE3) appear only in About as a quiet
  credential — never in the flow.

---

## 8. Implementation plan (04B — no features, no logic changes)

1. **Status copy pass:** route every progress/status string through i18n keys
   that name the local action (§4); add the missing keys to all 7 locales.
2. **Error mapping pass:** centralize the §5 table as the single source of error
   copy + Vault appearance; ensure each backend error variant maps to exactly one
   entry; delete any generic fallbacks.
3. **Persistence confidence copy:** launch + vault-list strings per §6.
4. **(Later visual pass)** deterministic vault sigil on the existing wax seal
   (§3) — no Vault logic change; purely a derived decoration.

None of the above adds features or changes Vault logic, crypto, persistence, or
flows — it standardizes *behavior and language* so the product reads as trustworthy.

---

## 9. Constraints honored

No new features. No Vault logic, crypto, persistence, or flow changes. 04A is
**design only**; it specifies behavior/language standards to be applied in 04B.

## 10. Success criterion

The user thinks **"I trust this tool with my files,"** not "I understand how this
tool works." Reached when behavior is predictable, identity is recognizable,
language names the real local action, failures are specific and consistent, and
restarting feels like the vaults were kept — not reloaded.

## 11. Deliverables map

1. **`docs/ANDRII_04A_TRUST_LAYER.md`** — this file.
2. **Trust signal map** — §1.
3. **Error behavior standardization spec** — §5.
4. **Persistence confidence model** — §6.
5. **UI language replacement rules** — §4 (+ §7 engineer-feel removal).
