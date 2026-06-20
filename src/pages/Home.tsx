import type { Screen } from "../types";
import { Archive, FolderOpen, ShieldCheck, Lock, Key, Hash } from "lucide-react";

interface HomeProps {
  onNavigate: (s: Screen) => void;
}

const features = [
  { icon: Lock, label: "XChaCha20-Poly1305", desc: "Authenticated encryption" },
  { icon: Key, label: "Argon2id", desc: "Memory-hard key derivation" },
  { icon: Hash, label: "BLAKE3", desc: "Cryptographic integrity" },
];

export default function Home({ onNavigate }: HomeProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-8 py-12">
      {/* Hero */}
      <div className="text-center mb-16 animate-slide-up">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-glow">
            <ShieldCheck size={40} className="text-accent" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-text-primary tracking-tight mb-3">
          ANDRII
        </h1>
        <p className="text-text-secondary text-base max-w-md mx-auto leading-relaxed">
          Professional secure archive application with military-grade encryption,
          metadata protection, and integrity verification.
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-3 gap-5 w-full max-w-3xl mb-14 animate-slide-up" style={{ animationDelay: "0.05s" }}>
        <ActionCard
          icon={Archive}
          title="Create Archive"
          description="Compress and encrypt files into a secure .andrii archive"
          accent="accent"
          onClick={() => onNavigate("create")}
          primary
        />
        <ActionCard
          icon={FolderOpen}
          title="Open Archive"
          description="Decrypt and extract files from an existing .andrii archive"
          accent="text-text-secondary"
          onClick={() => onNavigate("open")}
        />
        <ActionCard
          icon={ShieldCheck}
          title="Verify Archive"
          description="Check integrity and authenticity of an .andrii archive"
          accent="text-text-secondary"
          onClick={() => onNavigate("verify")}
        />
      </div>

      {/* Security Features */}
      <div className="w-full max-w-3xl animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <div className="flex items-center gap-4 mb-4">
          <div className="h-px flex-1 bg-border/60" />
          <span className="text-2xs font-medium text-text-muted uppercase tracking-widest">
            Security Profile
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {features.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-surface border border-border/60"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/8 border border-accent/12 flex items-center justify-center shrink-0">
                <Icon size={14} className="text-accent/80" />
              </div>
              <div>
                <div className="text-xs font-medium text-text-primary leading-tight">
                  {label}
                </div>
                <div className="text-2xs text-text-muted mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ActionCardProps {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  description: string;
  accent: string;
  onClick: () => void;
  primary?: boolean;
}

function ActionCard({ icon: Icon, title, description, onClick, primary }: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group flex flex-col items-start p-6 rounded-xl border text-left
        transition-all duration-200 cursor-pointer
        ${primary
          ? "bg-accent/8 border-accent/25 hover:bg-accent/14 hover:border-accent/40 hover:shadow-glow"
          : "bg-bg-surface border-border hover:bg-bg-elevated hover:border-border-strong"
        }
      `}
    >
      <div className={`
        w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-colors
        ${primary
          ? "bg-accent/15 border border-accent/25 group-hover:bg-accent/20"
          : "bg-bg-elevated border border-border group-hover:border-border-strong"
        }
      `}>
        <Icon
          size={20}
          className={primary ? "text-accent" : "text-text-secondary group-hover:text-text-primary transition-colors"}
        />
      </div>
      <h3 className={`text-sm font-semibold mb-1.5 ${primary ? "text-accent" : "text-text-primary"}`}>
        {title}
      </h3>
      <p className="text-2xs text-text-muted leading-relaxed">{description}</p>
    </button>
  );
}
