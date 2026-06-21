/**
 * ANDRII 03B — The Vault.
 *
 * The single central product object. Every screen (Create / Open / Verify) is
 * just this same object in a different state. It renders ONLY from its props —
 * no screen logic, deterministic (no time/random), so it is reusable & testable.
 *
 * Hand-drawn archive box closed by a wax seal. Only the lid angle, the wax
 * (absent / intact / cracked), the contents and the glow change between states;
 * the silhouette, line weight and palette are invariant — that is what makes it
 * read as "the same thing transforming".
 */

export type VaultState =
  | "idle"        // empty open box — inviting
  | "filling"     // open, things gathered inside
  | "sealed"      // closed, wax applied — calm & secure
  | "unlocking"   // closed, seal under tension (no spinner)
  | "opened"      // open, contents revealed
  | "broken";     // cracked seal — compromised

export type VaultTone = "neutral" | "safe" | "danger";

const C = {
  INK: "#2A2622", PARCH: "#F3ECDD", PAPER: "#FBF7EE",
  WAX: "#B23A35", WAX_DEEP: "#8E2B27", SAFE: "#3E7D5A", ACCENT: "#2E5E73",
};

const ink = { stroke: C.INK, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export default function Vault({
  state,
  size = 200,
  tone = "neutral",
}: {
  state: VaultState;
  size?: number;
  tone?: VaultTone;
}) {
  const open = state === "idle" || state === "filling" || state === "opened";
  const hasContents = state === "filling" || state === "opened";
  const hasWax = state === "sealed" || state === "unlocking" || state === "broken";
  const cracked = state === "broken";

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

      <svg viewBox="0 0 200 200" className="relative h-full w-full" fill="none">
        <ellipse cx="100" cy="177" rx="62" ry="9" fill={C.INK} opacity="0.12" />

        {/* contents (paper slips) — present while open & filling/opened */}
        <g style={{ transition: "opacity .42s ease, transform .42s ease", opacity: hasContents ? 1 : 0, transform: hasContents ? "translateY(0)" : "translateY(10px)" }}>
          <path d="M74 92 q-3 -34 8 -42 q14 -6 17 6 l3 36" fill={C.PAPER} {...ink} />
          <path d="M101 90 q1 -40 13 -44 q15 -3 14 12 l-2 34" fill={C.PAPER} {...ink} />
          <line x1="82" y1="64" x2="94" y2="62" {...ink} strokeWidth={2} />
          <line x1="109" y1="60" x2="121" y2="60" {...ink} strokeWidth={2} />
        </g>

        {/* box body */}
        <path d="M44 96 q56 -10 112 0 l-4 64 q-52 9 -104 0 Z" fill={C.PAPER} {...ink} />
        <path d="M47 124 q53 7 106 0" fill="none" {...ink} />
        <path d="M48 138 q52 7 104 0" fill="none" {...ink} strokeWidth={2} opacity="0.6" />
        <rect x="92" y="118" width="16" height="20" rx="4" fill={C.PARCH} {...ink} strokeWidth={2.5} />

        {/* lid — rotates between open (leaning back) and closed (flat) */}
        <g style={{ transformBox: "view-box", transformOrigin: "46px 88px", transform: open ? "rotate(-25deg)" : "rotate(0deg)", transition: "transform .46s cubic-bezier(.16,1,.3,1)" }}>
          <path d="M40 96 q60 -12 120 0 l-4 -16 q-56 -10 -112 0 Z" fill={C.PARCH} {...ink} />
          <path d="M52 84 q48 -8 96 0" fill="none" {...ink} strokeWidth={2} opacity="0.5" />
        </g>

        {/* wax seal on the box front (intact / cracked) — the emotional signal */}
        <g
          style={{ transition: "opacity .42s ease", opacity: hasWax ? 1 : 0 }}
          transform="translate(100 131)"
          className={state === "sealed" ? "animate-stamp-in" : ""}
        >
          {cracked ? (
            <>
              {/* left half */}
              <path d="M0 -15 A15 15 0 0 0 0 15 L4 8 -2 2 4 -5 -1 -11 Z"
                fill={C.WAX} stroke={C.WAX_DEEP} strokeWidth="2.5" strokeLinejoin="round" transform="translate(-3 0) rotate(-7)" />
              {/* right half */}
              <path d="M0 -15 A15 15 0 0 1 0 15 L-4 8 2 2 -4 -5 1 -11 Z"
                fill={C.WAX} stroke={C.WAX_DEEP} strokeWidth="2.5" strokeLinejoin="round" transform="translate(4 1) rotate(8)" />
            </>
          ) : (
            <>
              <circle r="15" fill={C.WAX} stroke={C.WAX_DEEP} strokeWidth="3" />
              <path d="M-15 0 a15 15 0 0 1 30 0" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="3" fill="none" />
              {/* keyhole — glows during unlocking */}
              <circle cx="0" cy="-4" r="4.5" fill="none" stroke={C.WAX_DEEP} strokeWidth="2.5"
                className={state === "unlocking" ? "animate-pulse" : ""} />
              <path d="M0 0 l-3 9 h6 Z" fill={C.WAX_DEEP} />
            </>
          )}
        </g>
      </svg>
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
