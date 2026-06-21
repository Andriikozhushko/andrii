import { useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PasswordStrengthResult } from "../types";

interface PasswordStrengthProps {
  password: string;
  onResult?: (r: PasswordStrengthResult | null) => void;
}

const LABELS = ["Very weak", "Weak", "Fair", "Strong", "Excellent"];
// ink-on-parchment tones: wax red → amber → violet → green
const SEG = ["bg-wax", "bg-amber-600", "bg-amber-500", "bg-accent", "bg-safe"];
const TEXT = ["text-wax", "text-amber-700", "text-amber-700", "text-accent", "text-safe"];

const RECOMMENDATION =
  "Use 12+ characters with unrelated words, numbers and symbols, or use a password manager.";

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

  const score = Math.max(0, Math.min(4, result.score));
  const strong = score >= 3;

  return (
    <div className="space-y-2 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex gap-1 flex-1">
          {SEG.map((c, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= score ? c : "bg-border"}`}
            />
          ))}
        </div>
        <span className={`text-[12px] font-semibold ${TEXT[score]}`}>{LABELS[score]}</span>
      </div>

      <p className="text-[12px] text-ink-soft leading-relaxed">
        {strong
          ? <>Strong key — breaking it would take <span className="font-medium">{result.estimated_crack_time.toLowerCase()}</span>.</>
          : RECOMMENDATION}
      </p>
    </div>
  );
}
