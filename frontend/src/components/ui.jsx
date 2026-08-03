import { useRef } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { iconFor, priceLabel } from "../lib/helpers.jsx";
import { Tilt } from "./motion.jsx";

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
    <div className="border-2 border-ink rounded-2xl p-4 sm:p-5 bg-paper" style={{ boxShadow: "4px 4px 0 var(--shadow-cast)" }}>
      {/* mirrors the card's own stack-then-inline header so nothing jumps on load */}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 mb-4">
        <span className="skeleton w-10 h-10 sm:w-12 sm:h-12 rounded-lg" />
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

export function ToolCard({ tool }) {
  const c = tool.category || {};
  const color = c.colorPrimary || "#7C3AED";
  const mono = tool.logoMono || tool.name[0];
  return (
    <Tilt className="h-full">
      <Link to={`/tool/${tool.slug}`} style={{ transformStyle: "preserve-3d" }}
        className="tactile group relative flex flex-col h-full rounded-2xl bg-paper border-2 border-ink p-4 sm:p-5">
        {/* One hover idea, not nine: the category colour floods up the card and
            the type inverts onto it. The ghost monogram is a printed mark and
            stays put — it isn't a third thing competing for the eye. */}
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[14px]">
          <span className="absolute inset-0 origin-bottom scale-y-0 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-y-100"
            style={{ background: color }} />
          <span className="absolute -right-3 -bottom-9 font-display text-[112px] sm:text-[150px] font-bold leading-none text-ink/[.05] transition-colors duration-500 group-hover:text-white/[.13]"
            aria-hidden="true">{mono}</span>
        </span>
        <CornerMarks />

        {/* the content rides forward on the Z-axis, floating above the plane */}
        <div className="relative flex flex-col h-full transition-colors duration-300 group-hover:text-white" style={{ transform: "translateZ(34px)" }}>
          {/* logo and category stack on a half-width card, sit side by side once there's room */}
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 mb-3">
            <span className="w-10 h-10 sm:w-12 sm:h-12 grid place-items-center shrink-0 rounded-lg font-display font-bold text-base sm:text-lg text-white border-2 border-ink transition-colors duration-300 group-hover:border-white/40"
              style={{ background: color }}>{mono}</span>
            <span className="font-mono text-[11px] uppercase tracking-[.1em] px-2 py-1 rounded-md text-white border-2 border-transparent max-w-full truncate transition-colors group-hover:bg-white/15 group-hover:border-white/40"
              style={{ background: color }}>{c.name}</span>
          </div>
          <h3 className="font-display text-lg sm:text-xl font-semibold mb-1 tracking-tight leading-tight">{tool.name}</h3>
          <span className="transition-colors group-hover:[&_em]:text-white/80"><Stars r={tool.rating} /></span>
          <p className="text-xs sm:text-sm text-ink2 leading-snug mt-2 mb-4 line-clamp-4 sm:line-clamp-none transition-colors group-hover:text-white/85">{tool.description}</p>
          <div className="flex items-center justify-between gap-2 font-mono text-[11px] sm:text-xs text-ink2 mt-auto transition-colors group-hover:text-white/90">
            <span className="tabular-nums">{priceLabel(tool)}</span>
            <span className="inline-flex items-center gap-2 shrink-0">
              {/* the words are a nicety; the disc carries the affordance when space is tight */}
              <span className="hidden sm:inline">Read review</span>
              <span className="grid place-items-center w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-ink transition-all duration-300 group-hover:border-white/50 group-hover:bg-white/10 group-hover:translate-x-1">→</span>
            </span>
          </div>
        </div>
      </Link>
    </Tilt>
  );
}

// CornerMarks — four crop-mark brackets that frame a card like a press sheet.
// They hold still. They're registration marks on a proof, not an animation: the
// card already has one thing that moves on hover, and that's enough.
function CornerMarks() {
  const base = "pointer-events-none absolute z-10 w-3.5 h-3.5 border-ink/70 transition-colors duration-300 group-hover:border-white/50";
  return (
    <>
      <span aria-hidden="true" className={`${base} top-2 left-2 border-t-2 border-l-2 rounded-tl-lg`} />
      <span aria-hidden="true" className={`${base} top-2 right-2 border-t-2 border-r-2 rounded-tr-lg`} />
      <span aria-hidden="true" className={`${base} bottom-2 left-2 border-b-2 border-l-2 rounded-bl-lg`} />
      <span aria-hidden="true" className={`${base} bottom-2 right-2 border-b-2 border-r-2 rounded-br-lg`} />
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
    <Link to={`/category/${category.slug}`} onMouseMove={onMove} onMouseLeave={onLeave}
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

        <span className="font-mono text-[11px] uppercase tracking-wide tabular-nums text-ink2 hidden sm:block shrink-0 transition-colors group-hover:text-white/80">
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
  const Icon = iconFor(category.iconKey);
  const color = category.colorPrimary || "#7C3AED";
  const preview = category.preview || [];
  const total = category.toolCount ?? 0;
  const extra = total - Math.min(preview.length, 5);        // five tiles shown
  const extraNarrow = total - Math.min(preview.length, 3);  // three, on a half-width card
  return (
    <Tilt className="h-full">
      <Link to={`/category/${category.slug}`} style={{ transformStyle: "preserve-3d" }}
        className="tactile tactile-lg group relative flex flex-col h-full rounded-2xl bg-paper border-2 border-ink p-4 sm:p-6">
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
            <span className="grid place-items-center w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-lg border-2 border-ink text-white transition-colors duration-300 group-hover:bg-white/15 group-hover:border-white/40"
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
                  className={`${i >= 3 ? "hidden sm:grid" : "grid"} place-items-center min-w-[1.75rem] sm:min-w-[1.9rem] h-7 sm:h-8 px-1.5 rounded-md border-2 border-ink bg-[var(--c)] text-white font-display text-xs sm:text-sm font-bold leading-none
                    transition-colors duration-300 group-hover:bg-white group-hover:text-ink group-hover:border-white`}>
                  {t.logoMono || t.name[0]}
                </span>
              ))}
              {extraNarrow > 0 && (
                <span className="sm:hidden font-mono text-[11px] text-ink2 transition-colors group-hover:text-white/75">+{extraNarrow}</span>
              )}
              {extra > 0 && (
                <span className="hidden sm:inline font-mono text-[11px] text-ink2 transition-colors group-hover:text-white/75">+{extra}</span>
              )}
            </div>
          )}

          <span className="font-mono text-[11px] sm:text-xs uppercase tracking-wide inline-flex items-center gap-2 transition-colors group-hover:text-white">
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
        className="tactile tactile-lg group relative flex flex-col h-full rounded-2xl bg-paper border-2 border-ink p-4 sm:p-5">
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[14px]">
          <span className="absolute inset-0 origin-bottom scale-y-0 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-y-100"
            style={{ background: color }} />
          <span className="absolute -right-2 -bottom-16 font-display text-[120px] sm:text-[190px] font-bold leading-none text-ink/[.05] transition-colors duration-500 group-hover:text-white/[.13]"
            aria-hidden="true">¶</span>
        </span>
        <CornerMarks />

        <div className="relative flex flex-col h-full transition-colors duration-300 group-hover:text-white" style={{ transform: "translateZ(34px)" }}>
          {c.name && (
            <span className="font-mono text-[11px] uppercase tracking-wide px-2 py-1 rounded-md text-white border-2 border-transparent self-start mb-3 transition-colors group-hover:border-white/40"
              style={{ background: color }}>{c.name}</span>
          )}
          <h3 className="font-display text-base sm:text-xl font-semibold mb-2 tracking-tight leading-tight">{post.title}</h3>
          <p className="text-xs sm:text-sm text-ink2 leading-snug mb-4 line-clamp-3 transition-colors group-hover:text-white/85">{post.excerpt}</p>
          <span className="font-mono text-[11px] sm:text-xs text-ink2 inline-flex items-center justify-between gap-2 mt-auto w-full transition-colors group-hover:text-white/90">
            {post.readTime ?? 5} min read
            <span className="grid place-items-center w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-full border-2 border-ink transition-all duration-300 group-hover:border-white/50 group-hover:bg-white/10 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </Link>
    </Tilt>
  );
}
