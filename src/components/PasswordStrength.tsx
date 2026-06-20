import { useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PasswordStrengthResult } from "../types";

interface PasswordStrengthProps {
  password: string;
  onResult?: (r: PasswordStrengthResult | null) => void;
}

const BARS = [
  { color: "bg-danger"   },
  { color: "bg-warning"  },
  { color: "bg-yellow-400" },
  { color: "bg-accent"   },
  { color: "bg-success"  },
];

const LABELS = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
const LABEL_COLORS = [
  "text-danger-text", "text-warning-text", "text-yellow-600",
  "text-accent",      "text-success-text",
];

function kdfDisplayTime(score: number, actual: string): { text: string; color: string } {
  if (score === 0) return { text: "Seconds to minutes", color: "text-danger-text" };
  if (score === 1) return { text: "Minutes to hours",   color: "text-warning-text" };
  return { text: actual, color: "text-accent" };
}

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

  const labelColor = LABEL_COLORS[result.score] ?? LABEL_COLORS[0];
  const kdf = kdfDisplayTime(result.score, result.estimated_crack_time);

  return (
    <div className="space-y-2.5 animate-fade-in">
      {/* strength bar */}
      <div className="flex items-center gap-2.5">
        <div className="flex gap-1 flex-1">
          {BARS.map((b, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300
                ${i <= result.score ? b.color : "bg-border"}`}
            />
          ))}
        </div>
        <span className={`text-[11px] font-semibold ${labelColor}`}>
          {LABELS[result.score]}
        </span>
      </div>

      {/* time estimates */}
      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between gap-4">
          <span className="text-text-muted">Without protection</span>
          <span className="font-mono text-danger-text">{result.gpu_crack_time}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-text-muted">With ANDRII KDF</span>
          <span className={`font-mono ${kdf.color}`}>{kdf.text}</span>
        </div>
      </div>

      {/* suggestion for weak passwords */}
      {result.score <= 1 && result.suggestions[0] && (
        <p className="text-[11px] text-warning-text leading-relaxed">{result.suggestions[0]}</p>
      )}
    </div>
  );
}
