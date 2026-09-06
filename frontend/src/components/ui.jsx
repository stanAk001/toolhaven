import { Link } from "react-router-dom";
import { Star, ArrowUpRight } from "lucide-react";
import { iconFor, priceLabel, priceLabelShort } from "../lib/helpers.jsx";
import { ToolLogo } from "./toollogo.jsx";
import { useIntentPrefetch } from "../lib/prefetchlink.jsx";
import { getTool, getCategory } from "../api/client.js";

export function Stars({ r = 0, size = 13, showNum = true }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Rated ${Number(r).toFixed(1)} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} strokeWidth={0} aria-hidden="true"
          fill={i < Math.round(r) ? "#C8841E" : "rgb(var(--ink) / .18)"} />
      ))}
      {showNum && <em className="not-italic font-mono text-xs text-ink2 ml-1.5 tabular-nums">{Number(r).toFixed(1)}</em>}
    </span>
  );
}

export function Loader({ label = "Loading…" }) {
  return (
    <div className="py-20 text-center font-mono text-sm text-ink2" role="status" aria-live="polite">
      <span className="inline-block w-4 h-4 mr-2 align-middle border border-rule border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

// A single placeholder card that mirrors a ToolCard's shape while data loads.
export function CardSkeleton() {
  return (
    <div className="border border-rule rounded-card p-4 sm:p-5 bg-paper" >
      {/* mirrors the card's own stack-then-inline header so nothing jumps on load */}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 mb-4">
        <span className="skeleton w-10 h-10 sm:w-12 sm:h-12 rounded-ui" />
        <span className="skeleton h-5 w-20 sm:w-24 rounded" />
      </div>
      <span className="skeleton block h-6 w-3/4 mb-3 rounded" />
      <span className="skeleton block h-3 w-1/3 mb-4 rounded" />
      <span className="skeleton block h-3 w-full mb-1.5 rounded" />
      <span className="skeleton block h-3 w-5/6 rounded" />
    </div>
  );
}

// A grid of skeleton cards — drop-in replacement for <Loader/> in card sections.
export function SkeletonGrid({ count = 6, className = "grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" }) {
  return (
    <>
      <span className="sr-only" role="status">Loading…</span>
      <div className={className} aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </>
  );
}

export function Caret({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22"
      style={{ transition: "transform .35s cubic-bezier(.2,.8,.2,1)", transform: open ? "rotate(180deg)" : "none" }}>
      <path d="M5 9 C 8 12.5, 10 14.5, 12 15.5 C 14 14.5, 16 12.5, 19 9"
        fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A tool, as a listing.
 *
 * This used to be seven identical rounded cards in a row, each one carrying a
 * filled category chip directly underneath a heading that already named the
 * category, a 3D tilt that followed the pointer, a colour flood on hover, a
 * ghost monogram and a set of corner brackets. Five decorative ideas, and not
 * one of them told you whether the tool was any good.
 *
 * What it carries now is the thing a reader is actually deciding: what this is,
 * who it suits, and what to watch out for. Both halves come from the editorial
 * record — nothing here is generated to fill the space, and a tool with no
 * caveat on file simply shows one fewer line.
 */
/**
 * The rating, as a printed mark.
 *
 * One lockup, whatever the source: the figure large enough to be the card's
 * focal point, the scale and the provenance set small underneath it. A reader
 * learns to read it once and can then scan a whole grid of them.
 *
 * Renders nothing when there is nothing to show — a blank corner is a fairer
 * account of "we have not gathered this yet" than any placeholder.
 */
function RatingMark({ tool, className = "" }) {
  const own = Number(tool.reviewCount) >= 3;
  const value = own ? Number(tool.rating).toFixed(1) : tool.topRating?.rating;
  if (value === undefined || value === null) return null;
  const outOf = own ? 5 : tool.topRating.maxRating;
  const source = own ? "Readers" : tool.topRating.sourceName;

  return (
    <div className={`shrink-0 text-right leading-none pt-0.5 ${className}`}>
      <span className="font-display text-lg sm:text-[28px] font-semibold tabular-nums">{value}</span>
      <span className="font-mono text-nano text-ink2 tabular-nums">/{outOf}</span>
      {/* The source is the first thing to go when the card is half a phone
          wide — the figure and the scale still say everything a listing needs,
          and the tool page carries the provenance in full. */}
      <span className="hidden sm:block font-mono text-nano uppercase tracking-[.14em] text-ink2 mt-1">{source}</span>
    </div>
  );
}

export function ToolCard({ tool, showCategory = true }) {
  // By the time the click lands, the tool page usually already has its data.
  const intent = useIntentPrefetch(() => getTool(tool.slug), [tool.slug]);
  const c = tool.category || {};
  const color = c.colorPrimary || "#7C3AED";

  return (
    <Link
      to={`/tools/${tool.slug}`}
      {...intent}
      className="group relative flex flex-col h-full rounded-card bg-paper border border-rule
        shadow-press transition-[transform,box-shadow] duration-200 ease-out
        hover:-translate-y-0.5 hover:shadow-press-lg focus-visible:-translate-y-0.5"
    >
      {/* The category's colour as a printed head-rule. On hover it inks up —
          one idea, carried by the element that already identifies the card,
          instead of a tilt and a flood and a watermark all at once. */}
      <span aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] rounded-t-card origin-top transition-transform duration-200 ease-out group-hover:scale-y-[2.2]"
        style={{ background: color }} />

      {/* Two cards fit across a phone, so the card has to work at about a
          hundred and seventy pixels. Rather than shrink the full listing until
          every line truncates, the phone gets a deliberately shorter one:
          identity, score and price — enough to choose what to open. The
          description and the trade-off return the moment there is room for
          them to be read rather than clipped. */}
      <div className="flex flex-col h-full p-3 sm:p-5 pt-4 sm:pt-6">
        {/* Half a phone wide, a name and a score cannot share a line — "Midjourney"
            and "4.4/5" simply collide. So on a phone the mark sits opposite the
            logo and the name takes the full width beneath them; from `sm` the row
            un-wraps into logo, name, score. One set of markup, ordered by the
            flex container rather than duplicated per breakpoint. */}
        <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1.5 sm:flex-nowrap sm:gap-3 mb-2.5 sm:mb-3.5">
          <ToolLogo tool={tool} size={32} className="shrink-0 sm:hidden" />
          <ToolLogo tool={tool} size={40} className="shrink-0 hidden sm:block sm:order-1" />

          {/* The score, set as a score. Everything on this card used to sit
              between 11px and 20px, which left the eye nowhere to land — the
              scale jump is what gives a listing a focal point, and a rating is
              the one number worth being the focus. */}
          <RatingMark tool={tool} className="ml-auto sm:order-3" />

          <div className="basis-full sm:basis-auto sm:order-2 min-w-0 sm:flex-1">
            <h3 className="font-display text-base sm:text-2xl font-semibold leading-tight sm:leading-none tracking-tight text-balance">
              {tool.name}
            </h3>
            {showCategory && (
              <span className="block font-mono text-nano uppercase tracking-[.12em] sm:tracking-[.16em] mt-1 sm:mt-1.5 truncate text-ink2">
                {c.name}
              </span>
            )}
          </div>
        </div>

        <p className="hidden sm:block text-sm text-ink2 leading-snug line-clamp-2 mb-4">{tool.description}</p>

        {/* The trade-off, set as a reference entry: the label hangs in the
            margin and the text runs on, second line aligning under the first.
            It is how a spec sheet or a dictionary is set, it scans down a
            column far better than stacked labels, and it costs no decoration. */}
        {(tool.bestFor || tool.caveat) && (
          <dl className="hidden sm:block border-t border-rule pt-3 mb-4 space-y-1.5">
            {tool.bestFor && (
              <div className="text-sm leading-snug line-clamp-2">
                <dt className="inline font-mono text-nano uppercase tracking-[.12em] text-accentDeep whitespace-nowrap">Best for</dt>
                <span aria-hidden="true" className="text-ink2/40"> &mdash; </span>
                <dd className="inline">{tool.bestFor}</dd>
              </div>
            )}
            {tool.caveat && (
              <div className="text-sm text-ink2 leading-snug line-clamp-2">
                <dt className="inline font-mono text-nano uppercase tracking-[.12em] text-ink2 whitespace-nowrap">Watch for</dt>
                <span aria-hidden="true" className="text-ink2/40"> &mdash; </span>
                <dd className="inline">{tool.caveat}</dd>
              </div>
            )}
          </dl>
        )}

        {/* Both halves are set to stay on one line. Uppercase tracking pushed
           this row onto two lines at three-up, which knocked the footers of a
           row out of alignment — the exact thing a grid is for. */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-2.5 sm:pt-3 border-t border-rule">
          <span className="font-mono text-nano text-ink2 tabular-nums whitespace-nowrap">{priceLabelShort(tool)}</span>
          <span className="font-mono text-nano text-ink shrink-0 whitespace-nowrap inline-flex items-center gap-1.5">
            <span className="hidden sm:inline">Read review</span>
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
          </span>
        </div>
      </div>
    </Link>
  );
}


// CategoryRow — one line of the index.
//
// This used to flood the whole row with the category's colour on hover, invert
// the copy to white, roll the name over to an italic copy of itself and drag a
// magnetic arrow after the cursor. Four animations to say one thing: this row is
// the one you are pointing at. A ground that shifts one step, a swatch that
// widens and a rule that darkens do the same job without the row changing
// colour scheme under the reader mid-scan. The category's colour is still on the
// row — it is the swatch, where it identifies rather than decorates.
export function CategoryRow({ category, n = 0, preview = [] }) {
  const Icon = iconFor(category.iconKey);
  const color = category.colorPrimary || "#0E1116";

  return (
    <Link to={`/categories/${category.slug}`}
      className="group relative flex items-center gap-3 md:gap-5 border-b border-rule px-3 md:px-5 py-3.5 md:py-4
        transition-colors duration-150 hover:bg-paper2">

      {/* the category's colour, as a measured swatch rather than a wash */}
      <span aria-hidden="true"
        className="absolute left-0 inset-y-0 w-[3px] transition-[width] duration-200 ease-out group-hover:w-[5px]"
        style={{ background: color }} />

      <span className="font-mono text-xs tabular-nums w-6 md:w-8 shrink-0 text-ink2">
        {String(n).padStart(2, "0")}
      </span>

      <span className="grid place-items-center w-8 h-8 shrink-0 rounded-tight border border-rule text-ink2
        transition-colors group-hover:text-ink group-hover:border-ink2/40">
        <Icon size={16} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="font-display text-base md:text-lg font-semibold leading-tight tracking-tight truncate">
          {category.name}
        </h3>
        <p className="text-xs md:text-sm text-ink2 mt-0.5 truncate">{category.description}</p>
      </div>

      {/* a sample of what is inside — always visible, not revealed on hover: a
          reader scanning the index wants to see it without pointing at it */}
      {preview.length > 0 && (
        <div className="hidden lg:flex items-center gap-1 shrink-0">
          {preview.slice(0, 3).map((t) => (
            <span key={t.slug} title={t.name}
              className="w-7 h-7 grid place-items-center rounded-tight border border-rule bg-surface
                font-mono text-nano font-semibold text-ink2">
              {t.logoMono || t.name[0]}
            </span>
          ))}
        </div>
      )}

      <span className="font-mono text-micro uppercase tracking-[.1em] tabular-nums text-ink2 hidden sm:block shrink-0 w-20 text-right">
        {category.toolCount ?? 0} tools
      </span>

      <ArrowUpRight size={16} aria-hidden="true"
        className="shrink-0 text-ink2 transition-[transform,color] duration-150 group-hover:text-ink
          group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}

// CategoryCard — the same information as a card, in the card language ToolCard
// already established: a hairline frame and the category's colour as a head-rule
// that thickens. It used to carry a 3D tilt, a colour flood rising from the
// bottom, a 132px ghost icon bleeding off the corner, four crop-mark corners and
// a full inversion of every text colour to white — five effects at once.
export function CategoryCard({ category }) {
  const intent = useIntentPrefetch(() => getCategory(category.slug), [category.slug]);
  const Icon = iconFor(category.iconKey);
  const color = category.colorPrimary || "#0E1116";
  const preview = category.preview || [];
  const total = category.toolCount ?? 0;
  const extra = total - Math.min(preview.length, 5);        // five tiles shown
  const extraNarrow = total - Math.min(preview.length, 3);  // three, on a half-width card

  return (
    <Link to={`/categories/${category.slug}`} {...intent}
      className="group relative flex flex-col h-full rounded-card bg-surface border border-rule
        shadow-press transition-[transform,box-shadow] duration-200 ease-out
        hover:-translate-y-0.5 hover:shadow-press-lg focus-visible:-translate-y-0.5">

      <span aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] rounded-t-card origin-top transition-transform duration-200 ease-out group-hover:scale-y-[2.2]"
        style={{ background: color }} />

      <div className="flex flex-col h-full p-4 sm:p-6 pt-5 sm:pt-7">
        <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
          <span className="grid place-items-center w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-tight text-white"
            style={{ background: color }}>
            <Icon size={18} aria-hidden="true" />
          </span>
          <span className="font-mono text-nano sm:text-micro uppercase tracking-[.12em] tabular-nums text-ink2 whitespace-nowrap pt-1">
            {total} tools
          </span>
        </div>

        <h3 className="font-display text-lg sm:text-2xl font-semibold mb-1 tracking-tight leading-tight">{category.name}</h3>
        <p className="text-xs sm:text-sm text-ink2 leading-snug mb-4 line-clamp-3 sm:line-clamp-2">{category.description}</p>

        {/* what is actually inside, as a contact strip. It wraps rather than
            clips: below ~360px three tiles plus the count are wider than half a
            screen, and a cut-off "+3" reads as a bug. */}
        {preview.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4 mt-auto">
            {preview.slice(0, 5).map((t, i) => (
              <span key={t.slug} title={t.name}
                className={`${i >= 3 ? "hidden sm:grid" : "grid"} place-items-center min-w-[1.75rem] h-7 px-1.5
                  rounded-tight border border-rule bg-paper2 text-ink2 font-mono text-nano font-semibold leading-none`}>
                {t.logoMono || t.name[0]}
              </span>
            ))}
            {extraNarrow > 0 && <span className="sm:hidden font-mono text-nano text-ink2">+{extraNarrow}</span>}
            {extra > 0 && <span className="hidden sm:inline font-mono text-nano text-ink2">+{extra}</span>}
          </div>
        )}

        <span className="font-mono text-nano sm:text-micro uppercase tracking-[.12em] text-ink inline-flex items-center gap-1.5 mt-auto pt-3 border-t border-rule">
          Explore
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
        </span>
      </div>
    </Link>
  );
}

// PostCard — a blog post in the same language as the tool and category cards:
// a hairline frame, the category's colour as a head-rule, and one movement on
// hover. It used to carry a 3D tilt, a rising colour flood, a giant ghost
// pilcrow and four crop-mark corners, all at once, to say the same thing.
export function PostCard({ post }) {
  const c = post.category || {};
  const color = c.colorPrimary || "#0E1116";
  return (
    <Link to={`/blog/${post.slug}`}
      className="group relative flex flex-col h-full rounded-card bg-surface border border-rule
        shadow-press transition-[transform,box-shadow] duration-200 ease-out
        hover:-translate-y-0.5 hover:shadow-press-lg focus-visible:-translate-y-0.5">

      <span aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] rounded-t-card origin-top transition-transform duration-200 ease-out group-hover:scale-y-[2.2]"
        style={{ background: color }} />

      <div className="flex flex-col h-full p-4 sm:p-5 pt-5 sm:pt-6">
        {c.name && (
          <span className="font-mono text-nano uppercase tracking-[.14em] mb-2 text-ink2">{c.name}</span>
        )}
        <h3 className="font-display text-base sm:text-xl font-semibold mb-2 tracking-tight leading-tight text-balance">{post.title}</h3>
        <p className="text-xs sm:text-sm text-ink2 leading-snug mb-4 line-clamp-3">{post.excerpt}</p>
        <span className="font-mono text-nano uppercase tracking-[.12em] text-ink2 inline-flex items-center justify-between gap-2 mt-auto w-full pt-3 border-t border-rule">
          {post.readTime ?? 5} min read
          <span aria-hidden="true" className="text-ink transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
        </span>
      </div>
    </Link>
  );
}
