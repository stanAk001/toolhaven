/** @type {import('tailwindcss').Config} */

/* Fluid editorial type scale.
   Every step interpolates linearly between a 375px phone and a 1440px desktop,
   so a headline is *set* at both ends rather than being a desktop size with a
   panic-stricken minimum. Each token carries its own leading and tracking, which
   keeps a heading one decision instead of four loose utilities.

   fluid(minPx, maxPx) solves y = mx + b across those two viewports. */
const fluid = (min, max) => {
  const slope = (max - min) / (1440 - 375);
  const intercept = min - slope * 375;
  return `clamp(${min / 16}rem, ${(intercept / 16).toFixed(4)}rem + ${(slope * 100).toFixed(3)}vw, ${max / 16}rem)`;
};

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
      fontSize: {
        // --- voice: the type that carries the masthead ---
        hero: [fluid(34, 92), { lineHeight: ".95", letterSpacing: "-.022em" }],
        display: [fluid(30, 64), { lineHeight: ".98", letterSpacing: "-.02em" }],
        title: [fluid(24, 40), { lineHeight: "1.05", letterSpacing: "-.015em" }],
        wordmark: [fluid(40, 84), { lineHeight: ".85", letterSpacing: "-.025em" }],

        // --- press furniture: decorative figures set behind the content ---
        folio: [fluid(40, 92), { lineHeight: ".7" }],
        code: [fluid(64, 150), { lineHeight: ".8" }],
        ghost: [fluid(64, 180), { lineHeight: ".8" }],
        monogram: [fluid(88, 240), { lineHeight: ".8" }],
        stat: [fluid(19, 32), { lineHeight: "1" }],

        // --- micro: the mono kickers and captions that carry the press voice.
        // 11px is the floor; anything smaller stops being readable on a phone.
        micro: ["0.6875rem", { lineHeight: "1.45", letterSpacing: ".16em" }],
        caption: ["0.75rem", { lineHeight: "1.5", letterSpacing: ".01em" }],
      },
      maxWidth: {
        // line-length control: ~65-75 characters is the readable measure
        measure: "68ch",
        "measure-sm": "56ch",
      },
      minHeight: {
        // the platform touch-target floor, used on every control
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};
