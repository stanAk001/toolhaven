// Editorial print furniture — the crop marks, honesty ledger and section folios
// that make Toolhaven read like an independent printed review rather than a web page.
import { Link } from "react-router-dom";
import { SplitFlap } from "./splitflap.jsx";

// A dead-end that still reads like the broadsheet: an accent kicker, an oversized
// ghosted code, the headline, a line of copy, and a stamp back to safety. Used
// for the global 404 and every page's "not found" state.
export function NotFoundBlock({ code = "404", kicker = "Off the press", title, message, to = "/", cta = "Back to the cover →" }) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24 text-center fade-in">
      <p className="font-mono text-xs uppercase tracking-[.2em] text-accentDeep mb-3">{kicker}</p>
      {code && (
        <p className="folio font-display font-semibold leading-[.8] tracking-tight text-ink/15 select-none"
          style={{ fontSize: "clamp(72px,18vw,180px)" }}>{code}</p>
      )}
      <h1 className="font-display text-3xl md:text-4xl font-semibold mb-3 text-balance">{title}</h1>
      <p className="text-ink2 mb-8 text-pretty">{message}</p>
      <Link to={to} className="stamp">{cta}</Link>
    </div>
  );
}

// Tiny registration crosses pinned to the four corners of a relative container,
// like the alignment marks a printer leaves on a press sheet.
export function CropMarks() {
  const mark = (pos) => (
    <svg width="16" height="16" viewBox="0 0 16 16" className={`absolute ${pos} text-ink/35`} aria-hidden="true">
      <path d="M8 0v16M0 8h16" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
  return (
    <div className="pointer-events-none absolute inset-4 hidden md:block" aria-hidden="true">
      {mark("-top-2 -left-2")}
      {mark("-top-2 -right-2")}
      {mark("-bottom-2 -right-2")}
      {mark("-bottom-2 -left-2")}
    </div>
  );
}

// One figure in the honesty ledger — a split-flap number over a mono label,
// sitting in its own cell of the printed table.
function Stat({ value, label, accent = false, live = false }) {
  return (
    <div className="bg-paper px-3 py-2.5 md:px-4 md:py-3">
      <SplitFlap value={value} accent={accent} live={live} style={{ fontSize: "clamp(20px,3vw,38px)" }} />
      <div className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[.14em] text-ink2 mt-1.5">{label}</div>
    </div>
  );
}

// The honesty ledger — the cover's opening statement, told in real numbers
// instead of a strapline, and rendered as a mechanical split-flap board that
// clatters the figures into place on load. "0 paid rankings" is the whole
// mission in one accent-red cell.
export function HonestyLedger({ tools = 0, categories = 0 }) {
  return (
    <div className="border-y-2 border-ink">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ink">
        <Stat value={tools} label="Tools reviewed" live />
        <Stat value={categories} label="Categories" />
        <Stat value="100%" label="Independent" />
        <Stat value="0" label="Hype" accent />
      </div>
    </div>
  );
}

// The standfirst at the top of an inner page: a heavy rule, an accent kicker,
// a big editorial title, and an optional deck of intro copy. Gives every page
// the same printed-front-matter feel as the cover.
export function PageHead({ kicker, title, children }) {
  return (
    <header className="mb-10">
      <div className="rule-2 mb-5" />
      {kicker && <p className="font-mono text-xs uppercase tracking-[.2em] text-accentDeep mb-3">{kicker}</p>}
      <h1 className="font-display font-semibold leading-[.95] tracking-tight text-balance"
        style={{ fontSize: "clamp(38px,7vw,84px)" }}>{title}</h1>
      {children && <p className="text-lg text-ink2 mt-4 max-w-2xl text-pretty">{children}</p>}
    </header>
  );
}

// A magazine-style section header: a huge ghosted folio number, a small accent
// kicker, the title, an optional action on the right, and a heavy closing rule.
export function SectionHead({ folio, kicker, title, action }) {
  return (
    <div className="mb-8">
      <div className="flex items-end gap-3 md:gap-5">
        {folio && (
          <span className="folio font-display font-semibold text-ink/15 select-none leading-[.7] hidden sm:block"
            style={{ fontSize: "clamp(56px,9vw,108px)" }}>{folio}</span>
        )}
        <div className="flex-1 pb-1">
          {kicker && <p className="font-mono text-[11px] uppercase tracking-[.2em] text-accentDeep mb-1">{kicker}</p>}
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl md:text-4xl font-semibold leading-none">{title}</h2>
            {action}
          </div>
        </div>
      </div>
      <div className="rule-2 mt-3" />
    </div>
  );
}
