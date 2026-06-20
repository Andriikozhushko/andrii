import { useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PasswordStrengthResult } from "../types";

interface PasswordStrengthProps {
  password: string;
  onResult?: (r: PasswordStrengthResult | null) => void;
}

const BARS = [
  { color: "bg-danger"  },
  { color: "bg-warning" },
  { color: "bg-yellow-500" },
  { color: "bg-accent"  },
  { color: "bg-teal-400" },
];

const LABELS = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
const LABEL_COLORS = [
  "text-danger-text", "text-warning-text", "text-yellow-500",
  "text-accent",      "text-teal-400",
];

export default function PasswordStrength({ password, onResult }: PasswordStrengthProps) {
  const [result, setResult] = useState<PasswordStrengthResult | null>(null);

  const analyze = useCallback(async (pwd: string) => {
    if (!pwd) { setResult(null); onResult?.(null); return; }
    try {
      const r = await invoke<PasswordStrengthResult>("analyze_password_strength", { password: pwd });
      setResult(r);
      onResult?.(r);
    } catch { /* ignore */ }
  }, [onResult]);

  useEffect(() => {
    const t = setTimeout(() => analyze(password), 80);
    return () => clearTimeout(t);
  }, [password, analyze]);

  if (!password || !result) return null;

  const isWeak = result.score <= 1;
  const labelColor = LABEL_COLORS[result.score] ?? LABEL_COLORS[0];

  return (
    <div className="mt-3 space-y-2.5 animate-fade-in">
      {/* strength bar */}
      <div className="flex items-center gap-2.5">
        <div className="flex gap-0.5 flex-1">
          {BARS.map((b, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${i <= result.score ? b.color : "bg-border"}`}
            />
          ))}
        </div>
        <span className={`text-2xs font-medium tabular-nums ${labelColor}`}>{LABELS[result.score]}</span>
      </div>

      {/* time estimates */}
      <div className="space-y-0.5 text-2xs">
        <div className="flex justify-between">
          <span className="text-text-muted">Without protection</span>
          <span className="font-mono text-danger-text">{result.gpu_crack_time}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">With ANDRII KDF</span>
          <span className={`font-mono ${isWeak ? "text-warning-text" : "text-accent"}`}>
            {isWeak ? "Still not recommended" : result.estimated_crack_time}
          </span>
        </div>
      </div>

      {/* suggestion */}
      {isWeak && result.suggestions[0] && (
        <p className="text-2xs text-warning-text leading-relaxed">{result.suggestions[0]}</p>
      )}
    </div>
  );
}
