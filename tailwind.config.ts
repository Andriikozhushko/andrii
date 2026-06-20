import type { Config } from "tailwindcss";

// Colors use CSS variables with space-separated RGB for Tailwind opacity support.
// Example: bg-accent/10 → rgb(var(--c-accent) / 0.1)
function v(name: string) {
  return `rgb(var(${name}) / <alpha-value>)`;
}

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          base: v("--c-bg-base"),
          surface: v("--c-bg-surface"),
          elevated: v("--c-bg-elevated"),
          hover: v("--c-bg-hover"),
        },
        border: {
          DEFAULT: v("--c-border"),
          strong: v("--c-border-strong"),
        },
        text: {
          primary: v("--c-text-primary"),
          secondary: v("--c-text-secondary"),
          muted: v("--c-text-muted"),
          inverse: v("--c-text-inverse"),
        },
        accent: {
          DEFAULT: v("--c-accent"),
          hover: v("--c-accent-hover"),
          muted: v("--c-accent-muted"),
          subtle: v("--c-accent-subtle"),
        },
        success: {
          DEFAULT: v("--c-success"),
          light: v("--c-success-light"),
          muted: v("--c-success-muted"),
          text: v("--c-success-text"),
        },
        warning: {
          DEFAULT: v("--c-warning"),
          light: v("--c-warning-light"),
          muted: v("--c-warning-muted"),
          text: v("--c-warning-text"),
        },
        danger: {
          DEFAULT: v("--c-danger"),
          light: v("--c-danger-light"),
          muted: v("--c-danger-muted"),
          text: v("--c-danger-text"),
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.68rem", "1rem"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
        dialog: "var(--shadow-dialog)",
        glow: "var(--shadow-glow)",
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
        "pulse-subtle": "pulseSubtle 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
