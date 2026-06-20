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
        surface: v("--c-surface"),
        elevated: v("--c-elevated"),
        hover: v("--c-hover"),
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
        },
        success: {
          DEFAULT: v("--c-success"),
          text: v("--c-success-text"),
        },
        warning: {
          DEFAULT: v("--c-warning"),
          text: v("--c-warning-text"),
        },
        danger: {
          DEFAULT: v("--c-danger"),
          text: v("--c-danger-text"),
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.68rem", "1rem"],
      },
      boxShadow: {
        sm:   "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        lg:   "var(--shadow-lg)",
        card: "var(--shadow-card)",
      },
      animation: {
        "fade-in":  "fadeIn 0.12s ease-out",
        "slide-up": "slideUp 0.18s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
