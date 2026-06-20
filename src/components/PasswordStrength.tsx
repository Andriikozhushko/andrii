import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PasswordStrengthResult } from "../types";
import { CheckCircle2, Circle, Zap, Shield } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
  onResult?: (result: PasswordStrengthResult | null) => void;
}

const SCORE_CONFIG = [
  { label: "Very Weak", color: "bg-danger", textColor: "text-danger-text" },
  { label: "Weak", color: "bg-warning", textColor: "text-warning-text" },
  { label: "Fair", color: "bg-yellow-500", textColor: "text-yellow-300" },
  { label: "Strong", color: "bg-success", textColor: "text-success-text" },
  { label: "Very Strong", color: "bg-teal-500", textColor: "text-teal-300" },
];

export default function PasswordStrength({ password, onResult }: PasswordStrengthProps) {
  const [result, setResult] = useState<PasswordStrengthResult | null>(null);

  const analyze = useCallback(async (pwd: string) => {
    if (!pwd) {
      setResult(null);
      onResult?.(null);
      return;
    }
    try {
      const res = await invoke<PasswordStrengthResult>("analyze_password_strength", {
        password: pwd,
      });
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

  const config = SCORE_CONFIG[result.score] ?? SCORE_CONFIG[0];
  const filledBars = result.score + 1;

  const requirements = [
    { ok: result.has_lowercase, label: "Lowercase letters" },
    { ok: result.has_uppercase, label: "Uppercase letters" },
    { ok: result.has_digits, label: "Numbers" },
    { ok: result.has_symbols, label: "Special characters" },
    { ok: result.length >= 12, label: "12+ characters" },
  ];

  return (
    <div className="mt-3 space-y-3 animate-fade-in">
      {/* Strength label + bars */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold ${config.textColor} min-w-[72px]`}>
          {config.label}
        </span>
        <div className="flex gap-1 flex-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < filledBars ? config.color : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Dual crack time estimate */}
      <div className="rounded-lg bg-bg-base border border-border/60 overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 py-2 border-b border-border/40">
          <Zap size={12} className="text-danger-text shrink-0" />
          <span className="text-2xs text-text-muted flex-1">Without protection (GPU)</span>
          <span className="text-2xs font-medium font-mono text-danger-text">
            {result.gpu_crack_time}
          </span>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-2">
          <Shield size={12} className="text-success shrink-0" />
          <span className="text-2xs text-text-muted flex-1">With ANDRII protection</span>
          <span className={`text-2xs font-medium font-mono ${config.textColor}`}>
            {result.estimated_crack_time}
          </span>
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="grid grid-cols-2 gap-1">
        {requirements.map(({ ok, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            {ok ? (
              <CheckCircle2 size={11} className="text-success shrink-0" />
            ) : (
              <Circle size={11} className="text-text-muted shrink-0" />
            )}
            <span className={`text-2xs ${ok ? "text-text-secondary" : "text-text-muted"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
