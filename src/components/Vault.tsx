/**
 * ANDRII 03B — The Vault.
 *
 * The single central product object. Every screen (Create / Open / Verify) is
 * just this same object in a different state. It renders ONLY from its props —
 * no screen logic, deterministic (no time/random), so it is reusable & testable.
 *
 * Custom hand-drawn wooden chest illustration (raster). The same object is used
 * for every state; only the glow tone (and a shake on `broken`) changes — the
 * artwork itself is invariant, which is what makes it read as "the same thing".
 */

import chestSealed from "../assets/archive-box.png";
import chestOpen from "../assets/chest-open.png";
import crateParchment from "../assets/crate-parchment.png";
import sealBroken from "../assets/seal-broken.png";

export type VaultState =
  | "idle"        // empty open box — inviting
  | "filling"     // open, things gathered inside
  | "sealed"      // closed, wax applied — calm & secure
  | "unlocking"   // closed, seal under tension (no spinner)
  | "opened"      // open, contents revealed
  | "broken";     // cracked seal — compromised

export type VaultTone = "neutral" | "safe" | "danger";

const C = {
  WAX: "#B23A35", SAFE: "#3E7D5A", ACCENT: "#2E5E73",
};

/* Which artwork represents each state. */
const ART: Record<VaultState, string> = {
  idle: chestSealed,
  sealed: chestSealed,
  unlocking: chestSealed,
  filling: crateParchment,
  opened: chestOpen,
  broken: sealBroken,
};

export default function Vault({
  state,
  size = 200,
  tone = "neutral",
  src,
}: {
  state: VaultState;
  size?: number;
  tone?: VaultTone;
  /** Override the artwork for this state (e.g. a screen-specific illustration). */
  src?: string;
}) {
  const glowColor = state === "broken" ? C.WAX : tone === "safe" ? C.SAFE : C.ACCENT;
  const glowStrong = state === "sealed" || state === "unlocking" || tone === "safe" || tone === "danger";

  return (
    <div
      className={`relative ${state === "broken" ? "animate-shake" : ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`vault ${state}`}
    >
      {/* glow halo — calm, reinforces the seal's meaning */}
      <div
        className={`pointer-events-none absolute inset-3 blur-2xl transition-opacity duration-500 ${state === "unlocking" ? "animate-pulse" : ""}`}
        style={{
          background: `radial-gradient(circle at 50% 48%, ${glowColor}, transparent 70%)`,
          opacity: glowStrong ? 0.3 : 0.14,
          animationDuration: "2.4s",
        }}
      />

      <img
        src={src ?? ART[state]}
        alt=""
        draggable={false}
        className="relative h-full w-full object-contain select-none"
      />
    </div>
  );
}

/**
 * VaultScene — the standard page layout: the Vault is always center stage,
 * with only secondary caption text + affordances beneath it.
 */
export function VaultScene({
  state, tone, size = 188, title, subtitle, titleClass = "text-ink", children, footer,
}: {
  state: VaultState;
  tone?: VaultTone;
  size?: number;
  title?: string;
  subtitle?: React.ReactNode;
  titleClass?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="canvas">
      <div className="canvas-center px-10 gap-7">
        <Vault state={state} tone={tone} size={size} />
        {(title || subtitle) && (
          <div className="text-center space-y-2 animate-fade-in">
            {title && <h2 className={`font-serif text-[30px] font-semibold tracking-tight leading-tight ${titleClass}`}>{title}</h2>}
            {subtitle && <p className="text-[15px] text-ink-soft max-w-sm mx-auto leading-relaxed">{subtitle}</p>}
          </div>
        )}
        {children && <div className="flex flex-col items-center gap-4 w-full max-w-sm">{children}</div>}
      </div>
      {footer}
    </div>
  );
}
