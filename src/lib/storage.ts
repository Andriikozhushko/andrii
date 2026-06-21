/** Lightweight persistence (WebView2 localStorage) for onboarding + recent archives. */

const ONBOARD_KEY = "andrii.onboarded";
const RECENTS_KEY = "andrii.recents";
const RECENTS_LIMIT = 20;

export function isOnboarded(): boolean {
  try { return localStorage.getItem(ONBOARD_KEY) === "1"; } catch { return false; }
}

export function setOnboarded(done: boolean): void {
  try {
    if (done) localStorage.setItem(ONBOARD_KEY, "1");
    else localStorage.removeItem(ONBOARD_KEY);
  } catch { /* ignore */ }
}

export interface RecentArchive {
  name: string;
  path: string;
  date: number; // epoch ms
  size: number; // bytes
}

export function getRecents(): RecentArchive[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as RecentArchive[]) : [];
  } catch {
    return [];
  }
}

export function addRecent(entry: RecentArchive): void {
  try {
    const list = getRecents().filter(r => r.path !== entry.path);
    list.unshift(entry);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, RECENTS_LIMIT)));
  } catch { /* ignore */ }
}

export function removeRecent(path: string): void {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(getRecents().filter(r => r.path !== path)));
  } catch { /* ignore */ }
}
