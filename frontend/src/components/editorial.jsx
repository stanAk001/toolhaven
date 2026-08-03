// Editorial print furniture — the crop marks, honesty ledger and section folios
// that make Toolhaven read like an independent printed review rather than a web page.
import { Link } from "react-router-dom";
import { CountUp } from "./motion.jsx";

// A dead-end that still reads like the broadsheet: an accent kicker, an oversized
// ghosted code, the headline, a line of copy, and a stamp back to safety. Used
// for the global 404 and every page's "not found" state.
export function NotFoundBlock({ code = "404", kicker = "Off the press", title, message, to = "/", cta = "Back to the cover →" }) {
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 py-16 sm:py-24 text-center fade-in">
      <p className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-3">{kicker}</p>
      {code && (
        <p className="folio font-display text-code font-semibold tracking-tight text-ink/15 select-none"
          aria-hidden="true">{code}</p>
      )}
      <h1 className="font-display text-title font-semibold mb-3 text-balance">{title}</h1>
      <p className="text-ink2 mb-8 text-pretty max-w-measure-sm mx-auto">{message}</p>
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

/* VerdictSeal — the paper's mark of independence, struck as a printer's seal.
 *
 * A certification stamp is the one piece of furniture a review publication has
 * always been allowed: a ring of set type turning slowly around a fixed centre,
 * hard-edged, no glow, no gradient. It earns its place next to the call to
 * action by saying the one thing the whole site is built on — that nobody paid
 * for their position — at the exact moment the reader decides whether to trust
 * it. The ring turns; the mark in the middle never moves.
 */
export function VerdictSeal({ className = "", size = 112 }) {
  const RING = "NO PAID RANKINGS · EVERY DOWNSIDE LISTED · ";
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="seal-ring absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          {/* the baseline the ring type is set on */}
          <path id="seal-arc" fill="none"
            d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0" />
        </defs>
        <circle cx="100" cy="100" r="97" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
        <text className="seal-type" fill="currentColor">
          <textPath href="#seal-arc" startOffset="0">{RING}</textPath>
        </text>
      </svg>

      {/* the fixed centre — the house mark over an inked disc */}
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid place-items-center rounded-full bg-ink text-paper"
          style={{ width: size * 0.44, height: size * 0.44 }}>
          <span className="text-accent leading-none" style={{ fontSize: size * 0.2 }}>✦</span>
        </span>
      </span>
    </div>
  );
}

// One standing figure — the numeral and its caption set on a shared baseline,
// the way a masthead carries its circulation numbers. Reading across rather than
// stacking in a box is what keeps the whole strip one line deep on a phone.
function Figure({ value, suffix = "", label, chip = false }) {
  const body = (
    <>
      <dd className="font-display text-2xl sm:text-3xl font-semibold leading-none tracking-tight tabular-nums">
        <CountUp value={value} suffix={suffix} />
      </dd>
      <dt className={`font-mono text-micro uppercase tracking-[.13em] ${chip ? "" : "text-ink2"}`}>
        {label}
      </dt>
    </>
  );

  // The mission figure is inked into a chip. It's the one claim the whole site
  // rests on, so it gets to be an object on the page rather than another entry
  // in a list — which is also the hierarchy the four equal cells never had.
  if (chip) {
    return (
      <div className="inline-flex items-baseline gap-2 bg-accent text-white px-2.5 py-1.5 rounded-[4px]"
        style={{ boxShadow: "3px 3px 0 var(--shadow-cast)" }}>
        {body}
      </div>
    );
  }
  return <div className="inline-flex items-baseline gap-2">{body}</div>;
}

// The honesty ledger — the cover's opening statement, told in real numbers
// instead of adjectives, and set as a masthead strapline rather than a table.
// The figures tally up once on the way in, like a ledger totalling itself.
export function HonestyLedger({ tools = 0, categories = 0 }) {
  return (
    <div className="border-y-2 border-ink">
      <dl className="flex flex-wrap items-baseline gap-x-5 sm:gap-x-8 gap-y-3 py-3.5 sm:py-4">
        <Figure value={tools} label="Tools reviewed" />
        <Figure value={categories} label="Categories" />
        <Figure value={100} suffix="%" label="Independent" />
        <Figure value={0} label="Paid rankings" chip />
      </dl>
    </div>
  );
}

// The standfirst at the top of an inner page: a heavy rule, an accent kicker,
// a big editorial title, and an optional deck of intro copy. Gives every page
// the same printed-front-matter feel as the cover.
export function PageHead({ kicker, title, children }) {
  return (
    <header className="mb-8 sm:mb-10">
      <div className="rule-2 mb-4 sm:mb-5" />
      {kicker && <p className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-3">{kicker}</p>}
      <h1 className="font-display text-display font-semibold text-balance">{title}</h1>
      {children && <p className="text-base sm:text-lg text-ink2 mt-4 max-w-measure text-pretty">{children}</p>}
    </header>
  );
}

// A magazine-style section header: a huge ghosted folio number, a small accent
// kicker, the title, an optional action on the right, and a heavy closing rule.
export function SectionHead({ folio, kicker, title, action }) {
  return (
    <div className="mb-7 sm:mb-8">
      <div className="flex items-end gap-3 md:gap-5">
        {folio && (
          <span className="folio font-display text-folio font-semibold text-ink/15 select-none hidden sm:block"
            aria-hidden="true">{folio}</span>
        )}
        <div className="flex-1 pb-1 min-w-0">
          {kicker && <p className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-1.5">{kicker}</p>}
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <h2 className="font-display text-title font-semibold">{title}</h2>
            {action}
          </div>
        </div>
      </div>
      <div className="rule-2 mt-3" />
    </div>
  );
}
