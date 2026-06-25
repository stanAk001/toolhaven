// Night Edition toggle — flips the whole site between the warm Day paper and the
// dark Night press run by setting [data-theme] on <html>, persists the choice,
// and briefly enables a global colour transition so the switch cross-fades
// rather than snapping. The initial theme is set pre-paint in index.html.
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

// Build the favicon as a themed data-URI SVG (same mark as public/favicon.svg,
// recoloured for the edition) so the tab icon follows Day/Night.
function faviconFor(night) {
  const bg = night ? "#181512" : "#F1EADD";
  const fg = night ? "#F0E9DC" : "#1C1714";
  const accent = night ? "#F55C38" : "#E8431F";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="6" fill="${bg}"/>` +
    `<rect x="3" y="3" width="26" height="26" rx="4.5" fill="none" stroke="${fg}" stroke-width="2"/>` +
    `<text x="16" y="23.5" font-family="Georgia,serif" font-size="22" font-weight="700" text-anchor="middle" fill="${fg}">T</text>` +
    `<path d="M25.2 4.8l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="${accent}"/>` +
    `</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// The two palettes, applied as inline CSS variables straight onto <html>. Inline
// custom properties beat any stylesheet rule, so the theme flips even if the
// [data-theme] CSS didn't load — as long as utilities read rgb(var(--x)).
const THEMES = {
  day: { "--paper": "241 234 221", "--paper2": "231 221 203", "--ink": "28 23 20", "--ink2": "106 95 82", "--accent": "232 67 31", "--accent-deep": "184 54 23", "--shadow-cast": "#1C1714", "--flap-bg": "28 23 20", "--flap-fg": "241 234 221" },
  night: { "--paper": "24 21 18", "--paper2": "35 30 26", "--ink": "240 233 220", "--ink2": "166 154 137", "--accent": "245 92 56", "--accent-deep": "248 130 92", "--shadow-cast": "#000000", "--flap-bg": "8 7 6", "--flap-fg": "240 233 220" },
};

function applyTheme(theme) {
  const el = document.documentElement;
  el.dataset.theme = theme;
  el.style.colorScheme = theme === "night" ? "dark" : "light";
  const vars = THEMES[theme] || THEMES.day;
  for (const k in vars) el.style.setProperty(k, vars[k]);
  setThemeChrome(theme);
}

// Repaint the browser chrome (tab favicon + address-bar theme-color) to match.
function setThemeChrome(theme) {
  const night = theme === "night";
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; document.head.appendChild(icon); }
  icon.type = "image/svg+xml";
  icon.href = faviconFor(night);

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
  meta.content = night ? "#181512" : "#F1EADD";
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
    <button type="button" onClick={toggle} aria-pressed={night}
      aria-label={night ? "Switch to Day edition" : "Switch to Night edition"}
      title={night ? "Day edition" : "Night edition"}
      className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-2.5 py-1.5 transition-transform hover:-translate-y-0.5"
      style={{ boxShadow: "2px 2px 0 var(--shadow-cast)" }}>
      {night ? <Sun size={15} strokeWidth={2.5} aria-hidden="true" /> : <Moon size={15} strokeWidth={2.5} aria-hidden="true" />}
      <span className="hidden lg:inline font-mono text-[11px] uppercase tracking-wide">{night ? "Day" : "Night"}</span>
    </button>
  );
}
