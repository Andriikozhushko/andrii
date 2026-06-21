import type { Config } from "tailwindcss";

function v(name: string) {
  return `rgb(var(${name}) / <alpha-value>)`;
}

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("--c-bg"),
        "bg-2": v("--c-bg-2"),
        surface: {
          DEFAULT: v("--c-surface"),
          sunken: v("--c-surface-sunken"),
        },
        elevated: v("--c-elevated"),
        hover: v("--c-hover"),
        border: {
          DEFAULT: v("--c-border"),
          strong: v("--c-border-strong"),
        },
        // legacy text.* keys kept so untouched screens adopt the parchment ramp
        text: {
          primary: v("--c-ink"),
          secondary: v("--c-ink-soft"),
          muted: v("--c-ink-faint"),
          inverse: v("--c-inverse"),
        },
        ink: {
          DEFAULT: v("--c-ink"),
          soft: v("--c-ink-soft"),
          faint: v("--c-ink-faint"),
        },
        line: v("--c-ink"),
        accent: {
          DEFAULT: v("--c-accent"),
          hover: v("--c-accent-deep"),
          deep: v("--c-accent-deep"),
          soft: v("--c-accent-soft"),
          text: v("--c-accent-deep"),
        },
        wax: {
          DEFAULT: v("--c-wax"),
          deep: v("--c-wax-deep"),
        },
        safe: {
          DEFAULT: v("--c-safe"),
          deep: v("--c-safe-deep"),
        },
        success: { DEFAULT: v("--c-safe"), text: v("--c-safe-deep") },
        warning: { DEFAULT: v("--c-amber"), text: v("--c-amber-deep") },
        danger: { DEFAULT: v("--c-wax"), text: v("--c-wax-deep") },
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "Cambria", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", "0.875rem"],
      },
      borderRadius: {
        "4xl": "1.75rem",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        card: "var(--shadow-card)",
        stamp: "var(--shadow-stamp)",
      },
      animation: {
        "fade-in": "fadeIn 0.18s ease-out",
        "slide-up": "slideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "stamp-in": "stampIn 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)",
        shake: "shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        stampIn: {
          "0%": { opacity: "0", transform: "scale(1.7) rotate(-14deg)" },
          "60%": { opacity: "1" },
          "100%": { opacity: "1", transform: "scale(1) rotate(-6deg)" },
        },
        shake: {
          "10%, 90%": { transform: "translateX(-1px)" },
          "20%, 80%": { transform: "translateX(2px)" },
          "30%, 50%, 70%": { transform: "translateX(-4px)" },
          "40%, 60%": { transform: "translateX(4px)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
