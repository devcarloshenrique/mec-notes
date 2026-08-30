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
        background: "#0f0f10",
        foreground: "#e5e5e5",
        card: {
          DEFAULT: "#141415",
          foreground: "#e5e5e5",
        },
        popover: {
          DEFAULT: "#141415",
          foreground: "#e5e5e5",
        },
        primary: {
          DEFAULT: "#ffffff",
          foreground: "#0a0a0b",
        },
        secondary: {
          DEFAULT: "#18181a",
          foreground: "#e5e5e5",
        },
        muted: {
          DEFAULT: "#18181a",
          foreground: "#71717a",
        },
        accent: {
          DEFAULT: "#1a1a1c",
          foreground: "#e5e5e5",
        },
        destructive: {
          DEFAULT: "#dc2626",
          foreground: "#ffffff",
        },
        border: "rgba(255, 255, 255, 0.06)",
        input: "rgba(255, 255, 255, 0.08)",
        ring: "#ffffff",
        sidebar: {
          DEFAULT: "#0a0a0b",
          foreground: "#a1a1aa",
          primary: "#ffffff",
          "primary-foreground": "#0a0a0b",
          accent: "#18181a",
          "accent-foreground": "#e5e5e5",
          border: "rgba(255, 255, 255, 0.06)",
          ring: "#ffffff",
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
