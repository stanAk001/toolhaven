// Editorial print furniture — the crop marks, honesty ledger and section folios
// that make Toolhaven read like an independent printed review rather than a web page.
import { useEffect, useState } from "react";
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

/* LedgerBoard — the cover's opening statement, fed through a gate.
 *
 * One fact is in the aperture at a time and the strip slides to the next. Each
 * frame states its figure on the left and *acts it out* on the right: the tools
 * are struck as a tally, the categories deal in wearing their own colours, the
 * independence meter inks across to full.
 *
 * The fourth frame is the one the site exists for, and it is the only one that
 * refuses to fill. Its ledger slots stay empty and a rule is struck through
 * them — nothing was ever entered there. Every other frame builds; this one
 * stays blank on purpose, which says more than the numeral alone.
 */
/* 5.5s a frame. Nielsen Norman put readable auto-rotation at roughly a second
 * per three words, and the W3C carousel guidance lands on 5–7s for short
 * headings; at the 4.2s this used to run, a frame was gone before it had been
 * read. It also stops on hover, on keyboard focus, and on demand — auto-updating
 * content that runs longer than five seconds needs a way to halt it (WCAG 2.2.2
 * Pause, Stop, Hide), and hovering alone does nothing for a touch or keyboard
 * user. */
const HOLD_MS = 5500;

export function LedgerBoard({ tools = 0, categories = 0, palette = [] }) {
  const frames = [
    { key: "tools", value: tools, label: "Tools reviewed", art: "tally" },
    { key: "cats", value: categories, label: "Categories", art: "chips" },
    { key: "indep", value: "100%", label: "Independent", art: "meter" },
    { key: "paid", value: "0", label: "Paid rankings", art: "empty", accent: true },
  ];

  const [i, setI] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [held, setHeld] = useState(false);   // pointer or keyboard is on it
  const [stopped, setStopped] = useState(false); // the reader asked it to stop

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced || held || stopped) return;
    const id = setInterval(() => setI((n) => (n + 1) % frames.length), HOLD_MS);
    return () => clearInterval(id);
  }, [reduced, held, stopped, frames.length]);

  // Reduced motion: nothing feeds through. The finished record, printed once.
  if (reduced) {
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

  return (
    <div className="relative border-y-2 border-ink">
      {/* registration marks on the aperture — the same press furniture as the
          cover's crop marks, so the gate belongs to the page */}
      <GateMarks />

      <div className="flex items-center gap-3 sm:gap-5 py-2"
        onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}
        onFocusCapture={() => setHeld(true)} onBlurCapture={() => setHeld(false)}>

        <span aria-hidden="true"
          className="shrink-0 font-mono text-micro uppercase tracking-[.16em] sm:tracking-[.2em] text-ink2">
          <span className="text-accent mr-1.5">№</span>
          <span className="hidden sm:inline">The record </span>
          <span className="tabular-nums">{String(i + 1).padStart(2, "0")}/{String(frames.length).padStart(2, "0")}</span>
        </span>

        <div className="gate flex-1 min-w-0 h-10 sm:h-11" aria-hidden="true">
          <div className="gate-track"
            style={{ height: `${frames.length * 100}%`, transform: `translateY(-${(i * 100) / frames.length}%)` }}>
            {frames.map((f, n) => (
              <div key={f.key} className="gate-frame flex items-center gap-4 sm:gap-6">
                <span className="flex items-baseline gap-2 shrink-0">
                  <span className={`font-display text-xl sm:text-3xl font-semibold leading-none tracking-tight tabular-nums
                    ${f.accent ? "text-accent" : ""}`}>
                    {f.value}
                  </span>
                  <span className={`font-mono text-micro uppercase tracking-[.1em] whitespace-nowrap
                    ${f.accent ? "text-accentDeep" : "text-ink2"}`}>
                    {f.label}
                  </span>
                </span>

                {/* the right half acts the figure out */}
                <span className="flex-1 min-w-0 flex items-center justify-end overflow-hidden">
                  <Art kind={f.art} n={n === 0 ? tools : n === 1 ? categories : 0}
                    palette={palette} live={n === i} />
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* the stop control. Quiet, but always there — hovering does nothing for
            a keyboard or touch reader, and this content updates on its own. */}
        <button type="button" onClick={() => setStopped((s) => !s)}
          aria-label={stopped ? "Resume the record" : "Stop the record"}
          className="shrink-0 grid place-items-center min-w-touch min-h-touch -my-1 rounded-full text-ink2/70 hover:text-accentDeep hover:bg-paper2 transition-colors">
          <span aria-hidden="true" className="font-mono text-[11px] leading-none">{stopped ? "▶" : "❙❙"}</span>
        </button>
      </div>

      {/* the whole record, stated once, for anyone not watching it feed */}
      <dl className="sr-only">
        {frames.map((f) => (
          <div key={f.key}><dt>{f.label}</dt><dd>{f.value}</dd></div>
        ))}
      </dl>
    </div>
  );
}

// Four corner ticks, sized and inked like the cover's crop marks.
function GateMarks() {
  const tick = (pos) => (
    <span aria-hidden="true"
      className={`absolute ${pos} w-2 h-2 border-ink/30 pointer-events-none hidden sm:block`} />
  );
  return (
    <>
      {tick("top-1.5 left-0 border-t-2 border-l-2")}
      {tick("top-1.5 right-0 border-t-2 border-r-2")}
      {tick("bottom-1.5 left-0 border-b-2 border-l-2")}
      {tick("bottom-1.5 right-0 border-b-2 border-r-2")}
    </>
  );
}

/* The right half of a frame. Each one is the figure made visible, and each is
 * deliberately a different mark so the strip never repeats itself. `live` gates
 * the animation so a frame only performs while it is actually in the gate. */
function Art({ kind, n = 0, palette = [], live }) {
  if (kind === "tally") {
    // struck in fives, the way a count is actually kept by hand
    const groups = Math.floor(n / 5);
    const rest = n % 5;
    return (
      <>
        {/* A phone cannot hold eight grouped fives, and truncating them would
            misstate the count. Same idea at the density that fits: one tick per
            tool, read as a measure. */}
        <span className="flex sm:hidden items-end gap-[2px]">
          {Array.from({ length: n }).map((_, k) => (
            <i key={k} className={live ? "tally-in" : "opacity-0"} style={{ animationDelay: `${k * 14}ms` }}>
              <span className={`block w-[2px] ${(k + 1) % 5 === 0 ? "h-5 bg-accent" : "h-3.5 bg-ink/60"}`} />
            </i>
          ))}
        </span>
        <span className="hidden sm:flex items-end gap-2.5">
        {Array.from({ length: groups }).map((_, g) => (
          <span key={g} className="relative inline-flex gap-[3px]">
            {Array.from({ length: 4 }).map((_, s) => (
              <i key={s} className={live ? "tally-in" : "opacity-0"}
                style={{ animationDelay: `${(g * 5 + s) * 22}ms` }}>
                <span className="block w-[2px] h-5 sm:h-6 bg-ink/70" />
              </i>
            ))}
            {/* the fifth stroke, laid across the other four */}
            <i className={`absolute inset-y-0 -left-0.5 -right-0.5 grid place-items-center ${live ? "tally-in" : "opacity-0"}`}
              style={{ animationDelay: `${(g * 5 + 4) * 22}ms` }}>
              <span className="block w-full h-[2px] bg-accent -rotate-12" />
            </i>
          </span>
        ))}
          {Array.from({ length: rest }).map((_, s) => (
            <i key={`r${s}`} className={live ? "tally-in" : "opacity-0"}
              style={{ animationDelay: `${(groups * 5 + s) * 22}ms` }}>
              <span className="block w-[2px] h-6 bg-ink/70" />
            </i>
          ))}
        </span>
      </>
    );
  }

  if (kind === "chips") {
    const colours = palette.length ? palette : Array.from({ length: n || 8 }, () => "#1C1714");
    return (
      <span className="flex items-center gap-1.5 sm:gap-2">
        {colours.slice(0, n || colours.length).map((c, k) => (
          <i key={k} className={live ? "chip-in" : "opacity-0"} style={{ animationDelay: `${k * 55}ms` }}>
            <span className="block w-4 h-4 sm:w-5 sm:h-5 rounded-[3px] border-2 border-ink" style={{ background: c }} />
          </i>
        ))}
      </span>
    );
  }

  if (kind === "meter") {
    return (
      <span className="flex items-center gap-3 w-full max-w-[8rem] sm:max-w-[13rem]">
        <span className="relative flex-1 h-2 rounded-full border-2 border-ink overflow-hidden">
          <span className={`absolute inset-0 bg-accent ${live ? "rule-in" : "scale-x-0"}`} />
        </span>
      </span>
    );
  }

  // "empty" — the slots a paid ranking would sit in, left blank and struck out
  return (
    <span className="relative flex items-center gap-1.5 sm:gap-2">
      {Array.from({ length: 6 }).map((_, k) => (
        <span key={k} className="block w-4 h-4 sm:w-5 sm:h-5 rounded-[3px] border-2 border-dashed border-ink/30" />
      ))}
      <span className={`absolute left-0 right-0 top-1/2 h-[2px] bg-accent ${live ? "rule-in" : "scale-x-0"}`}
        style={{ animationDelay: "700ms" }} />
    </span>
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
