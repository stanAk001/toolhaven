// Letters to the editor — reader testimonials staged as clippings pinned to a
// board: each on a hard risograph shadow, set a degree or two off-square, and
// snapping straight when you point at it. Punchy social proof in the paper's voice.
import { Reveal } from "./motion.jsx";

// initials from a name, for the inked monogram disc
function monogram(name = "") {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// a five-star rule, struck in accent ink; spent stars fade rather than vanish
function Stars({ n = 5 }) {
  return (
    <div className="flex gap-0.5 text-accent text-sm leading-none" role="img" aria-label={`Rated ${n} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden="true" className={i < n ? "" : "opacity-20"}>★</span>
      ))}
    </div>
  );
}

// the tilts the cards are pinned at — cycled so the board never looks gridded
const TILTS = [-1.4, 0.9, -0.6, 1.3, -1, 0.7, -1.2, 1.1, -0.5];

export function TestimonialCard({ t, tilt = 0, compact = false }) {
  return (
    <figure
      style={{ "--tilt": `${tilt}deg` }}
      className={`group/t relative bg-paper border border-rule rounded-card flex flex-col
        rotate-[var(--tilt)] hover:rotate-0 hover:-translate-y-1 transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]
        ${compact ? "p-4 sm:p-5" : "p-4 sm:p-6 md:p-7"}`}>
      {/* the thumbtack holding the clipping to the board */}
      <span aria-hidden="true"
        className={`absolute -top-2.5 ${compact ? "left-4 sm:left-5 w-3.5 h-3.5" : "left-5 sm:left-7 w-3.5 h-3.5 sm:w-4 sm:h-4"} rounded-full bg-accent border border-rule
          transition-transform duration-300 group-hover/t:scale-110`} />
      {/* the oversized opening quote, ghosted into the corner like set type */}
      <span aria-hidden="true"
        className={`absolute top-2 right-3 sm:right-4 font-display font-semibold text-accent/15 select-none leading-none
          ${compact ? "text-title" : "text-display"}`}>&#10078;</span>

      <Stars n={Math.round(t.rating)} />
      {/* a two-up clipping is half the measure, so the quote is set a size down
          rather than reflowed to four words a line */}
      <blockquote className={`relative mt-2.5 sm:mt-3 font-display font-medium leading-snug text-pretty flex-1
        ${compact ? "text-sm sm:text-base md:text-lg" : "text-sm sm:text-lg md:text-xl"}`}>
        {t.content}
      </blockquote>

      <figcaption className={`flex items-center gap-2.5 sm:gap-3 border-t border-rule ${compact ? "mt-3.5 pt-3" : "mt-4 sm:mt-6 pt-3 sm:pt-4"}`}>
        {/* the monogram disc only repeats the name beside it — below 360px that
            trade isn't worth the ~40px it steals from the byline */}
        <span aria-hidden="true"
          className={`hidden min-[360px]:grid place-items-center rounded-ui bg-ink text-paper font-mono tracking-wide shrink-0
          ${compact ? "w-8 h-8 sm:w-9 sm:h-9 text-label" : "w-8 h-8 sm:w-10 sm:h-10 text-label sm:text-xs"}`}>
          {monogram(t.userName)}
        </span>
        {/* wraps on a half-width clipping, truncates once there's a line to spare —
            a byline cut to "AISHA RAHM…" is worse than one set over two lines */}
        <span className="leading-tight min-w-0">
          <span className="block font-mono text-label sm:text-xs uppercase tracking-wide break-words sm:truncate">{t.userName}</span>
          {t.userTitle && (
            <span className="block font-mono text-label uppercase tracking-wide text-ink2 break-words sm:truncate">{t.userTitle}</span>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

// A trimmed three-up strip for narrower contexts (e.g. the About page).
export function TestimonialStrip({ items = [] }) {
  return (
    <Reveal stagger className="grid sm:grid-cols-3 gap-4">
      {items.map((t, i) => (
        <TestimonialCard key={t.id} t={t} compact tilt={[-1, 0.8, -0.7][i % 3]} />
      ))}
    </Reveal>
  );
}

// The full board: a masonry of clippings that deals itself out on scroll.
export function TestimonialWall({ items = [] }) {
  return (
    // Masonry rather than a grid: clippings are different lengths, and columns
    // let a short letter sit under a long one instead of padding every card to
    // the tallest in its row.
    <Reveal stagger className="columns-2 lg:columns-3 gap-3 sm:gap-4 [column-fill:_balance]">
      {items.map((t, i) => (
        <div key={t.id} className="break-inside-avoid mb-3 sm:mb-4">
          <TestimonialCard t={t} tilt={TILTS[i % TILTS.length]} />
        </div>
      ))}
    </Reveal>
  );
}
