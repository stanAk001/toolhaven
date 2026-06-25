/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', "serif"],
        sans: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
        mono: ['"Space Mono"', "monospace"],
      },
      colors: {
        // channel-based so Tailwind opacity modifiers (bg-ink/40) keep working,
        // and so a single [data-theme] swap re-themes the whole site at once.
        paper: "rgb(var(--paper) / <alpha-value>)",
        paper2: "rgb(var(--paper2) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        ink2: "rgb(var(--ink2) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        accentDeep: "rgb(var(--accent-deep) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
