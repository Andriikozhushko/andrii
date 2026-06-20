import type { ReactNode } from "react";
import type { Screen } from "../types";
import { Archive, FolderOpen, ShieldCheck, Settings, Lock } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  screen: Screen;
  onNavigate: (s: Screen) => void;
}

interface NavItem {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  screen: Screen;
}

const PRIMARY_NAV: NavItem[] = [
  { icon: Archive, label: "New Archive", screen: "create" },
  { icon: FolderOpen, label: "Open Archive", screen: "open" },
  { icon: ShieldCheck, label: "Verify", screen: "verify" },
];

export default function Layout({ children, screen, onNavigate }: LayoutProps) {
  return (
    <div className="flex h-screen bg-bg-base overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-[176px] shrink-0 flex flex-col bg-bg-surface border-r border-border">
        {/* App identity */}
        <div className="px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent/10 flex items-center justify-center shrink-0">
              <ShieldCheck size={13} className="text-accent" />
            </div>
            <span className="text-sm font-semibold text-text-primary tracking-wide">ANDRII</span>
          </div>
        </div>

        {/* Primary navigation */}
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <SidebarItem
              key={item.screen}
              icon={item.icon}
              label={item.label}
              active={screen === item.screen}
              onClick={() => onNavigate(item.screen)}
            />
          ))}
        </nav>

        {/* Settings + version */}
        <div className="border-t border-border px-2 py-2 space-y-0.5">
          <SidebarItem
            icon={Settings}
            label="Settings"
            active={screen === "settings"}
            onClick={() => onNavigate("settings")}
          />
        </div>
        <div className="px-4 py-2.5 border-t border-border flex items-center gap-1.5">
          <Lock size={9} className="text-success shrink-0" />
          <span className="text-2xs text-text-muted">Secure · v0.1.0</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-bg-base">
        <div className="h-full animate-fade-in">{children}</div>
      </main>
    </div>
  );
}

function SidebarItem({
  icon: Icon, label, active, onClick,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`nav-item ${active ? "nav-item-active" : ""}`}
    >
      <Icon size={14} className={active ? "text-accent" : "text-text-muted"} />
      <span className={active ? "text-accent" : ""}>{label}</span>
    </button>
  );
}
