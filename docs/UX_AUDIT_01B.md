# ANDRII 01B — UX Audit

**Author:** Senior Product/UX Designer + Security Product Architect  
**Date:** 2026-06-20  
**Scope:** Full UI/UX review before enterprise polish sprint

---

## Executive Summary

ANDRII 01A has correct cryptographic mechanics and a working archive pipeline. The UI, however, reads as a developer prototype. It would not be mistaken for a commercial security product at first glance. This audit documents every problem with enough specificity to drive direct implementation fixes.

---

## 1. What Currently Feels AI-Generated

### 1.1 Algorithm names as the primary hero content
The Home screen's bottom section leads with `XChaCha20-Poly1305`, `Argon2id`, and `BLAKE3` in card format. These are meaningful to cryptographers. They are meaningless to the user who needs to archive their financial documents. No commercial security product (1Password, Bitwarden, Proton Drive) lists algorithm names on their home screen. They say: "Your data is safe." Then offer a details link for those who want specifics.

**Rule violated:** Users care about outcomes, not mechanisms.

### 1.2 Security Report is an algorithm catalog
The Security Report after archive creation lists:
- Encryption: XChaCha20-Poly1305
- Key Derivation: Argon2id (64 MiB, 3×, 4 lanes)
- Integrity: BLAKE3 (archive + per-file)
- Metadata: Fully encrypted
- Compression: Maximum

This is a developer checklist, not a security confirmation. A user who just encrypted their files wants to know: **"Is this safe?"** — not which cipher was chosen. The answer to that question should be the largest thing on the screen.

### 1.3 `XChaCha20-P1305` in the summary sidebar
The Create Archive right panel shows `XChaCha20-P1305` (note: already truncated/abbreviated) as a metadata field in the file summary. This is noise to any non-technical user. Worse, the abbreviation is incorrect — it should be XChaCha20-Poly1305. Technical users who know what this means will spot the truncation as sloppy.

### 1.4 Status bar reads as IDE output
The bottom status bar shows:
`● XChaCha20-Poly1305  Argon2id  BLAKE3  Zstd  Format v1`

This belongs in an IDE status bar, not a security application. The footer of Bitwarden shows your account email. 1Password shows "All Items." The status bar should confirm identity/state, not advertise primitives.

### 1.5 Three equal-weight action cards
Home screen shows three cards in a horizontal grid: Create / Open / Verify. All three are the same visual weight. In reality:
- 90% of first-use is: Create Archive
- 50% of ongoing use is: Open Archive
- Occasional use is: Verify Archive

Equal weighting implies equal importance. This doesn't reflect actual usage. It also makes the screen feel like a feature matrix.

---

## 2. Visual Hierarchy Problems

### 2.1 No clear primary focal point on Home
When the user opens ANDRII, their eye has no natural resting point. The hero icon is 80×80 px (appropriate), the heading is 4xl bold (appropriate), but the supporting text ("Professional secure archive application with military-grade encryption, metadata protection, and integrity verification") is dense and communicates less than a simple tagline would.

**Comparison:** Proton Drive shows "Secure cloud storage" and a single large call-to-action. Nothing else competes for attention.

### 2.2 Create Archive is not sufficiently differentiated
The primary card (`Create Archive`) gets `bg-accent/8 border-accent/25` and a slightly brighter icon. The visual weight difference between primary and secondary cards is 20% at most. It should be 300%.

**Fix:** Create Archive should span full width or be 2× the height of the secondary actions. Secondary actions (Open, Verify) should sit below it, smaller.

### 2.3 Compression profile selector looks like a settings panel
The three compression buttons (Fast / Balanced / Maximum) are styled identically to any generic toggle group. The copy "Speed priority" / "Best overall" / "Smallest size" is functional but flat. This needs either icon differentiation or a cleaner selection affordance (e.g., the selected state should have a visible check or an emphasized label, not just a border color change).

### 2.4 Password strength bars are technically there but contextually invisible
The five thin bars below the password field (each 4 px tall) are hard to read at a glance. The "Weak" label appears on the right, not next to the bars. Users scan left-to-right; the label should be adjacent to the strength bars, not on the opposite end of the row.

### 2.5 Security Report modal header is undersized relative to importance
The archive-created confirmation should feel like an achievement. The current modal shows a small 9×9 ShieldCheck icon next to a 13px label. This should be the moment of delight — the visual equivalent of "your money is safe." Instead it looks like an info toast.

---

## 3. Information Overload

### 3.1 Create Archive right panel has 5 distinct content zones in 320px
In order from top to bottom:
1. "ENCRYPTION" label (uppercase, tracking-wider — reads as a section heading)
2. Password field
3. Confirm password field
4. Summary panel (Files / Compression / Encryption)
5. Progress (conditional)
6. Error (conditional)
7. Action buttons

320px is not enough to breathe. Every element is competing for the same visual register. The "Encryption" header is unnecessary — the user knows they're creating an encrypted archive.

### 3.2 Security Report shows 7 pieces of information in 5 rows
The security profile section shows 5 rows, each with: checkmark icon + primitive icon + label (min-width:110px) + value. The label column is too wide, making the value column crowded. Users won't read all 5 rows — they'll scan the checkmarks and move on.

### 3.3 Archive metadata shows 4 stats in a cramped grid
The open archive metadata bar shows Files / Original / Compressed / Created in a 4-column grid. On the ~900px right panel, this works. On a 1200px window at 80% zoom it degrades. More critically, none of these stats answer the user's actual question: "Is this archive safe to extract?"

### 3.4 VerifyArchive shows technical details nobody asked for
The verify result shows "Format Version: v1" and "File Size: X MB" as prominent detail stats. These are internal metadata. The user verifying an archive wants one answer: **"Is it safe?"** — yes/no, with a confidence indicator.

---

## 4. Desktop UX Problems

### 4.1 No drag-and-drop on the Home screen
The most natural flow for desktop archiving software:
1. User drags files from Explorer onto the app
2. App creates archive

Currently, drag-and-drop only works after navigating to "Create Archive." The home screen accepts no drop. This forces an unnecessary navigation step for the most common action.

**Reference:** 7-Zip, WinRAR, Keka — all accept drops on their main window.

### 4.2 No keyboard shortcut affordances visible
The app has no visible keyboard shortcuts. Ctrl+N (new archive), Ctrl+O (open archive) are standard desktop conventions. Their absence makes the app feel like a web app wrapped in Electron, not a native desktop tool.

### 4.3 Window title does not reflect current state
The title is always "ANDRII — Secure Archive" regardless of what screen is active. A native app would show "ANDRII — Create Archive" or "ANDRII — secret.andrii" when an archive is open.

### 4.4 Back navigation uses "Cancel" label in wrong contexts
On the Create Archive screen, the secondary button says "Cancel." If the user has added files and entered a password but hasn't created the archive yet, "Cancel" implies they lose work. The label should be "Back" or "Discard" when there is no in-progress operation.

### 4.5 File list in Open Archive has no sort or search
With 100+ files in an archive, the file list becomes unusable. No sort by name, type, size, or date. No search/filter. This is a shipping blocker for any archive with real content.

### 4.6 No file association / double-click to open
Double-clicking a `.andrii` file in Explorer does nothing. There is no shell extension, no context menu, no file type icon. The file appears as an unknown type. This is the most visible missing feature for a desktop application — it makes the product feel unfinished in the most basic way.

---

## 5. Onboarding Problems

### 5.1 No first-run guidance
First launch shows three cards and algorithm names. There is no indication of what to do first, what the workflow is, or why this is better than WinZip + a password.

**Fix:** On first run (or until the first archive is created), show a 3-step inline guide:
1. Add your files
2. Set a strong password
3. Your archive is encrypted and ready

### 5.2 Error messages are raw Rust strings
When a wrong password is entered, the error shown in the sidebar is the raw Rust error string: `Invalid password or corrupted archive header`. This is correct but cold. A commercial product would say: "Incorrect password. Please try again."

### 5.3 The "empty state" for archive open is functional but joyless
The placeholder for an unopened archive ("No archive open / Select a .andrii file and enter the password") is just two lines of text centered in a box. A commercial product uses this as an opportunity — a brief illustration, a drag-drop hint, a "start here" affordance.

---

## 6. Security Communication Problems

### 6.1 No security score — the fundamental answer is missing
The user's core security question is: "Is my archive protected well enough?" The current UI never directly answers this. It lists the algorithms and trusts the user to understand what XChaCha20-Poly1305 implies. They don't.

**Fix:** A Security Score (0–100, labeled Excellent/Good/Moderate/Weak) should be the primary output of the security assessment, visible immediately after creation and during verification.

### 6.2 Password crack time is misleading
"test123" shows as "Weak / 78 years." The "78 years" is technically correct (assuming Argon2id at 2 guesses/sec) but communicates false safety. The user reads "78 years" and thinks their weak password is fine. The label "Weak" is contradicted by the reassuring time estimate.

**Fix:** Show crack time at GPU brute-force rate (without memory-hard protection) as the primary estimate. Show Argon2id as a secondary "what our protection adds." This makes "test123" show "< 1 second (GPU)" while explaining that Argon2id extends this to 78 years — teaching the user about the protection rather than hiding it behind the number.

### 6.3 Verify Archive result mixes severity levels poorly
On a tampered archive, the result shows a "Warning" state (amber) for partially-valid files. But a tampered archive is not a "Warning" — it is a definitive security failure. The amber state minimizes severity.

**Fix:** Any detected tampering → red FAIL state with explicit "This archive has been modified. Do not trust its contents." language.

### 6.4 "Metadata: Fully encrypted" means nothing without context
The security profile lists "Metadata: Fully encrypted" but doesn't explain why this matters. A user who doesn't know what metadata leakage is will skip this row. The fix is to replace technical feature labels with benefit language: "File names are hidden" rather than "Metadata: Fully encrypted."

---

## 7. Summary of Issues by Priority

| Priority | Category | Issue |
|---|---|---|
| P0 | Desktop UX | No file association / double-click to open |
| P0 | Security communication | No security score — user can't answer "is this safe?" |
| P0 | Security communication | Password crack time misleads (78 years for "test123") |
| P1 | Visual hierarchy | Primary action not differentiated enough |
| P1 | Onboarding | No drag-to-create on home screen |
| P1 | Desktop UX | Raw Rust error strings shown to users |
| P1 | Information overload | Algorithm names on home screen |
| P2 | Desktop UX | Window title doesn't reflect state |
| P2 | Desktop UX | No keyboard shortcuts |
| P2 | Visual hierarchy | Security Report modal doesn't feel like an achievement |
| P2 | Information overload | Create Archive right panel is crowded |
| P3 | Desktop UX | No sort/search in file list |
| P3 | Onboarding | Empty states are functional but joyless |
| P3 | Security communication | "Metadata: Fully encrypted" benefit unclear |

---

## 8. Reference Design Language Analysis

Products studied: 1Password Desktop, Proton Drive, Bitwarden Desktop, Tailscale, Cloudflare Zero Trust, Ente Photos.

**Common patterns in professional security software:**

1. **Outcome first, mechanism second.** The primary UI confirms safety ("Your vault is locked"). Algorithm details are one click deeper.

2. **One primary action.** Each screen has one dominant call-to-action. Supporting actions are visually subordinate.

3. **Status at a glance.** A persistent indicator (green lock, shield icon with status) tells the user their current protection state without any reading.

4. **Human-readable security language.** "Strong password" not "68 bits entropy." "Last verified 3 minutes ago" not "BLAKE3 hash match: true."

5. **Delight at success moments.** Creating a vault, adding an item, syncing — these get celebratory states (animation, larger visual, affirming copy) because these are the moments that build product trust.

6. **Quiet, confident typography.** No uppercase tracking-wider on every label. Headers are large and confident. Supporting text is small and subdued. The hierarchy is stark, not uniform.
