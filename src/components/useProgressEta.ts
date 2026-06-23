import { useEffect, useRef, useState } from "react";
import type { ProgressEvent } from "../types";

export interface EtaResult {
  /** Conservative seconds remaining, or null while calibrating. */
  etaSeconds: number | null;
  /** Level: 0 = normal, 1 = "still working…", 2 = "large files…" */
  stuck: number;
  /** Bytes per second (running average, 0 until 2+ seconds of data). */
  throughputBps: number;
}

/**
 * Derives an honest, conservative ETA + stuck detection from the progress
 * event stream. The caller pipes `archive-progress` events into the hook.
 */
export default function useProgressEta(
  progress: ProgressEvent | null,
  active: boolean,
): EtaResult {
  const [result, setResult] = useState<EtaResult>({
    etaSeconds: null,
    stuck: 0,
    throughputBps: 0,
  });

  const buf = useRef<Array<{ ms: number; bytes: number }>>([]);
  const lastMs = useRef(0);
  const ticker  = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!active) {
      setResult({ etaSeconds: null, stuck: 0, throughputBps: 0 });
      buf.current = [];
      lastMs.current = 0;
      return;
    }

    if (!progress) return;

    const now = Date.now();
    lastMs.current = now;
    const b = buf.current;
    b.push({ ms: now, bytes: progress.bytes_done });
    if (b.length > 6) b.shift();

    let etaSeconds: number | null = null;
    let throughputBps = 0;
    if (b.length >= 3 && progress.bytes_total > 0) {
      const first = b[0];
      const last = b[b.length - 1];
      const dt = (last.ms - first.ms) / 1000;
      const db = last.bytes - first.bytes;
      if (dt >= 2 && db > 0) {
        throughputBps = db / dt;
        const remaining = progress.bytes_total - last.bytes;
        etaSeconds = (remaining / throughputBps) * 1.2; // conservative 1.2× buffer
      }
    }

    setResult(() => ({
      etaSeconds,
      stuck: 0, // reset on fresh data
      throughputBps,
    }));
  }, [progress, active]);

  // Stuck-detection heartbeat.
  useEffect(() => {
    if (!active) { if (ticker.current) clearInterval(ticker.current); return; }
    ticker.current = setInterval(() => {
      if (!lastMs.current) return;
      const since = (Date.now() - lastMs.current) / 1000;
      if (since > 6) {
        setResult(prev => ({ ...prev, stuck: 2 }));
      } else if (since > 2.5) {
        setResult(prev => ({ ...prev, stuck: 1 }));
      }
    }, 1000);
    return () => { if (ticker.current) clearInterval(ticker.current); };
  }, [active]);

  return result;
}

/** Format seconds as a human-scale duration ("~2m 14s", or null for early phase). */
export function formatEta(s: number | null): string | null {
  if (s === null || s <= 0) return null;
  if (s < 3) return "a few seconds";
  if (s < 60) return `~${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  if (m < 3) {
    // Round to nearest 5s for small durations.
    const r = Math.round(s / 5) * 5;
    const mm = Math.floor(r / 60);
    const ss = r % 60;
    return ss === 0 ? `~${mm}m` : `~${mm}m ${String(ss).padStart(2, "0")}s`;
  }
  return `~${m}m ${String(sec).padStart(2, "0")}s`;
}
