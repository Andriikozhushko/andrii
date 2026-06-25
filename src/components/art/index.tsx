/**
 * ANDRII 01F — hand-drawn ink illustration primitives.
 *
 * Original inline SVG. Black-ink outlines on parchment, wax-red seals, muted
 * violet accents. Deliberately a little irregular / handcrafted. These replace
 * all generic Lucide shields / folders / locks / checks in the main UI.
 */

const INK = "#2A2622";
const PARCH = "#F3ECDD";
const PAPER = "#FBF7EE";
const WAX = "#B23A35";
const WAX_DEEP = "#8E2B27";
const ACCENT = "#9C4A2A";
const SAFE = "#3E7D5A";

type ArtProps = { size?: number; className?: string };

const strokeProps = {
  stroke: INK,
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* ── Archive box / chest ──────────────────────────────────────────────────── */
export function ArchiveBox({
  size = 188,
  variant = "open",
  className = "",
}: ArtProps & { variant?: "open" | "sealed" }) {
  const sealed = variant === "sealed";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className} fill="none">
      {/* ground shadow */}
      <ellipse cx="100" cy="176" rx="62" ry="9" fill={INK} opacity="0.12" />

      {/* papers peeking out (open only) */}
      {!sealed && (
        <g>
          <path d="M74 92 q-3 -34 8 -42 q14 -6 17 6 l3 36" fill={PAPER} {...strokeProps} />
          <path d="M101 90 q1 -40 13 -44 q15 -3 14 12 l-2 34" fill={PAPER} {...strokeProps} />
          <line x1="82" y1="64" x2="94" y2="62" {...strokeProps} strokeWidth={2} />
          <line x1="109" y1="60" x2="121" y2="60" {...strokeProps} strokeWidth={2} />
        </g>
      )}

      {/* box body */}
      <path
        d="M44 96 q56 -10 112 0 l-4 64 q-52 9 -104 0 Z"
        fill={PAPER}
        {...strokeProps}
      />
      {/* front band */}
      <path d="M47 124 q53 7 106 0" fill="none" {...strokeProps} />
      <path d="M48 138 q52 7 104 0" fill="none" {...strokeProps} strokeWidth={2} opacity="0.7" />

      {/* lid */}
      {sealed ? (
        <>
          <path d="M40 96 q60 -12 120 0 l-4 -16 q-56 -10 -112 0 Z" fill={PARCH} {...strokeProps} />
          {/* wax seal on the lid */}
          <g transform="translate(100 132)">
            <circle r="17" fill={WAX} stroke={WAX_DEEP} strokeWidth={3} />
            <path d="M-17 0 a17 17 0 0 1 34 0" stroke="#ffffff" strokeOpacity="0.25" strokeWidth={3} fill="none" />
            <path d="M0 -7 v7 m0 0 l-4 7 h8 Z" fill={PARCH} stroke={WAX_DEEP} strokeWidth={2} strokeLinejoin="round" />
          </g>
        </>
      ) : (
        // open lid, hinged up-left
        <g transform="rotate(-26 46 84)">
          <path d="M40 92 q60 -12 120 0 l-3 -18 q-57 -11 -114 0 Z" fill={PARCH} {...strokeProps} />
          <path d="M52 80 q48 -8 96 0" fill="none" {...strokeProps} strokeWidth={2} opacity="0.6" />
        </g>
      )}

      {/* clasp */}
      <rect x="92" y="118" width="16" height="20" rx="4" fill={PARCH} {...strokeProps} strokeWidth={2.5} />
    </svg>
  );
}

/* ── Wax seal (intact) ────────────────────────────────────────────────────── */
export function WaxSeal({ size = 168, className = "", stamped = true }: ArtProps & { stamped?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className} fill="none">
      <ellipse cx="100" cy="170" rx="52" ry="8" fill={INK} opacity="0.1" />
      {/* ribbon tails */}
      <path d="M72 120 l-22 56 28 -16 12 18 16 -54" fill={WAX} stroke={WAX_DEEP} strokeWidth={3} strokeLinejoin="round" />
      {/* wax blob with drips */}
      <path
        d="M100 38
           q40 0 48 38 q6 30 -14 48 q-12 12 -34 12 q-26 0 -40 -16
           q-16 -18 -10 -44 q8 -38 50 -38 Z"
        fill={WAX}
        stroke={WAX_DEEP}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      {/* sheen */}
      <path d="M74 64 q18 -16 44 -6" stroke="#ffffff" strokeOpacity="0.3" strokeWidth={4} fill="none" strokeLinecap="round" />
      {/* embossed monogram A + keyhole */}
      <g opacity={stamped ? 1 : 0.001} transform="rotate(-6 100 96)">
        <circle cx="100" cy="86" r="9" fill="none" stroke={WAX_DEEP} strokeWidth={3} />
        <path d="M100 95 l-6 18 h12 Z" fill={WAX_DEEP} />
        <path d="M84 118 q16 -8 32 0" stroke={WAX_DEEP} strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/* ── Cracked / broken wax seal ────────────────────────────────────────────── */
export function CrackedSeal({ size = 168, className = "" }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className} fill="none">
      <ellipse cx="100" cy="170" rx="52" ry="8" fill={INK} opacity="0.1" />
      {/* left half */}
      <path
        d="M100 36 l-6 24 8 14 -10 12 6 16 -8 18 q-22 -2 -34 -18 q-14 -18 -8 -42 q9 -36 52 -34 Z"
        fill={WAX}
        stroke={WAX_DEEP}
        strokeWidth={3.5}
        strokeLinejoin="round"
        transform="translate(-6 0) rotate(-6 80 100)"
      />
      {/* right half */}
      <path
        d="M100 36 l-6 24 8 14 -10 12 6 16 -8 18 q26 0 42 -18 q14 -18 6 -44 q-12 -34 -38 -22 Z"
        fill={WAX}
        stroke={WAX_DEEP}
        strokeWidth={3.5}
        strokeLinejoin="round"
        transform="translate(8 4) rotate(7 120 100)"
      />
      {/* chipped piece */}
      <path d="M150 150 l14 10 -4 14 -16 -8 Z" fill={WAX} stroke={WAX_DEEP} strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}

/* ── Paper bundle (tied) ──────────────────────────────────────────────────── */
export function PaperBundle({ size = 168, className = "" }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className} fill="none">
      <ellipse cx="100" cy="172" rx="54" ry="8" fill={INK} opacity="0.1" />
      <path d="M58 58 q44 -8 86 2 l-4 96 q-40 8 -80 0 Z" fill={PAPER} {...strokeProps} transform="rotate(-4 100 110)" />
      <path d="M64 50 q44 -8 86 2 l-4 96 q-40 8 -80 0 Z" fill={PAPER} {...strokeProps} />
      <line x1="78" y1="76" x2="134" y2="80" {...strokeProps} strokeWidth={2} opacity="0.6" />
      <line x1="76" y1="92" x2="132" y2="96" {...strokeProps} strokeWidth={2} opacity="0.6" />
      {/* ribbon */}
      <path d="M60 116 q44 10 88 0" stroke={ACCENT} strokeWidth={7} fill="none" strokeLinecap="round" />
      <path d="M100 110 l-10 -16 m10 16 l12 -14" stroke={ACCENT} strokeWidth={5} fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ── Seal inspector (box + magnifier) — verify empty ──────────────────────── */
export function SealInspector({ size = 188, className = "" }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className} fill="none">
      <ellipse cx="96" cy="176" rx="60" ry="9" fill={INK} opacity="0.1" />
      {/* box */}
      <path d="M40 104 q52 -10 104 0 l-4 58 q-48 9 -96 0 Z" fill={PAPER} {...strokeProps} />
      <path d="M36 104 q56 -12 112 0 l-4 -14 q-52 -10 -104 0 Z" fill={PARCH} {...strokeProps} />
      {/* small wax seal */}
      <circle cx="92" cy="132" r="12" fill={WAX} stroke={WAX_DEEP} strokeWidth={3} />
      {/* magnifier */}
      <circle cx="126" cy="92" r="30" fill="#ffffff" fillOpacity="0.35" stroke={INK} strokeWidth={4} />
      <line x1="148" y1="114" x2="170" y2="138" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d="M112 84 q12 -12 28 -4" stroke="#ffffff" strokeOpacity="0.6" strokeWidth={4} fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ── Keyhole (small affordance) ───────────────────────────────────────────── */
export function Keyhole({ size = 22, className = "" }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="9.5" r="4" stroke={INK} strokeWidth={2} fill="none" />
      <path d="M12 13 l-2.5 7 h5 Z" fill={INK} />
    </svg>
  );
}

/* ── Ink file glyph (paper slip with dog-ear) ─────────────────────────────── */
export function InkFileGlyph({
  size = 30,
  tint = ACCENT,
  className = "",
}: ArtProps & { tint?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} fill="none">
      <path d="M8 4 h11 l6 6 v18 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 V6 a2 2 0 0 1 2 -2 Z"
        fill={PAPER} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <path d="M19 4 v6 h6" stroke={INK} strokeWidth={2} fill="none" strokeLinejoin="round" />
      <line x1="11" y1="18" x2="21" y2="18" stroke={tint} strokeWidth={2} strokeLinecap="round" />
      <line x1="11" y1="23" x2="18" y2="23" stroke={INK} strokeWidth={2} strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

/* ── Small ink glyphs (inherit currentColor) — for buttons & labels ───────── */
type GlyphProps = { size?: number; className?: string };
const g = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
function Glyph({ size = 16, className = "", children }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...g}>
      {children}
    </svg>
  );
}

export const InkAddFiles = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M7 3 h7 l4 4 v11 a1 1 0 0 1 -1 1 H7 a1 1 0 0 1 -1 -1 V4 a1 1 0 0 1 1 -1 Z" />
    <path d="M14 3 v4 h4" />
    <path d="M11 11 v6 M8 14 h6" />
  </Glyph>
);

export const InkFolder = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M3 8 q0 -2 2 -2 h4 l2 2 h8 q2 0 2 2 v7 q0 2 -2 2 H5 q-2 0 -2 -2 Z" />
  </Glyph>
);

export const InkKey = (p: GlyphProps) => (
  <Glyph {...p}>
    <circle cx="8" cy="8" r="4.2" />
    <path d="M11 11 l8.5 8.5" />
    <path d="M17 17 l2.2 -2.2 M19 19 l2.2 -2.2" />
  </Glyph>
);

export const InkStamp = (p: GlyphProps) => (
  <Glyph {...p}>
    <rect x="9.5" y="3" width="5" height="3.5" rx="1.2" />
    <path d="M8 12 q4 -3.5 8 0 l1.5 1.5 H6.5 Z" />
    <line x1="12" y1="6.5" x2="12" y2="9" />
    <path d="M5 18 q7 -2.5 14 0" />
  </Glyph>
);

export const InkLens = (p: GlyphProps) => (
  <Glyph {...p}>
    <circle cx="10" cy="10" r="6" />
    <line x1="14.5" y1="14.5" x2="20" y2="20" />
  </Glyph>
);

export const InkQuill = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M20 4 C12 5 7.5 9.5 5 18" />
    <path d="M20 4 c-1.5 7 -6 10.5 -12 11.5" />
    <path d="M5 18 l3.5 -3.5" />
  </Glyph>
);

export const ART_COLORS = { INK, PARCH, PAPER, WAX, WAX_DEEP, ACCENT, SAFE };
