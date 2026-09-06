// The page furniture: the opening figures, section heads and key-point blocks.
// All of it is drawn in hairlines and set on the grid — the pieces are meant to
// be legible structure, not ornament, so none of them carry a shadow or a fill.
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



/* VerdictSeal — the two policies, stated.
 *
 * This was a rotating wax seal: a ring of type turning around an inked disc. It
 * was the single most decorative object on the site, and a reader had to wait
 * for the ring to come round before they could read what it claimed. The claims
 * themselves are the whole point, so they are simply set — two lines, a hairline
 * box, the accent reserved for the number that matters.
 */
export function VerdictSeal({ className = "" }) {
  const rows = [
    ["Paid rankings", "0"],
    ["Downsides listed", "Every review"],
  ];
  return (
    <dl className={`shrink-0 border border-rule rounded-card divide-y divide-rule ${className}`}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-6 px-3 py-2">
          <dt className="font-mono text-nano uppercase tracking-[.14em] text-ink2 whitespace-nowrap">{label}</dt>
          <dd className="font-mono text-xs font-semibold tabular-nums whitespace-nowrap">{value}</dd>
        </div>
      ))}
    </dl>
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
        >
        {body}
      </div>
    );
  }
  return <div className="inline-flex items-baseline gap-2">{body}</div>;
}

/* LedgerBoard — the four figures the cover opens on.
 *
 * This used to feed one figure at a time through a rotating gate. A reader who
 * wanted the second number had to wait 5.5 seconds for it, and the fourth — the
 * zero the whole site rests on — was off screen most of the time. Every figure
 * is now printed at once on one ruled line: no timer, no pause control, nothing
 * to wait for, and the zero always visible.
 */
export function LedgerBoard({ tools = null, categories = null }) {
  // A count we do not have yet is not a count of zero. Printing "0 tools
  // reviewed" while the request is in flight reads as an empty directory for
  // the moment it is on screen. Figures wait until their number is real.
  return (
    <div className="border-y border-rule">
      <dl className="flex flex-wrap items-baseline gap-x-6 sm:gap-x-10 gap-y-3 py-3.5 sm:py-4">
        {tools ? <Figure value={tools} label="Tools reviewed" /> : null}
        {categories ? <Figure value={categories} label="Categories" /> : null}
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

/**
 * The short version, printed first.
 *
 * A trust page is read by two people: one who will read every word, and one who
 * wants to know in ten seconds whether they are being sold to. The second is
 * the more sceptical of the two and is currently served worst, because the
 * honest answer is buried in the fourth paragraph. This puts it at the top.
 *
 * Numbered rather than bulleted — a numbered list reads as a stated position, a
 * bulleted one as marketing copy.
 */
export function KeyPoints({ label = "The short version", points = [] }) {
  if (!points.length) return null;
  return (
    <aside className="border-y border-rule py-5 sm:py-6 mb-9 sm:mb-11">
      <p className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-4">{label}</p>
      <ol className="space-y-3">
        {points.map((p, i) => (
          <li key={p} className="flex gap-4">
            <span aria-hidden="true"
              className="font-mono text-label tabular-nums text-ink2 pt-1 shrink-0 w-5">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-display text-lg sm:text-xl leading-snug text-pretty">{p}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

/**
 * A contents rail set in the margin.
 *
 * These pages run to eight hundred words in a single column with a third of the
 * viewport empty on either side at desktop. This puts the empty margin to work
 * the way a printed reference would — the reader can see the shape of the whole
 * argument, and jump.
 *
 * Margin-only by design: it appears where there is genuinely room beside the
 * measure and is simply absent below that, rather than collapsing into another
 * stacked block competing with the prose.
 */
export function MarginContents({ items = [] }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label="On this page"
      className="hidden xl:block absolute right-full top-0 h-full pr-10 w-56">
      <div className="sticky top-28">
        <p className="font-mono text-nano uppercase tracking-[.2em] text-ink2 mb-3">On this page</p>
        <ul className="space-y-2 border-l border-rule pl-4">
          {items.map((it) => (
            <li key={it.id}>
              {/* A navigation link, not an inline one, so it has to carry a
                  real target rather than lean on the sentence exemption. */}
              <a href={`#${it.id}`}
                className="flex items-center min-h-[26px] font-mono text-label leading-snug text-ink2 hover:text-accentDeep transition-colors">
                {it.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
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
