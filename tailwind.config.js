/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "monospace"],
      },
      colors: {
        background: "#15181f",
        foreground: "#e7e9ee",
        card: {
          DEFAULT: "#1c1f27",
          foreground: "#e7e9ee",
        },
        popover: {
          DEFAULT: "#1c1f27",
          foreground: "#e7e9ee",
        },
        primary: {
          DEFAULT: "#e0a94a",
          foreground: "#2a2113",
        },
        secondary: {
          DEFAULT: "#23272f",
          foreground: "#e7e9ee",
        },
        muted: {
          DEFAULT: "#23272f",
          foreground: "#9a9ea8",
        },
        accent: {
          DEFAULT: "#282d37",
          foreground: "#e7e9ee",
        },
        destructive: {
          DEFAULT: "#d5453b",
          foreground: "#ffffff",
        },
        border: "rgba(255, 255, 255, 0.09)",
        input: "rgba(255, 255, 255, 0.12)",
        ring: "#e0a94a",
        sidebar: {
          DEFAULT: "#111318",
          foreground: "#dcdee4",
          primary: "#e0a94a",
          "primary-foreground": "#2a2113",
          accent: "#23272f",
          "accent-foreground": "#e7e9ee",
          border: "rgba(255, 255, 255, 0.08)",
          ring: "#e0a94a",
        },
      },
      borderRadius: {
        lg: "0.625rem",
        md: "calc(0.625rem - 2px)",
        sm: "calc(0.625rem - 4px)",
      },
    },
  },
  plugins: [],
}
