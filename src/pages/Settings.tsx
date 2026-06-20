import { useState, useEffect } from "react";
import { Sun, Moon, Monitor, Shield, Info, CheckCircle2 } from "lucide-react";
import type { Theme, CompressionLevel } from "../types";

interface SettingsProps {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
}

export default function Settings({ theme, onThemeChange }: SettingsProps) {
  const [compression, setCompression] = useState<CompressionLevel>(() => {
    return (localStorage.getItem("andrii-default-compression") as CompressionLevel | null) ?? "Balanced";
  });

  useEffect(() => {
    localStorage.setItem("andrii-default-compression", compression);
  }, [compression]);

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-border bg-bg-surface shrink-0">
        <h1 className="text-base font-semibold text-text-primary">Settings</h1>
        <p className="text-2xs text-text-muted mt-0.5">Application preferences</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-6 space-y-1">

          {/* Appearance */}
          <p className="section-heading">Appearance</p>
          <div className="settings-section">
            <div className="settings-row">
              <div>
                <p className="text-xs font-medium text-text-primary">Theme</p>
                <p className="text-2xs text-text-muted mt-0.5">Controls app color scheme</p>
              </div>
              <div className="flex gap-1 bg-bg-base border border-border rounded-md p-0.5">
                <ThemeButton
                  label="System"
                  icon={<Monitor size={12} />}
                  active={theme === "system"}
                  onClick={() => onThemeChange("system")}
                />
                <ThemeButton
                  label="Light"
                  icon={<Sun size={12} />}
                  active={theme === "light"}
                  onClick={() => onThemeChange("light")}
                />
                <ThemeButton
                  label="Dark"
                  icon={<Moon size={12} />}
                  active={theme === "dark"}
                  onClick={() => onThemeChange("dark")}
                />
              </div>
            </div>
          </div>

          {/* Compression */}
          <p className="section-heading mt-6">Archive Defaults</p>
          <div className="settings-section">
            <div className="settings-row items-start">
              <div>
                <p className="text-xs font-medium text-text-primary">Default Compression</p>
                <p className="text-2xs text-text-muted mt-0.5">Used when creating a new archive</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {(["Fast", "Balanced", "Maximum"] as CompressionLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setCompression(level)}
                    className={`px-3 py-1.5 rounded-md text-xs border transition-colors duration-100 ${
                      compression === level
                        ? "border-accent bg-accent-muted text-accent font-medium"
                        : "border-border bg-bg-surface text-text-secondary hover:bg-bg-elevated"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Security */}
          <p className="section-heading mt-6">Security</p>
          <div className="settings-section">
            <div className="settings-row">
              <div className="flex items-start gap-2.5">
                <Shield size={14} className="text-success mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-text-primary">Encryption</p>
                  <p className="text-2xs text-text-muted mt-0.5">XChaCha20-Poly1305 with Argon2id key derivation</p>
                </div>
              </div>
              <span className="badge-neutral text-2xs px-2 py-0.5 rounded-full bg-bg-elevated border border-border text-text-muted shrink-0">Built-in</span>
            </div>

            <div className="settings-row border-t border-border">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={14} className="text-success mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-text-primary">File Association</p>
                  <p className="text-2xs text-text-muted mt-0.5">Double-click .andrii files to open them</p>
                </div>
              </div>
              <span className="badge-neutral text-2xs px-2 py-0.5 rounded-full bg-success-muted border border-success/20 text-success-text shrink-0">Registered</span>
            </div>
          </div>

          {/* About */}
          <p className="section-heading mt-6">About</p>
          <div className="settings-section">
            <div className="settings-row">
              <div className="flex items-start gap-2.5">
                <Info size={14} className="text-text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-text-primary">ANDRII</p>
                  <p className="text-2xs text-text-muted mt-0.5">Secure archive utility</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-text-secondary font-medium">v0.1.0</p>
                <p className="text-2xs text-text-muted">Andrii Kozhushko</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function ThemeButton({
  label, icon, active, onClick,
}: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-colors duration-100 ${
        active
          ? "bg-bg-surface shadow-sm text-text-primary font-medium border border-border"
          : "text-text-muted hover:text-text-secondary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
