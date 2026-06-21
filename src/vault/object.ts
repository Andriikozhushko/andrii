/**
 * ANDRII 04C — VaultObject model (03C/03D in real code).
 *
 * Pure, deterministic. The single source of truth for what a vault *is*; the
 * Vault component renders a visual derived from it. No React, no side effects.
 */
import type { VaultState, VaultTone } from "../components/Vault";

export type EncryptionState = "none" | "draft" | "encrypting" | "encrypted";
export type SealState = "unsealed" | "sealing" | "sealed" | "opening" | "open";
export type IntegrityState = "unknown" | "verifying" | "intact" | "compromised";

export interface IntegrityEvent {
  at: number;                       // epoch ms
  result: "intact" | "compromised";
}

/** The persisted, non-sensitive memory of a vault (never secrets/contents). */
export interface VaultRegistryEntry {
  id: string;
  path: string;
  name: string;
  fileCount: number;
  sealedSize: number;
  formatVersion: number | null;
  createdAt: number | null;
  lastOpenedAt: number | null;
  lastVerifiedAt: number | null;
  integrity_history: IntegrityEvent[];
}

/** Stable id from the file location (FNV-1a, deterministic). */
export function vaultId(path: string): string {
  const norm = path.replace(/\\/g, "/").toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return "v" + (h >>> 0).toString(16).padStart(8, "0");
}

/** The current known integrity from a vault's remembered history. */
export function lastIntegrity(e: VaultRegistryEntry): IntegrityState {
  const last = e.integrity_history[e.integrity_history.length - 1];
  return last ? last.result : "unknown";
}

/** Object → visual. The UI never chooses the visual; it is derived from truth. */
export function deriveVaultVisual(o: {
  seal_state: SealState;
  integrity_state: IntegrityState;
  encryption_state?: EncryptionState;
  hasFiles?: boolean;
}): { state: VaultState; tone: VaultTone } {
  if (o.integrity_state === "compromised") return { state: "broken", tone: "danger" };
  if (o.integrity_state === "verifying") return { state: "unlocking", tone: "neutral" };
  if (o.seal_state === "sealing" || o.encryption_state === "encrypting") return { state: "sealed", tone: "neutral" };
  if (o.seal_state === "opening") return { state: "unlocking", tone: "neutral" };
  if (o.seal_state === "open") return { state: "opened", tone: "neutral" };
  if (o.seal_state === "sealed") return { state: "sealed", tone: o.integrity_state === "intact" ? "safe" : "neutral" };
  return o.hasFiles ? { state: "filling", tone: "neutral" } : { state: "idle", tone: "neutral" };
}

/** A persisted (sealed) vault's visual, reflecting its remembered integrity. */
export function entryVisual(e: VaultRegistryEntry): { state: VaultState; tone: VaultTone } {
  return deriveVaultVisual({ seal_state: "sealed", integrity_state: lastIntegrity(e) });
}
