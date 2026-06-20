import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ANDRII design system — professional security software palette
        bg: {
          base: "#0d0f14",
          surface: "#141720",
          elevated: "#1a1f2e",
          hover: "#1f2437",
        },
        border: {
          DEFAULT: "#252b3b",
          subtle: "#1d2234",
          strong: "#2e3650",
        },
        text: {
          primary: "#e2e8f0",
          secondary: "#8892a4",
          muted: "#556070",
          inverse: "#0d0f14",
        },
        accent: {
          DEFAULT: "#4a90d9",
          hover: "#5aa3e8",
          muted: "#1e3a5f",
          subtle: "#142540",
        },
        success: {
          DEFAULT: "#3d8c6f",
          light: "#4aa882",
          muted: "#1a3d30",
          text: "#6ecba8",
        },
        warning: {
          DEFAULT: "#c4893d",
          light: "#d9a050",
          muted: "#3d2a10",
          text: "#e8b870",
        },
        danger: {
          DEFAULT: "#c45454",
          light: "#d96666",
          muted: "#3d1a1a",
          text: "#e88080",
        },
        strength: {
          0: "#c45454", // very weak
          1: "#c4893d", // weak
          2: "#c4b43d", // fair
          3: "#3d8c6f", // strong
          4: "#3d7a8c", // very strong
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.65rem", "1rem"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
        elevated: "0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        glow: "0 0 20px rgba(74, 144, 217, 0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
        "pulse-subtle": "pulseSubtle 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
