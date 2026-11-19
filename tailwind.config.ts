import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      colors: {
        canvas: "#09090E",
        blush: "#F9A8D4",
        champagne: "#FDE68A",
        lavender: "#C4B5FD",
        mint: "#10B981",
        coral: "#FB7185",
        pearl: "rgba(255, 248, 252, 0.045)",
        "rose-pearl": "rgba(251, 207, 232, 0.14)",
      },
    },
  },
  plugins: [],
} satisfies Config;