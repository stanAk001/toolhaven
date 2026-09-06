// The Day/Night toggle. It sets [data-theme] on <html>, persists the choice and
// briefly enables a global colour transition so the switch cross-fades rather
// than snapping. The initial theme is set pre-paint in index.html.
//
// It used to carry its own copy of both palettes and write them onto <html> as
// inline custom properties. Inline properties beat every stylesheet rule, so
// this file — not index.css — was deciding what colour the site was, and any
// change to the tokens was silently overridden at runtime. The palettes now
// live in exactly one place: the :root and [data-theme="night"] blocks in
// index.css. This file only says *which* of them applies.
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

// The favicon is drawn from the same tokens the page is using, read back off
// the document, so the tab mark cannot drift from the palette the way the
// hardcoded copy did.
function faviconFor(night) {
  const read = (name, fallback) => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      // Tokens are stored as "R G B" channels so Tailwind's opacity modifiers work.
      return /^\d+\s+\d+\s+\d+$/.test(v) ? `rgb(${v.split(/\s+/).join(",")})` : (v || fallback);
    } catch { return fallback; }
  };
  const bg = read("--paper", night ? "#101317" : "#FCFCFD");
  const fg = read("--ink", night ? "#E8EAED" : "#0E1116");
  const accent = read("--accent", night ? "#5B8AFF" : "#1F5EFF");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="3" fill="${bg}"/>` +
    `<rect x="2.5" y="2.5" width="27" height="27" rx="2" fill="none" stroke="${fg}" stroke-width="1.5"/>` +
    `<text x="15" y="23" font-family="Archivo,Helvetica,Arial,sans-serif" font-size="19" font-weight="700" ` +
    `letter-spacing="-0.5" text-anchor="middle" fill="${fg}">T</text>` +
    `<rect x="23.5" y="6.5" width="4" height="4" fill="${accent}"/>` +
    `</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function applyTheme(theme) {
  const el = document.documentElement;
  el.dataset.theme = theme;
  el.style.colorScheme = theme === "night" ? "dark" : "light";
  setThemeChrome(theme);
}

// Repaint the browser chrome (tab favicon + address-bar colour) to match. Read
// after the attribute lands so the values come from the theme now in force.
function setThemeChrome(theme) {
  const night = theme === "night";
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; document.head.appendChild(icon); }
  icon.type = "image/svg+xml";
  icon.href = faviconFor(night);

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
  meta.content = night ? "#101317" : "#FCFCFD";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => (typeof document !== "undefined" && document.documentElement.dataset.theme) || "day"
  );

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem("toolhaven-theme", theme); } catch { /* ignore */ }
  }, [theme]);

  const toggle = () => {
    const el = document.documentElement;
    el.classList.add("theming");
    window.setTimeout(() => el.classList.remove("theming"), 500);
    setTheme((t) => (t === "night" ? "day" : "night"));
  };

  const night = theme === "night";
  return (
    // No border or shadow of its own: it is the right-hand half of the header's
    // segmented control, and two separately-boxed icon buttons sitting side by
    // side read as two loose objects rather than one considered one.
    <button type="button" onClick={toggle} aria-pressed={night}
      aria-label={night ? "Switch to Day edition" : "Switch to Night edition"}
      title={night ? "Day edition" : "Night edition"}
      className="inline-flex items-center justify-center gap-1.5 px-3 min-h-touch min-w-touch
        hover:bg-paper2 transition-colors">
      {night ? <Sun size={16} strokeWidth={2} aria-hidden="true" /> : <Moon size={16} strokeWidth={2} aria-hidden="true" />}
      <span className="hidden lg:inline font-mono text-micro uppercase tracking-wide">{night ? "Day" : "Night"}</span>
    </button>
  );
}
