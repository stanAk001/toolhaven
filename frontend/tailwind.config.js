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

        // --- labels: the two sizes that were being typed out by hand 168
        // times as text-[11px] and text-[10px]. Deliberately carrying no
        // letter-spacing of their own, so the tracking a component asks for
        // still wins.
        label: ["0.6875rem", { lineHeight: "1.45" }],
        nano: ["0.625rem", { lineHeight: "1.4" }],
        nav: ["1.0625rem", { lineHeight: "1", letterSpacing: "-.005em" }],
      },
      // --- corner radius -------------------------------------------------
      // A press sheet has no rounded corners. The site had seven different
      // radii in play (plus three one-off pixel values), which is what makes
      // an editorial design read as a template with a theme painted on it.
      // Four steps, each with a job:
      borderRadius: {
        edge: "0",       // rules, tables, full-bleed panels: printed things
        tight: "2px",    // chips, labels, stamps — barely there, on purpose
        ui: "4px",       // inputs, buttons, controls: functional software
        card: "8px",     // cards and panels: the only place softness earns it
        disc: "9999px",  // true circles only, never a pill-shaped button
      },

      // --- the letterpress shadow ---------------------------------------
      // The hard offset shadow is Toolhaven's signature and stays. What goes
      // is the eight different distances it was written at by hand.
      boxShadow: {
        press: "3px 3px 0 var(--shadow-cast)",
        "press-sm": "2px 2px 0 var(--shadow-cast)",
        "press-lg": "6px 6px 0 var(--shadow-cast)",
        "press-xl": "10px 10px 0 var(--shadow-cast)",
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
