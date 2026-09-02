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
        sans: ["Inter", "Geist", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],
      },
      colors: {
        app: {
          dark: '#121212',
          sidebar: '#18181b', // zinc-900
          editor: '#18181b',
          border: '#27272a', // zinc-800
          active: '#27272a', // zinc-800
          text: '#e4e4e7', // zinc-200
          muted: '#a1a1aa', // zinc-400
          icon: '#a1a1aa', // zinc-400
        },
        background: "#121212",
        foreground: "#e4e4e7",
        card: {
          DEFAULT: "#18181b",
          foreground: "#e4e4e7",
        },
        popover: {
          DEFAULT: "#18181b",
          foreground: "#e4e4e7",
        },
        primary: {
          DEFAULT: "#ffffff",
          foreground: "#0a0a0b",
        },
        secondary: {
          DEFAULT: "#27272a",
          foreground: "#e4e4e7",
        },
        muted: {
          DEFAULT: "#27272a",
          foreground: "#a1a1aa",
        },
        accent: {
          DEFAULT: "#27272a",
          foreground: "#e4e4e7",
        },
        destructive: {
          DEFAULT: "#dc2626",
          foreground: "#ffffff",
        },
        border: "#27272a",
        input: "#27272a",
        ring: "#ffffff",
        sidebar: {
          DEFAULT: "#18181b",
          foreground: "#a1a1aa",
          primary: "#ffffff",
          "primary-foreground": "#0a0a0b",
          accent: "#27272a",
          "accent-foreground": "#e4e4e7",
          border: "#27272a",
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
