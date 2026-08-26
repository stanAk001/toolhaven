import { useRef } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { iconFor, priceLabel, priceLabelShort } from "../lib/helpers.jsx";
import { Tilt } from "./motion.jsx";
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
      <span className="inline-block w-4 h-4 mr-2 align-middle border-2 border-ink border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

// A single placeholder card that mirrors a ToolCard's shape while data loads.
export function CardSkeleton() {
  return (
    <div className="border-2 border-ink rounded-card p-4 sm:p-5 bg-paper" style={{ boxShadow: "4px 4px 0 var(--shadow-cast)" }}>
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
      className="group relative flex flex-col h-full rounded-card bg-paper border-2 border-ink
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
              <span className="block font-mono text-nano uppercase tracking-[.12em] sm:tracking-[.16em] mt-1 sm:mt-1.5 truncate" style={{ color }}>
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
          <dl className="hidden sm:block border-t-2 border-ink/10 pt-3 mb-4 space-y-1.5">
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
        <div className="flex items-center justify-between gap-2 mt-auto pt-2.5 sm:pt-3 border-t-2 border-ink/10">
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

function CornerMarks() {
  const base = "pointer-events-none absolute z-10 w-3.5 h-3.5 border-ink/70 transition-colors duration-300 group-hover:border-white/50";
  return (
    <>
      <span aria-hidden="true" className={`${base} top-2 left-2 border-t-2 border-l-2 rounded-tl-ui`} />
      <span aria-hidden="true" className={`${base} top-2 right-2 border-t-2 border-r-2 rounded-tr-ui`} />
      <span aria-hidden="true" className={`${base} bottom-2 left-2 border-b-2 border-l-2 rounded-bl-ui`} />
      <span aria-hidden="true" className={`${base} bottom-2 right-2 border-b-2 border-r-2 rounded-br-ui`} />
    </>
  );
}

// CategoryRow — the broadsheet's contents index. A full-width row per category,
// set in big display type; on hover the category's own colour floods in from the
// left (with a halftone wash over it), the copy inverts to white, the icon tile
// lights up, a few of that category's tool logos slide in, and the arrow trails
// the cursor magnetically as it moves across the row.
export function CategoryRow({ category, n = 0, preview = [] }) {
  const Icon = iconFor(category.iconKey);
  const color = category.colorPrimary || "#7C3AED";
  const arrowRef = useRef(null);

  // The magnetic arrow: as the cursor crosses the row, the arrow drifts toward
  // it. We write the transform straight to the node (cheap; no re-render) and a
  // CSS transition smooths the chase. Skipped under reduced-motion.
  const onMove = (e) => {
    if (!arrowRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 … 0.5
    arrowRef.current.style.transform = `translateX(${(rel * 20).toFixed(1)}px)`;
  };
  const onLeave = () => { if (arrowRef.current) arrowRef.current.style.transform = ""; };

  return (
    <Link to={`/categories/${category.slug}`} onMouseMove={onMove} onMouseLeave={onLeave}
      className="group relative block border-b-2 border-ink overflow-hidden">
      {/* the colour wipe + a printed halftone over it */}
      <span aria-hidden="true"
        className="absolute inset-0 origin-left scale-x-0 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-x-100"
        style={{ background: color }} />
      <span aria-hidden="true"
        className="halftone absolute inset-0 opacity-0 mix-blend-multiply transition-opacity duration-500 group-hover:opacity-25" />

      <div className="relative flex items-center gap-3 md:gap-5 px-3 md:px-5 py-4 md:py-5 transition-colors duration-300 group-hover:text-white">
        {/* a white rail grows up the left edge as the row lights up */}
        <span aria-hidden="true"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-0 bg-white transition-[height] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:h-3/5" />

        <span className="font-mono text-xs md:text-sm tabular-nums w-6 md:w-9 shrink-0 text-ink2 transition-colors group-hover:text-white/60">
          {String(n).padStart(2, "0")}
        </span>
        <span className="grid place-items-center w-10 h-10 shrink-0 border-2 border-ink text-white transition-colors duration-300 group-hover:bg-white/15 group-hover:border-white/40"
          style={{ background: color }}>
          <Icon size={18} aria-hidden="true" className="transition-transform duration-300 group-hover:scale-110" />
        </span>
        <div className="min-w-0 flex-1">
          {/* kinetic roll: the roman name lifts away, an italic copy rolls up */}
          <h3 className="relative block overflow-hidden font-display text-lg md:text-2xl font-semibold leading-[1.15] tracking-tight whitespace-nowrap">
            <span className="block transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-full">{category.name}</span>
            <span aria-hidden="true"
              className="absolute inset-0 block italic translate-y-full transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:translate-y-0">{category.name}</span>
          </h3>
          <p className="text-xs md:text-sm text-ink2 mt-0.5 truncate transition-colors group-hover:text-white/85">{category.description}</p>
        </div>

        {/* a peek at the category's tools — logos slide in, stacked, on hover */}
        {preview.length > 0 && (
          <div className="hidden lg:flex items-center -space-x-2 shrink-0 opacity-0 translate-x-4 transition-[opacity,transform] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:opacity-100 group-hover:translate-x-0">
            {preview.slice(0, 3).map((t, i) => (
              <span key={t.slug} title={t.name}
                className="w-8 h-8 grid place-items-center border-2 border-white bg-paper text-ink font-display font-bold text-xs"
                style={{ transitionDelay: `${140 + i * 70}ms` }}>
                {t.logoMono || t.name[0]}
              </span>
            ))}
          </div>
        )}

        <span className="font-mono text-label uppercase tracking-wide tabular-nums text-ink2 hidden sm:block shrink-0 transition-colors group-hover:text-white/80">
          {category.toolCount ?? 0} tools
        </span>
        {/* magnetic arrow, riding inside a disc that rings white on hover */}
        <span ref={arrowRef} aria-hidden="true"
          className="grid place-items-center w-9 h-9 shrink-0 rounded-full border-2 border-transparent transition-[transform,border-color,background-color] duration-300 ease-out group-hover:border-white/40 group-hover:bg-white/10 will-change-transform">
          <span className="font-mono text-lg leading-none">→</span>
        </span>
      </div>
    </Link>
  );
}

export function CategoryCard({ category }) {
  const intent = useIntentPrefetch(() => getCategory(category.slug), [category.slug]);
  const Icon = iconFor(category.iconKey);
  const color = category.colorPrimary || "#7C3AED";
  const preview = category.preview || [];
  const total = category.toolCount ?? 0;
  const extra = total - Math.min(preview.length, 5);        // five tiles shown
  const extraNarrow = total - Math.min(preview.length, 3);  // three, on a half-width card
  return (
    <Tilt className="h-full">
      <Link to={`/categories/${category.slug}`} {...intent} style={{ transformStyle: "preserve-3d" }}
        className="tactile tactile-lg group relative flex flex-col h-full rounded-card bg-paper border-2 border-ink p-4 sm:p-6">
        {/* one move: the colour floods up and the type inverts onto it */}
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[14px]">
          <span className="absolute inset-0 origin-bottom scale-y-0 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-y-100"
            style={{ background: color }} />
          <span className="absolute -right-6 -bottom-7 text-ink/[.06] transition-colors duration-500 group-hover:text-white/[.13]">
            <Icon size={132} strokeWidth={1.2} />
          </span>
        </span>
        <CornerMarks />

        {/* the content rides forward on the Z-axis, floating above the plane */}
        <div className="relative flex flex-col h-full transition-colors duration-300 group-hover:text-white" style={{ transform: "translateZ(34px)" }}>
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-5">
            <span className="grid place-items-center w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-ui border-2 border-ink text-white transition-colors duration-300 group-hover:bg-white/15 group-hover:border-white/40"
              style={{ background: color }}>
              <Icon size={22} aria-hidden="true" />
            </span>
            <span className="font-mono text-micro sm:text-xs tabular-nums text-ink2 whitespace-nowrap transition-colors group-hover:text-white/70">{category.toolCount ?? 0} tools</span>
          </div>
          <h3 className="font-display text-lg sm:text-2xl font-semibold mb-1 tracking-tight leading-tight">{category.name}</h3>
          {/* clamped at two-up, full at wider widths — the copy is a taster, not the article */}
          <p className="text-xs sm:text-sm text-ink2 leading-snug mb-4 line-clamp-3 sm:line-clamp-none transition-colors group-hover:text-white/85">{category.description}</p>

          {/* the real tools inside, as a contact strip — colour tiles at rest that
              flip to paper-white when the card floods on hover */}
          {/* The strip wraps rather than clips: below ~360px three tiles plus the
              count are wider than half a screen, and a cut-off "+3" reads as a bug. */}
          {preview.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-4 sm:mb-5 mt-auto">
              {/* three tiles fit a half-width card, five fit a full one — the
                  overflow count is stated for whichever set is actually shown */}
              {preview.slice(0, 5).map((t, i) => (
                <span key={t.slug} title={t.name} style={{ "--c": color }}
                  className={`${i >= 3 ? "hidden sm:grid" : "grid"} place-items-center min-w-[1.75rem] sm:min-w-[1.9rem] h-7 sm:h-8 px-1.5 rounded-ui border-2 border-ink bg-[var(--c)] text-white font-display text-xs sm:text-sm font-bold leading-none
                    transition-colors duration-300 group-hover:bg-white group-hover:text-ink group-hover:border-white`}>
                  {t.logoMono || t.name[0]}
                </span>
              ))}
              {extraNarrow > 0 && (
                <span className="sm:hidden font-mono text-label text-ink2 transition-colors group-hover:text-white/75">+{extraNarrow}</span>
              )}
              {extra > 0 && (
                <span className="hidden sm:inline font-mono text-label text-ink2 transition-colors group-hover:text-white/75">+{extra}</span>
              )}
            </div>
          )}

          <span className="font-mono text-label sm:text-xs uppercase tracking-wide inline-flex items-center gap-2 transition-colors group-hover:text-white">
            Explore
            <span className="grid place-items-center w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-ink transition-all duration-300 group-hover:border-white/50 group-hover:bg-white/10 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </Link>
    </Tilt>
  );
}

// PostCard — a blog post in the same card language as the tool/category cards:
// rounded frame, aurora rim, colour flood, cursor spotlight, crop corners, 3D
// parallax. Its ghost is a giant pilcrow ¶, the editor's mark.
export function PostCard({ post }) {
  const c = post.category || {};
  const color = c.colorPrimary || "#1C1714";
  return (
    <Tilt className="h-full">
      <Link to={`/blog/${post.slug}`} style={{ transformStyle: "preserve-3d" }}
        className="tactile tactile-lg group relative flex flex-col h-full rounded-card bg-paper border-2 border-ink p-4 sm:p-5">
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[14px]">
          <span className="absolute inset-0 origin-bottom scale-y-0 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-y-100"
            style={{ background: color }} />
          <span className="absolute -right-2 -bottom-16 font-display text-[120px] sm:text-[190px] font-bold leading-none text-ink/[.05] transition-colors duration-500 group-hover:text-white/[.13]"
            aria-hidden="true">¶</span>
        </span>
        <CornerMarks />

        <div className="relative flex flex-col h-full transition-colors duration-300 group-hover:text-white" style={{ transform: "translateZ(34px)" }}>
          {c.name && (
            <span className="font-mono text-label uppercase tracking-wide px-2 py-1 rounded-ui text-white border-2 border-transparent self-start mb-3 transition-colors group-hover:border-white/40"
              style={{ background: color }}>{c.name}</span>
          )}
          <h3 className="font-display text-base sm:text-xl font-semibold mb-2 tracking-tight leading-tight">{post.title}</h3>
          <p className="text-xs sm:text-sm text-ink2 leading-snug mb-4 line-clamp-3 transition-colors group-hover:text-white/85">{post.excerpt}</p>
          <span className="font-mono text-label sm:text-xs text-ink2 inline-flex items-center justify-between gap-2 mt-auto w-full transition-colors group-hover:text-white/90">
            {post.readTime ?? 5} min read
            <span className="grid place-items-center w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-full border-2 border-ink transition-all duration-300 group-hover:border-white/50 group-hover:bg-white/10 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </Link>
    </Tilt>
  );
}
