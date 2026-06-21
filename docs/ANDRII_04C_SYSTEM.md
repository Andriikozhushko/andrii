# ANDRII 04C — Consolidated System (runtime)

The design layers 03C/03D/04A are now **real runtime behavior**. Brief map only.

## What is now implemented

- **VaultObject model** — `src/vault/object.ts` (pure, deterministic): registry
  types, stable `vaultId(path)` (FNV-1a), `deriveVaultVisual(object)` (object →
  Vault visual; the UI never picks the visual), integrity helpers.
- **VaultStore persistence** — `src/lib/storage.ts`: a local registry of vaults
  in WebView2 `localStorage` that **survives app restarts**. Write-through:
  `recordCreated` (on seal), `recordOpened` (on unlock), `recordVerified` (on
  verify → appends to integrity history). `getVaults()` hydrates on launch and is
  shown in Open mode. One-time migration of the legacy 02A recents. Stores only
  non-sensitive metadata + timeline — never passwords, keys, or contents.
- **Deterministic errors** — `src/lib/errors.ts`: one `mapError()` maps every
  backend failure to exactly one i18n cause. Wired into Create / Open / Verify.
  No raw strings, no generic "something went wrong".
- **Integrity memory in UI** — remembered vaults render as a small `<Vault>` whose
  visual is derived from history: a vault ever found tampered shows the **broken
  seal** wherever it's listed (`entryVisual`).

## Data flow

```
 seal ──▶ recordCreated ─┐
 open ──▶ recordOpened ──┼─▶ localStorage registry (persists across restarts)
 verify ─▶ recordVerified┘            │
                                       ▼
 launch ──▶ getVaults() ──▶ Open mode list ──▶ <Vault> per entry via deriveVaultVisual
```

## Behavior guarantees (04A)

- Same `.andrii` path → same `vaultId` → same remembered vault, every session.
- Same backend failure → same one-sentence cause, in every mode and language.
- Verify writes a definite intact/compromised result into the vault's memory;
  a compromised vault stays visibly broken in the list.

## Real-scenario checklist (Rule 6)

- [ ] Create a vault → close app → reopen → the vault is listed (Open mode), by
      name, with its remembered seal.
- [ ] Wrong password → "That password doesn't open this vault." (always identical).
- [ ] Tampered/normal file in Verify → broken / intact, recorded to memory; the
      listed vault reflects it.
- [ ] Re-verify an unchanged vault → same result, no drift.

## Not done here (honest scope)

- At-rest encryption of the registry (03D's DPAPI option) — registry is currently
  plaintext localStorage (non-sensitive metadata only). Future hardening.
- Single hoisted `<CurrentVault/>` instance across screens — each screen still
  renders its own `<Vault>` (visual is already unified). Future continuity polish.
- 04B layout simplification beyond behavior/trust — deliberately not a UI
  redesign here (per the do-not list).
