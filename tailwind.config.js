/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      colors: {
        bg: {
          DEFAULT: "#0a0e17",
          soft: "#0e1320",
          raised: "#141a2a",
        },
        line: {
          DEFAULT: "#1e2740",
          soft: "#171f33",
        },
        ink: {
          DEFAULT: "#e6ecf7",
          muted: "#9aa6c2",
          faint: "#5d678a",
        },
        flux: {
          cyan: "#22d3ee",
          violet: "#8b5cf6",
          green: "#34d399",
          amber: "#fbbf24",
          red: "#f87171",
          blue: "#60a5fa",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,0.18), 0 8px 30px -10px rgba(34,211,238,0.25)",
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 40px -24px rgba(0,0,0,0.8)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "row-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(-6px)",
            backgroundColor: "rgba(34,211,238,0.10)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
            backgroundColor: "transparent",
          },
        },
        pulseDot: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "slide-in": "slide-in 0.25s ease-out",
        "row-in": "row-in 0.5s ease-out",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
