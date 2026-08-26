// The command palette — press ⌘K / Ctrl-K (or the nav Search button, which
// fires a "toolhaven:search" event) to open a keyboard-driven index over the
// whole site: live tool search plus jumps to categories and pages. Styled as a
// printed index card so it belongs to the rest of the paper.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { getTools } from "../api/client.js";

const PAGES = [
  { label: "All tools", sub: "Browse the full directory", to: "/tools" },
  { label: "Compare tools", sub: "Three side by side", to: "/compare" },
  { label: "Blog", sub: "Guides & honest takes", to: "/blog" },
  { label: "About", sub: "Why we exist", to: "/about" },
  { label: "Contact", sub: "Say hello", to: "/contact" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [tools, setTools] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const close = () => { setOpen(false); setQ(""); setTools([]); setActive(0); };

  // open via shortcut or the nav button's event; Esc always closes
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("toolhaven:search", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("toolhaven:search", onOpen); };
  }, []);

  // lock scroll + focus the field while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => { clearTimeout(t); document.body.style.overflow = ""; };
    }
    document.body.style.overflow = "";
  }, [open]);

  // debounced live tool search
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) { setTools([]); return; }
    const id = setTimeout(() => {
      getTools({ search: term, limit: 6 }).then((d) => setTools(d.items || [])).catch(() => setTools([]));
    }, 180);
    return () => clearTimeout(id);
  }, [q, open]);

  useEffect(() => { setActive(0); }, [q]);

  const ql = q.trim().toLowerCase();
  const items = [
    ...tools.map((t) => ({ kind: "tool", label: t.name, sub: t.category?.name || "Tool", to: `/tools/${t.slug}`, color: t.category?.colorPrimary, mono: t.logoMono })),
    ...PAGES.filter((p) => !ql || p.label.toLowerCase().includes(ql)).map((p) => ({ kind: "page", label: p.label, sub: p.sub, to: p.to })),
  ];
  const clamped = Math.min(active, Math.max(0, items.length - 1));

  const go = (it) => { if (it) { close(); navigate(it.to); } };
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(items[clamped]); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog" aria-modal="true" aria-label="Search Toolhaven">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm fade-in" onClick={close} aria-hidden="true" />
      <div className="relative w-full max-w-xl bg-paper border-2 border-ink rounded-card overflow-hidden" style={{ boxShadow: "8px 8px 0 var(--shadow-cast)" }}>
        <span className="halftone absolute inset-0 opacity-[.05] pointer-events-none" aria-hidden="true" />

        <div className="relative flex items-center gap-3 px-5 py-4 border-b-2 border-ink">
          <Search size={18} strokeWidth={2.5} className="text-accentDeep shrink-0" aria-hidden="true" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search tools, categories, pages…" aria-label="Search"
            className="flex-1 min-w-0 bg-transparent outline-none text-lg" />
          <kbd className="font-mono text-nano uppercase tracking-wide bg-paper2 border-2 border-ink rounded px-2 py-1 shrink-0">Esc</kbd>
        </div>

        <ul className="relative max-h-[52vh] overflow-auto py-2">
          {items.length === 0 && (
            <li className="px-5 py-8 text-center font-mono text-xs uppercase tracking-wide text-ink2">
              {ql ? "No matches — try another word" : "Type to search the whole site"}
            </li>
          )}
          {items.map((it, i) => (
            <li key={it.kind + it.to}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(it)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${i === clamped ? "bg-paper2" : ""}`}>
                <span className="grid place-items-center w-9 h-9 rounded-ui border-2 border-ink font-display font-semibold text-white shrink-0"
                  style={{ background: it.color || "#1C1714" }}>{it.mono || (it.kind === "page" ? "→" : (it.label[0] || "?"))}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display font-semibold leading-tight truncate">{it.label}</span>
                  <span className="block font-mono text-label uppercase tracking-wide text-ink2 truncate">{it.sub}</span>
                </span>
                <span className="font-mono text-nano uppercase tracking-wide text-ink2 shrink-0">{it.kind}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="relative flex items-center justify-between gap-3 px-5 py-2.5 border-t-2 border-ink font-mono text-micro uppercase tracking-[.16em] text-ink2">
          <span>↑↓ move · ↵ open · esc close</span>
          <span className="text-accentDeep">Toolhaven index</span>
        </div>
      </div>
    </div>
  );
}
