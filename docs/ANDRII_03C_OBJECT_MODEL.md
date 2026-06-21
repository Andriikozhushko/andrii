# ANDRII 03C — Object Realism Layer

> System design only. **No code changes in 03C.** Implementation is 03D.
> No new features / screens / Vault visuals / animations / navigation.

03B made the Vault the single visual center, but it is still driven *by the UI*:
each screen passes a `state` prop and renders its own `<Vault>`. That reads as "a
UI that changes states." 03C inverts the dependency: define a **VaultObject** as
the source of truth; the UI only **reflects** it. The Vault becomes a *renderer
of an object*, not a state-machine controller.

---

## 1. Mental model — the shift

| | Before (03B) | After (03C) |
|-|--------------|-------------|
| What the Vault *is* | a visual of the current UI state | a **real object** with a lifecycle |
| Who decides visuals | the screen (`<Vault state="sealed"/>`) | the **object** (`encryption/seal/integrity` derive the visual) |
| Across modes | a fresh `<Vault>` re-rendered per screen | the **same object instance** evolving |
| "Broken" | a Verify-screen result | the object's **integrity is compromised** |
| User belief | "this app animates encryption" | "I'm holding a secure object that changes as I act on it" |

The product sentence becomes: **"There is one vault. I fill it, I seal it, I
carry it, I open it, I check whether its seal is still whole."** The screens are
just where I stand while doing that.

This is a UI/mental-model layer over the existing Rust crypto core — it does
**not** change cryptography, the archive format, or the flows. It changes what
owns the truth on the frontend.

---

## 2. VaultObject — schema definition

```ts
// src/vault/object.ts  (to be added in 03D)

export type EncryptionState = "none" | "draft" | "encrypting" | "encrypted";
export type SealState       = "unsealed" | "sealing" | "sealed" | "opening" | "open";
export type IntegrityState  = "unknown" | "verifying" | "intact" | "compromised";

export interface VaultItem {
  path: string;        // source path (draft) or in-archive path (loaded)
  name: string;        // display name
  size: number;        // bytes (0 = unknown / folder)
  isDir: boolean;
}

export interface VaultMetadata {
  fileCount: number;
  originalSize: number;       // bytes before sealing
  sealedSize: number;         // bytes on disk once sealed
  createdAt: number | null;   // epoch ms (set when sealed / read when loaded)
  formatVersion: number | null;
  spaceSavedPct: number | null;
}

/**
 * The one object the user is acting on. There is exactly one "current"
 * VaultObject at a time; the UI reflects it.
 */
export interface VaultObject {
  id: string;                 // stable identity for THIS object instance
  origin: "new" | "loaded";   // created in Create vs opened from disk
  path: string | null;        // .andrii location (null until sealed; set when loaded)
  name: string;               // vault / archive name

  files: VaultItem[];         // drafts to seal (new) OR revealed contents (loaded+open)
  metadata: VaultMetadata;

  encryption_state: EncryptionState;
  seal_state: SealState;
  integrity_state: IntegrityState;

  // NEVER the password and NEVER a stored hash. A transient, in-memory handle
  // for the active operation only; null at rest, zeroized/cleared after use.
  password_hash_reference: PasswordRef | null;
}

export interface PasswordRef {
  /** opaque session token for the in-flight op; not persisted, not the secret */
  token: string;
  heldUntil: "operation" ;   // lifetime = the single create/open/verify call
}
```

### Field semantics
- **id / origin / path** — identity & provenance. `id` lets the UI treat it as
  the same instance even as fields change. `origin` distinguishes a draft being
  built (Create) from one brought in (Open/Verify).
- **files / metadata** — the contents and the human-readable facts (counts,
  sizes, dates, format version, savings). Drafts before sealing; revealed
  contents after opening.
- **encryption_state / seal_state / integrity_state** — the three independent
  lifecycle axes that, combined, fully determine the visual (see §4).
- **password_hash_reference** — security-critical: this is **not** the password
  and **not** a persisted hash. It is a transient handle for the current
  operation, held in memory only, cleared the moment the op completes. The real
  KDF/encryption stays entirely in the Rust core.

---

## 3. Object lifecycle (the three axes)

```
encryption_state:  none ─▶ draft ─▶ encrypting ─▶ encrypted
seal_state:        unsealed ─▶ sealing ─▶ sealed ─▶ opening ─▶ open
integrity_state:   unknown ─▶ verifying ─▶ { intact | compromised }
```

A VaultObject is just a point in this space. Examples:

| User situation | encryption | seal | integrity |
|----------------|-----------|------|-----------|
| empty new vault | none | unsealed | unknown |
| files added | draft | unsealed | unknown |
| sealing now | encrypting | sealing | unknown |
| freshly sealed | encrypted | sealed | intact |
| brought in from disk | encrypted | sealed | unknown |
| entering password | encrypted | opening | unknown |
| opened, contents shown | encrypted | open | unknown |
| being verified | encrypted | sealed | verifying |
| verified good | encrypted | sealed | intact |
| tampered | encrypted | sealed | **compromised** |

---

## 4. Object → UI derivation (the renderer rule)

The Vault visual is **computed** from the object — screens never choose it.

```ts
export function deriveVaultVisual(o: VaultObject): { state: VaultState; tone: VaultTone } {
  if (o.integrity_state === "compromised") return { state: "broken",    tone: "danger" };
  if (o.integrity_state === "verifying")   return { state: "unlocking", tone: "neutral" };
  if (o.seal_state === "sealing" || o.encryption_state === "encrypting")
                                           return { state: "sealed",    tone: "neutral" };
  if (o.seal_state === "opening")          return { state: "unlocking", tone: "neutral" };
  if (o.seal_state === "open")             return { state: "opened",    tone: "neutral" };
  if (o.seal_state === "sealed")
    return { state: "sealed", tone: o.integrity_state === "intact" ? "safe" : "neutral" };
  // unsealed:
  return o.files.length > 0 ? { state: "filling", tone: "neutral" }
                            : { state: "idle",    tone: "neutral" };
}
```

This single pure function replaces every hardcoded `state="…"` currently passed
by screens. `<Vault>`'s visual enum (03B) is unchanged — it is now an *output*
of the object, not an input from the UI.

---

## 5. UI → Object mapping (actions are object transitions)

Screens stop "showing states" and instead **mutate the one VaultObject**; the
Vault re-derives. Each user action is a transition:

| Mode action | Transition on the current VaultObject |
|-------------|----------------------------------------|
| Drop / Add files | `files += …`; `encryption_state: draft`; `seal_state: unsealed` |
| Clear | reset to empty draft (`none/unsealed`, `files=[]`) |
| Name the vault | `name = …` (no axis change) |
| Seal | `seal_state: sealing`, `encryption_state: encrypting` → on success `encrypted/sealed/intact`, set `path`, `metadata` |
| Choose archive (Open) | load → new object `origin:"loaded"`, `encrypted/sealed/unknown`, `path`, `name` |
| Turn the key (Open) | `seal_state: opening` → success `open` + populate `files`; failure → back to `sealed` |
| Inspect (Verify) | `integrity_state: verifying` → `intact` or **`compromised`** |

Crypto calls (Rust commands) are unchanged; they are simply the *effects* that
drive these transitions. The frontend store records the resulting object truth.

---

## 6. Continuity & single instance (Rules 3 & 4)

To feel persistent, the Vault must be **one element that survives screen
changes**, not a per-screen remount.

- **One store, one object.** A `VaultProvider` (context + reducer) holds the
  current `VaultObject`. Modes read/dispatch to it; they do not own it.
- **One mount point.** The Vault renders from a **stable position** in the tree
  (e.g. a persistent stage layer in the app shell), so React keeps the same
  component instance and CSS transitions animate continuously between states
  instead of unmount→remount. Screens contribute only the surrounding caption
  and affordances around that single Vault.
- **Stable identity.** Keyed by `VaultObject.id`, never by screen/route, so
  moving Create → Open → Verify on the *same* object is visibly the same object
  evolving.

(Implementation note for 03D: today each screen mounts its own `<Vault>`; the
refactor hoists a single `<CurrentVault/>` to the shell driven by the store. No
visual or animation redesign — same component, same states, just one instance.)

---

## 7. Failure = object damage (Rule 5)

"Broken" is **not** a Verify view. It is `integrity_state: "compromised"` on the
object. Any surface showing that object (not only Verify) would render it as a
broken vault, because the damage lives on the object. Verify is merely the act
that *discovers* the integrity truth and writes it onto the object.

---

## 8. Refactor plan (03D — no new features)

1. **Add `src/vault/object.ts`** — the types above + pure helpers:
   `emptyVault()`, `withFiles()`, `loadedVault(meta)`, `deriveVaultVisual()`,
   transition reducers. Pure & unit-testable; no React, no side effects.
2. **Add `src/vault/store.tsx`** — `VaultProvider` + `useVault()` (reducer
   holding the current `VaultObject` + dispatch of the §5 transitions).
3. **Add `<CurrentVault/>`** — connects the store to `<Vault>` via
   `deriveVaultVisual`. Mount once in the app shell (stable position).
4. **Refactor screens to dispatch, not render visuals:** Create/Open/Verify call
   transitions (add files, seal, open, verify) and render only their captions +
   affordances; remove their direct `<Vault state="…"/>` usages.
5. **Bridge with existing `CanvasState`:** keep routing/flows (02C) as the
   *view* layer; the `VaultObject` becomes the *data/identity* layer. The two
   stay in sync (route reflects which surface; object reflects what's true).
6. **Security:** `password_hash_reference` lives only for an in-flight op; never
   stored, never logged; cleared in `finally`. The password itself continues to
   go straight to the Rust command as today.

Nothing above adds features, screens, visuals, animations, or navigation — it
relocates *ownership of truth* from UI components to one object + store.

---

## 9. Unchanged / constraints honored

- Rust crypto core, `.andrii` format, KDF — untouched.
- 02C flows, 03B Vault visuals & animations, mode system & nav — untouched.
- No new features, no new screens. 03C ships **design only**; 03D implements.

---

## 10. Success criterion

A user (and the codebase) should think **"this vault is a real object I'm acting
on,"** not "this is a UI that changes states." Achieved when the visual is a
function of the object, one Vault instance persists across modes, and integrity
failure is a property of the object rather than a screen outcome.

## 11. Deliverables map

1. **`docs/ANDRII_03C_OBJECT_MODEL.md`** — this file.
2. **VaultObject schema** — §2.
3. **UI → Object mapping layer** — §4 (object→UI derivation) + §5 (UI→object
   transitions).
4. **Refactor plan (no new features)** — §8.
5. **Updated mental-model explanation** — §1, §6, §7, §10.
