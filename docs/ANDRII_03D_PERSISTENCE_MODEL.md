# ANDRII 03D — Persistence & Lived Object Layer

> System design only. **No code in 03D.** Implementation is 03E.
> No new features / crypto / Vault visuals / flows / Vault component changes.

03C made the `VaultObject` the source of truth — but only in memory, for one
session. 03D makes the vault feel **lived**: it exists over time, survives app
restarts, remembers its own history, and is recognized as the *same* object
whenever it reappears.

---

## 1. Two layers of truth (the honest model)

A vault already persists — as a file. 03D layers a local *memory* on top so the
app recognizes and remembers it.

| Layer | Where | Holds | Authority |
|-------|-------|-------|-----------|
| **The artifact** | the `.andrii` file on disk | the encrypted contents + header (name, created, file list — password-gated; integrity — verifiable without password; format version) | **canonical** |
| **The memory** | local **VaultStore** registry (this machine) | non-sensitive metadata the app *learned* + lifecycle timeline | a cache / recognition index |

Principle: **the file is the vault; the registry is the app's memory of it.** If
the registry is wiped, vaults still exist — opening the file re-adds them. The
registry exists so the app can say "I know this vault, here is its name and
history" without re-deriving everything (and without the password) every launch.

This is the truthful reading of "exists even when I'm not using the app": the
sealed file is permanent; the registry restores the *feeling* of continuity.

---

## 2. Schemas — runtime object vs persisted entry

The runtime `VaultObject` (03C) is extended with lifecycle memory. Only a
**non-sensitive subset** is ever persisted.

```ts
// extends 03C VaultObject
interface VaultObject {
  // …03C fields (id, origin, path, name, files, metadata,
  //   encryption_state, seal_state, integrity_state, password_hash_reference)…

  fingerprint: string | null;        // content id for re-identification (see §3)
  createdAt: number | null;          // epoch ms (from header once known)
  lastOpenedAt: number | null;
  lastVerifiedAt: number | null;
  integrity_history: IntegrityEvent[];
}

interface IntegrityEvent { at: number; result: "intact" | "compromised"; }
```

```ts
// the ONLY thing written to disk by VaultStore — no secrets, no contents
interface VaultRegistryEntry {
  id: string;
  path: string;            // last known location of the .andrii file
  fingerprint: string | null;
  name: string;            // remembered display name
  fileCount: number;
  sealedSize: number;
  formatVersion: number | null;
  createdAt: number | null;
  lastOpenedAt: number | null;
  lastVerifiedAt: number | null;
  integrity_history: IntegrityEvent[];   // failure is historical (Rule 6)
  seal_state: "sealed";    // a persisted vault is, by definition, sealed
}
```

**NEVER persisted:** passwords, KDF output/keys, `password_hash_reference`,
decrypted file contents, or anything that could open the vault. The registry is
metadata only.

---

## 3. Identity & re-identification

For the vault to be "the same entity" across sessions and modes (Rules 1, 5),
`id` must be stable and reproducible.

- **Primary id:** `id = blake3("andrii-vault" ‖ normalized_path)` — stable while
  the file stays put; lets us recognize it instantly on launch without the
  password.
- **Fingerprint:** when the archive's integrity hash is known (verify reads it
  without a password), store `fingerprint = integrity_hash_at_creation`. If a
  file is moved/renamed, a path-id miss can fall back to fingerprint match so the
  same artifact keeps its memory.
- **Honest limitation:** moving a file before it's ever re-opened, or copying it,
  can create a second registry entry until a fingerprint match reconciles them.
  Identity is best-effort recognition, not a guarantee embedded in the file
  (we cannot change the `.andrii` format to embed a UUID in this milestone).

---

## 4. VaultStore architecture (design only)

A persistence abstraction the rest of the app depends on; the UI never touches
storage directly.

```ts
interface VaultStore {
  hydrate(): Promise<VaultObject[]>;          // launch: load + reconstruct all known vaults
  load(id: string): Promise<VaultObject | null>;
  save(entry: VaultRegistryEntry): Promise<void>;     // insert/replace
  update(id: string, partial: Partial<VaultRegistryEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  list(): Promise<VaultRegistryEntry[]>;
}
```

### Backend — local, encrypted, no cloud
- **Location:** the OS app-data dir (e.g. `%APPDATA%/ANDRII/registry.bin`) via
  the Tauri path/fs APIs — so it survives even if WebView2 storage is cleared,
  and reads as a *real* persisted object, not browser state.
- **Encrypted at rest:** the registry reveals which archives exist + their names,
  so it is encrypted with a **device-local key from the OS keystore**
  (Windows **DPAPI** / Credential Manager; macOS Keychain; Linux secret-service).
  This uses platform crypto only — it does **not** touch the `.andrii` crypto
  core. No key management for the user.
- **Reconstruction:** `hydrate()` decrypts the registry → builds `VaultObject`s
  in `{ seal_state: "sealed", integrity_state: "unknown" }`, populated from the
  remembered metadata + timeline. They appear as known, sealed vaults
  immediately, before any password.
- **Migration:** the existing 02A `localStorage` recents are imported once into
  the registry, then superseded.

(Implementation note 03E: `VaultStore` is the persistence half of the 03C
`VaultProvider`; mutations go object → store, launch goes store → objects.)

---

## 5. Persistence flow diagram

```
 APP LAUNCH
   └─ VaultStore.hydrate()
        └─ OS keystore → key → decrypt registry.bin
             └─ VaultObject[] (sealed, integrity=unknown, with timelines)
                  └─ UI lists known vaults (Open mode) — they already "exist"

 CREATE → seal succeeds
   └─ dispatch SEALED → VaultStore.save(entry{ createdAt=now, fingerprint, name,… })

 OPEN → unlock succeeds
   └─ dispatch OPENED → VaultStore.update(id, { lastOpenedAt: now })
        (revealed contents live in the runtime object only — never persisted)

 VERIFY → result
   └─ dispatch INTEGRITY → VaultStore.update(id, {
            lastVerifiedAt: now,
            integrity_history += { at: now, result }     // Rule 6
        })

 APP CLOSE
   └─ nothing special — every transition already persisted (write-through)
```

Write-through on each transition means there is no "save session" step; the
vault's memory is always current. Closing the app loses nothing.

---

## 6. Object lifecycle timeline model

Each vault carries its own time-line as part of identity — **memory, not a logs
screen** (Rule 4). It informs subtle cues (e.g. a vault whose last verify was
`compromised` renders with the broken seal wherever it appears), never a
dashboard.

```
 created ──▶ opened ──▶ verified(intact) ──▶ opened ──▶ verified(COMPROMISED) ──▶ …
   │           │              │                              │
 createdAt  lastOpenedAt   lastVerifiedAt            integrity_history grows
```

- `createdAt` — known when sealed here, or read from the header after first
  unlock elsewhere.
- `lastOpenedAt` / `lastVerifiedAt` — most-recent events on **this device**.
- `integrity_history` — append-only record of every verify result; the vault
  "remembers" if it was ever found tampered.
- **Per-device honesty:** events are recorded where they happen; the immutable
  `.andrii` file cannot be written back, so a vault seen on a fresh machine
  starts with only what its header reveals.

---

## 7. Cross-session & cross-mode continuity (Rules 1, 3, 5)

- **Lifetime (Rule 1):** the `VaultObject` is owned by the 03C store, not by any
  screen, and is hydrated from the registry at launch — switching modes, closing
  screens, or restarting the app restores the *same* entity (same `id`, same
  seal/integrity/metadata/timeline).
- **Continuity feeling (Rule 3):** on reopen the user sees their vaults already
  present with remembered names and last-known seal/integrity — "my vault still
  exists," not "new session."
- **Cross-mode identity (Rule 5):** Create/Open/Verify act on the same object id;
  the single persistent `<CurrentVault/>` (03C) reflects its retained seal state,
  integrity status, and metadata identically in every mode.

---

## 8. Failure is historical (Rule 6)

A tamper result is not a transient Verify outcome: it is appended to
`integrity_history` and sets `integrity_state: "compromised"` on the object.
Thereafter, any surface that shows that vault renders the broken seal, and its
memory records *when* it broke — the damage belongs to the object's history.

---

## 9. Security & honesty caveats (must hold)

- No passwords, keys, or decrypted contents in the registry — metadata only.
- Registry encrypted at rest via OS keystore (DPAPI/Keychain); not cloud, not
  synced.
- The `.andrii` file remains the sole canonical artifact; the registry is a
  recognition cache. Deleting the registry loses memory, not vaults.
- Timeline is per-device; we do not (cannot, this milestone) write history back
  into the sealed file.
- Path-based identity is best-effort; fingerprint matching reconciles moves.

---

## 10. Implementation plan (03E — no features)

1. `src/vault/store.ts` — `VaultStore` over the OS app-data dir; serialize the
   registry; encrypt/decrypt via a new Rust command pair `registry_seal` /
   `registry_open` that wraps **OS DPAPI/keystore** (platform crypto only).
2. Extend the 03C `VaultProvider` with `hydrate()` on mount and write-through on
   each transition.
3. Extend `VaultObject` with the §2 timeline fields; compute `fingerprint` from
   the verify integrity hash when available.
4. Point Open-mode "recents" at the registry (one-time import from localStorage),
   rendering each entry as a remembered sealed Vault.
5. No UI features, no new screens, no Vault visual/flow/nav changes — only the
   data is now persistent and lived.

---

## 11. Constraints honored

Crypto core, `.andrii` format & KDF — untouched (OS keystore is used only for the
local registry, separately). 02C flows, 03B Vault visuals/animations, 03C object
model, mode system & navigation — untouched. No new features/screens. 03D is
**design only**; 03E implements.

## 12. Success criterion

The user (and the code) treats the vault as **"a thing that exists even when I'm
not using the app"** — restored, not recreated — with its own remembered history.

## 13. Deliverables map

1. **`docs/ANDRII_03D_PERSISTENCE_MODEL.md`** — this file.
2. **VaultStore architecture** — §4.
3. **Persistence flow diagram** — §5.
4. **Object lifecycle timeline model** — §6 (+ schema §2).
5. **UI continuity mapping rules** — §7 (+ §8 failure history).
