# ANDRII 06B — Runtime Convergence (enforcement)

Implementation pass. The perception design (05A/05B/06A) is now enforced in
runtime: the UI emits **only object truth** and stays **silent during
transformations**. No features, no architecture/crypto changes.

## 1. UI string elimination map

Removed from runtime output (the strings stay in i18n but are no longer
rendered):

| Removed from UI | Where it was | Now |
|-----------------|--------------|-----|
| "Sealing your files…" / current file name | Create, while sealing | **silent** — the vault simply closes |
| "Unlocking…" | Open, while opening | **silent** — the vault simply opens |
| "Checking the seal…" | Verify, while inspecting | **silent** — the vault is inspected |
| "Extracting…" + spinner | Open contents overlay | **silent** dim, no words, no spinner |
| spinner on "Extract all" | Open toolbar | removed; button just disables |
| "Encrypted and sealed locally…" footnote | Create success | removed (system word "encrypted") |

What remains is **object truth + identity** only: a vault that is *empty,
holding, sealed, open, intact,* or *compromised*, by its name.

## 2. Runtime cleanup specification (code changes)

- **CreateArchive**: removed the `archive-progress` listener, the `progress`
  state and `ProgressEvent` import; the sealing view is now `<VaultScene
  state="sealed">` with **no caption/percent/filename** — a silent closing vault.
- **OpenArchive**: the opening view is the bare `unlocking` Vault (no text); the
  extracting overlay is a silent dim (removed `Loader2` spinner + "Extracting…");
  the Extract-all button dropped its spinner. `Loader2` import removed.
- **VerifyArchive**: the inspecting view is the bare `unlocking` Vault (no
  "Checking…" text).
- **SecurityReport**: removed the "Encrypted and sealed locally" footnote.

No spinners remain as the subject of any screen; no progress ladders, percents,
or per-file narration anywhere.

## 3. Final Vault truth renderer rules

- The UI renders the **Vault** and, at most, its **name** and **truth**. Truth is
  one of: empty · holding · sealed · open · intact · compromised.
- **Transformations are silent and physical**: sealing = the vault closes;
  opening = it opens; inspecting = the seal is examined. No words accompany them.
- **Confirmation is the look of the object**, not a sentence about the system.
- **Errors only** speak (one deterministic sentence, 04C) — failure is the single
  case where words are required, because the object alone can't explain a wrong
  key. Everything else is shown, not said.
- **Silence principle**: if nothing changed, the UI says nothing — no idle/ambient
  text, no status presence.

## 4. Before / after runtime comparison

| | Before (04C) | After (06B) |
|-|--------------|-------------|
| Sealing | "Sealing your files…" + filename | silent closing vault |
| Opening | "Unlocking…" | silent opening vault |
| Verifying | "Checking the seal…" | silent inspected vault |
| Extracting | spinner + "Extracting…" | silent dim |
| Success footnote | "Encrypted and sealed locally" | (removed) |
| Words during operations | several | **none** (only the object) |
| Spinners | present | **none** |

## 5. Success criterion

Seeing any operation, the user reads the **vault**, not the system: it closes, it
opens, it shows a whole or broken seal. The machinery never speaks; only the
object's truth — and, when a key is wrong, one plain sentence.
