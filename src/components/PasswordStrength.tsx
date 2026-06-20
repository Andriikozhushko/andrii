import { useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PasswordStrengthResult } from "../types";
import { CheckCircle2, Circle, Zap, Shield } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
  onResult?: (result: PasswordStrengthResult | null) => void;
}

const SCORE_CONFIG = [
  { label: "Very Weak", barColor: "bg-danger",    textColor: "text-danger-text"  },
  { label: "Weak",      barColor: "bg-warning",   textColor: "text-warning-text" },
  { label: "Fair",      barColor: "bg-yellow-500", textColor: "text-yellow-600"   },
  { label: "Strong",    barColor: "bg-success",    textColor: "text-success-text" },
  { label: "Very Strong", barColor: "bg-teal-500", textColor: "text-teal-600"     },
];

function withKdfLabel(result: PasswordStrengthResult): { text: string; isWeak: boolean } {
  const isWeak = result.score <= 1;
  if (isWeak) return { text: "Still not recommended", isWeak: true };
  return { text: result.estimated_crack_time, isWeak: false };
}

export default function PasswordStrength({ password, onResult }: PasswordStrengthProps) {
  const [result, setResult] = useState<PasswordStrengthResult | null>(null);

  const analyze = useCallback(async (pwd: string) => {
    if (!pwd) {
      setResult(null);
      onResult?.(null);
      return;
    }
    try {
      const res = await invoke<PasswordStrengthResult>("analyze_password_strength", { password: pwd });
      setResult(res);
      onResult?.(res);
    } catch {
      // silently fail
    }
  }, [onResult]);

  useEffect(() => {
    const timer = setTimeout(() => analyze(password), 80);
    return () => clearTimeout(timer);
  }, [password, analyze]);

  if (!password || !result) return null;

  const cfg = SCORE_CONFIG[result.score] ?? SCORE_CONFIG[0];
  const kdf = withKdfLabel(result);
  const isWeak = result.score <= 1;

  const requirements = [
    { ok: result.has_lowercase,  label: "Lowercase" },
    { ok: result.has_uppercase,  label: "Uppercase" },
    { ok: result.has_digits,     label: "Numbers"   },
    { ok: result.has_symbols,    label: "Symbols"   },
    { ok: result.length >= 12,   label: "12+ chars" },
  ];

  return (
    <div className="mt-2.5 space-y-2.5 animate-fade-in">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${cfg.textColor} w-20 shrink-0`}>{cfg.label}</span>
        <div className="flex gap-0.5 flex-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= result.score ? cfg.barColor : "bg-border"}`}
            />
          ))}
        </div>
      </div>

      {/* Crack time estimates */}
      <div className="rounded-md border border-border overflow-hidden text-2xs">
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border">
          <Zap size={11} className="text-danger shrink-0" />
          <span className="text-text-muted flex-1">Without ANDRII protection</span>
          <span className="font-mono font-medium text-danger-text">{result.gpu_crack_time}</span>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1.5">
          <Shield size={11} className="text-success shrink-0" />
          <span className="text-text-muted flex-1">With ANDRII KDF</span>
          <span className={`font-mono font-medium ${kdf.isWeak ? "text-warning-text" : "text-success-text"}`}>
            {kdf.text}
          </span>
        </div>
      </div>

      {/* Recommendation for weak passwords */}
      {isWeak && result.suggestions.length > 0 && (
        <p className="text-2xs text-warning-text leading-relaxed">
          {result.suggestions[0]}
        </p>
      )}

      {/* Requirements */}
      <div className="flex gap-x-4 gap-y-0.5 flex-wrap">
        {requirements.map(({ ok, label }) => (
          <div key={label} className="flex items-center gap-1">
            {ok
              ? <CheckCircle2 size={10} className="text-success shrink-0" />
              : <Circle size={10} className="text-text-muted shrink-0" />}
            <span className={`text-2xs ${ok ? "text-text-secondary" : "text-text-muted"}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
