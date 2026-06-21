/**
 * ANDRII 04C — VaultStore (03D persistence in real code).
 *
 * The app's local memory of vaults. Persists across sessions (WebView2
 * localStorage). Stores only non-sensitive metadata + lifecycle timeline —
 * never passwords, keys, or contents. The .andrii file is the real artifact;
 * this is recognition memory. Write-through: every event persists immediately.
 */
import { type VaultRegistryEntry, vaultId } from "../vault/object";

export type { VaultRegistryEntry } from "../vault/object";

const ONBOARD_KEY = "andrii.onboarded";
const VAULTS_KEY = "andrii.vaults";
const LEGACY_RECENTS = "andrii.recents";
const LIMIT = 50;

/* ── Onboarding flag ──────────────────────────────────────────────────────── */
export function isOnboarded(): boolean {
  try { return localStorage.getItem(ONBOARD_KEY) === "1"; } catch { return false; }
}
export function setOnboarded(done: boolean): void {
  try {
    if (done) localStorage.setItem(ONBOARD_KEY, "1");
    else localStorage.removeItem(ONBOARD_KEY);
  } catch { /* ignore */ }
}

/* ── Registry ─────────────────────────────────────────────────────────────── */
function readRaw(): VaultRegistryEntry[] {
  try {
    const raw = localStorage.getItem(VAULTS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr as VaultRegistryEntry[];
    }
  } catch { /* ignore */ }
  return [];
}

function write(list: VaultRegistryEntry[]): void {
  try { localStorage.setItem(VAULTS_KEY, JSON.stringify(list.slice(0, LIMIT))); } catch { /* ignore */ }
}

/** One-time migration of the 02A recents into the vault registry. */
function migrateLegacy(): void {
  try {
    if (localStorage.getItem(VAULTS_KEY) != null) return;
    const raw = localStorage.getItem(LEGACY_RECENTS);
    if (!raw) return;
    const old = JSON.parse(raw) as Array<{ name: string; path: string; date: number; size: number }>;
    if (!Array.isArray(old)) return;
    const migrated: VaultRegistryEntry[] = old.map(r => ({
      id: vaultId(r.path),
      path: r.path,
      name: r.name,
      fileCount: 0,
      sealedSize: r.size ?? 0,
      formatVersion: null,
      createdAt: r.date ?? null,
      lastOpenedAt: r.date ?? null,
      lastVerifiedAt: null,
      integrity_history: [],
    }));
    write(migrated);
    localStorage.removeItem(LEGACY_RECENTS);
  } catch { /* ignore */ }
}

/** All known vaults, most-recently-touched first. */
export function getVaults(): VaultRegistryEntry[] {
  migrateLegacy();
  const list = readRaw();
  return [...list].sort((a, b) =>
    (b.lastOpenedAt ?? b.createdAt ?? 0) - (a.lastOpenedAt ?? a.createdAt ?? 0));
}

function upsert(path: string, mutate: (e: VaultRegistryEntry) => void): void {
  const id = vaultId(path);
  const list = readRaw();
  let entry = list.find(e => e.id === id);
  if (!entry) {
    entry = {
      id, path,
      name: path.replace(/\\/g, "/").split("/").pop() ?? path,
      fileCount: 0, sealedSize: 0, formatVersion: null,
      createdAt: null, lastOpenedAt: null, lastVerifiedAt: null,
      integrity_history: [],
    };
    list.unshift(entry);
  }
  entry.path = path;
  mutate(entry);
  write(list);
}

export function recordCreated(v: {
  path: string; name: string; fileCount: number; sealedSize: number; formatVersion?: number | null;
}): void {
  upsert(v.path, e => {
    e.name = v.name;
    e.fileCount = v.fileCount;
    e.sealedSize = v.sealedSize;
    e.formatVersion = v.formatVersion ?? e.formatVersion;
    e.createdAt = Date.now();
    e.lastOpenedAt = Date.now();
  });
}

export function recordOpened(path: string, meta?: { name?: string; fileCount?: number; sealedSize?: number; formatVersion?: number | null }): void {
  upsert(path, e => {
    e.lastOpenedAt = Date.now();
    if (meta?.name) e.name = meta.name;
    if (meta?.fileCount != null) e.fileCount = meta.fileCount;
    if (meta?.sealedSize != null) e.sealedSize = meta.sealedSize;
    if (meta?.formatVersion != null) e.formatVersion = meta.formatVersion;
  });
}

export function recordVerified(path: string, intact: boolean): void {
  upsert(path, e => {
    e.lastVerifiedAt = Date.now();
    e.integrity_history.push({ at: Date.now(), result: intact ? "intact" : "compromised" });
    if (e.integrity_history.length > 20) e.integrity_history = e.integrity_history.slice(-20);
  });
}

export function removeVault(path: string): void {
  const id = vaultId(path);
  write(readRaw().filter(e => e.id !== id));
}
