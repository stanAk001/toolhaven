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
    <div className="border-2 border-ink p-5 bg-paper" style={{ boxShadow: "4px 4px 0 var(--shadow-cast)" }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="skeleton w-12 h-12" />
        <span className="skeleton h-5 w-24" />
      </div>
      <span className="skeleton block h-6 w-3/4 mb-3" />
      <span className="skeleton block h-3 w-1/3 mb-4" />
      <span className="skeleton block h-3 w-full mb-1.5" />
      <span className="skeleton block h-3 w-5/6" />
    </div>
  );
}

// A grid of skeleton cards — drop-in replacement for <Loader/> in card sections.
export function SkeletonGrid({ count = 6, className = "grid sm:grid-cols-2 lg:grid-cols-3 gap-4" }) {
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
      <Link to={`/tool/${tool.slug}`} onMouseMove={spotlightMove} style={{ transformStyle: "preserve-3d" }}
        className="tactile group relative flex flex-col h-full rounded-2xl bg-paper border-2 border-ink p-5">
        <Aurora color={color} />
        {/* clipped background plane (Z0): colour flood, halftone, ghost monogram */}
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[14px]">
          <span className="absolute inset-0 origin-bottom scale-y-0 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-y-100"
            style={{ background: color }} />
          <span className="halftone absolute inset-0 opacity-0 mix-blend-multiply transition-opacity duration-500 group-hover:opacity-25" />
          <span style={SPOTLIGHT}
            className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="absolute -right-3 -bottom-9 font-display font-bold leading-none text-ink/[.05] transition-all duration-500 ease-out group-hover:text-white/15 group-hover:scale-110 group-hover:-rotate-6"
            style={{ fontSize: "150px" }}>{mono}</span>
        </span>
        <CornerMarks />

        {/* the content rides forward on the Z-axis, floating above the plane */}
        <div className="relative flex flex-col h-full transition-colors duration-300 group-hover:text-white" style={{ transform: "translateZ(34px)" }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-12 h-12 grid place-items-center rounded-lg font-display font-bold text-lg text-white border-2 border-ink transition-all duration-300 group-hover:border-white/40 group-hover:-rotate-3 group-hover:scale-105"
              style={{ background: color }}>{mono}</span>
            <span className="font-mono text-[11px] uppercase tracking-wide px-2 py-1 rounded-md text-white border-2 border-transparent transition-colors group-hover:border-white/40"
              style={{ background: color }}>{c.name}</span>
          </div>
          <h3 className="font-display text-xl font-semibold mb-1 tracking-tight">{tool.name}</h3>
          <span className="transition-colors group-hover:[&_em]:text-white/80"><Stars r={tool.rating} /></span>
          <p className="text-sm text-ink2 leading-snug mt-2 mb-4 transition-colors group-hover:text-white/85">{tool.description}</p>
          <div className="flex items-center justify-between font-mono text-xs text-ink2 mt-auto transition-colors group-hover:text-white/90">
            <span className="tabular-nums">{priceLabel(tool)}</span>
            <span className="inline-flex items-center gap-2">
              Read review
              <span className="grid place-items-center w-7 h-7 rounded-full border-2 border-ink transition-all duration-300 group-hover:border-white/50 group-hover:bg-white/10 group-hover:translate-x-1">→</span>
            </span>
          </div>
        </div>
      </Link>
    </Tilt>
  );
}

// Writes the cursor's position into CSS vars on the card, so a radial-gradient
// "spotlight" layer can track the mouse. Cheap — just two custom properties, no
// React state, no re-render.
function spotlightMove(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
  el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
}

// The travelling sheen itself — a soft light that follows the cursor and blends
// into whatever is beneath it, fading in only on hover.
const SPOTLIGHT = {
  background: "radial-gradient(240px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,.55), transparent 55%)",
  mixBlendMode: "soft-light",
};

// Aurora — a comet of light that orbits the card's rim in its category colour.
// A big conic-gradient spins behind the card; the paper face covers the centre,
// so only a glowing band sweeps around the edge. Hover-only, and it rides just
// behind the card on the Z-axis so it parallaxes with the 3D tilt.
function Aurora({ color }) {
  return (
    <span aria-hidden="true"
      className="pointer-events-none absolute -inset-[3px] rounded-[18px] overflow-hidden opacity-0 blur-[1px] transition-opacity duration-300 group-hover:opacity-100"
      style={{ transform: "translateZ(-1px)" }}>
      <span className="absolute left-1/2 top-1/2 aspect-square w-[170%] -translate-x-1/2 -translate-y-1/2 animate-spin [animation-duration:4s] motion-reduce:hidden"
        style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${color} 45deg, #fff 70deg, ${color} 95deg, transparent 150deg, transparent 360deg)` }} />
    </span>
  );
}

// CornerMarks — four crop-mark brackets that frame a card like a press sheet.
// At rest they sit just inside the box in ink; on hover they snap out to the
// corners and turn white, focusing the frame as the colour floods in.
function CornerMarks() {
  const base = "pointer-events-none absolute z-10 w-3.5 h-3.5 border-ink transition-all duration-300 group-hover:border-white";
  return (
    <>
      <span aria-hidden="true" className={`${base} top-2 left-2 border-t-2 border-l-2 rounded-tl-lg group-hover:-translate-x-0.5 group-hover:-translate-y-0.5`} />
      <span aria-hidden="true" className={`${base} top-2 right-2 border-t-2 border-r-2 rounded-tr-lg group-hover:translate-x-0.5 group-hover:-translate-y-0.5`} />
      <span aria-hidden="true" className={`${base} bottom-2 left-2 border-b-2 border-l-2 rounded-bl-lg group-hover:-translate-x-0.5 group-hover:translate-y-0.5`} />
      <span aria-hidden="true" className={`${base} bottom-2 right-2 border-b-2 border-r-2 rounded-br-lg group-hover:translate-x-0.5 group-hover:translate-y-0.5`} />
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
  const extra = (category.toolCount ?? 0) - preview.length;
  return (
    <Tilt className="h-full">
      <Link to={`/category/${category.slug}`} onMouseMove={spotlightMove} style={{ transformStyle: "preserve-3d" }}
        className="tactile tactile-lg group relative flex flex-col h-full rounded-2xl bg-paper border-2 border-ink p-6">
        <Aurora color={color} />
        {/* clipped background plane (Z0): colour flood, halftone, ghost icon */}
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[14px]">
          <span className="absolute inset-0 origin-bottom scale-y-0 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-y-100"
            style={{ background: color }} />
          <span className="halftone absolute inset-0 opacity-0 mix-blend-multiply transition-opacity duration-500 group-hover:opacity-25" />
          <span style={SPOTLIGHT}
            className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="absolute -right-6 -bottom-7 text-ink/[.06] transition-all duration-500 ease-out group-hover:text-white/15 group-hover:scale-110 group-hover:-rotate-6">
            <Icon size={132} strokeWidth={1.2} />
          </span>
        </span>
        <CornerMarks />

        {/* the content rides forward on the Z-axis, floating above the plane */}
        <div className="relative flex flex-col h-full transition-colors duration-300 group-hover:text-white" style={{ transform: "translateZ(34px)" }}>
          <div className="flex items-center justify-between mb-5">
            <span className="grid place-items-center w-12 h-12 rounded-lg border-2 border-ink text-white transition-all duration-300 group-hover:bg-white/15 group-hover:border-white/40 group-hover:-rotate-6 group-hover:scale-110"
              style={{ background: color }}>
              <Icon size={22} aria-hidden="true" />
            </span>
            <span className="font-mono text-xs tabular-nums text-ink2 transition-colors group-hover:text-white/70">{category.toolCount ?? 0} tools</span>
          </div>
          <h3 className="font-display text-2xl font-semibold mb-1 tracking-tight">{category.name}</h3>
          <p className="text-sm text-ink2 leading-snug mb-4 transition-colors group-hover:text-white/85">{category.description}</p>

          {/* the real tools inside, as a contact strip — colour tiles at rest that
              flip to paper-white when the card floods on hover */}
          {preview.length > 0 && (
            <div className="flex items-center gap-1.5 mb-5 mt-auto">
              {preview.slice(0, 5).map((t) => (
                <span key={t.slug} title={t.name} style={{ "--c": color }}
                  className="grid place-items-center min-w-[1.9rem] h-8 px-1.5 rounded-md border-2 border-ink bg-[var(--c)] text-white font-display text-sm font-bold leading-none
                    transition-colors duration-300 group-hover:bg-white group-hover:text-ink group-hover:border-white">
                  {t.logoMono || t.name[0]}
                </span>
              ))}
              {extra > 0 && (
                <span className="font-mono text-[11px] text-ink2 transition-colors group-hover:text-white/75">+{extra}</span>
              )}
            </div>
          )}

          <span className="font-mono text-xs uppercase tracking-wide inline-flex items-center gap-2 transition-colors group-hover:text-white">
            Explore
            <span className="grid place-items-center w-7 h-7 rounded-full border-2 border-ink transition-all duration-300 group-hover:border-white/50 group-hover:bg-white/10 group-hover:translate-x-1">→</span>
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
      <Link to={`/blog/${post.slug}`} onMouseMove={spotlightMove} style={{ transformStyle: "preserve-3d" }}
        className="tactile tactile-lg group relative flex flex-col h-full rounded-2xl bg-paper border-2 border-ink p-5">
        <Aurora color={color} />
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[14px]">
          <span className="absolute inset-0 origin-bottom scale-y-0 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-y-100"
            style={{ background: color }} />
          <span className="halftone absolute inset-0 opacity-0 mix-blend-multiply transition-opacity duration-500 group-hover:opacity-25" />
          <span style={SPOTLIGHT}
            className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="absolute -right-2 -bottom-16 font-display font-bold leading-none text-ink/[.05] transition-all duration-500 ease-out group-hover:text-white/15 group-hover:scale-110 group-hover:-rotate-6"
            style={{ fontSize: "190px" }}>¶</span>
        </span>
        <CornerMarks />

        <div className="relative flex flex-col h-full transition-colors duration-300 group-hover:text-white" style={{ transform: "translateZ(34px)" }}>
          {c.name && (
            <span className="font-mono text-[11px] uppercase tracking-wide px-2 py-1 rounded-md text-white border-2 border-transparent self-start mb-3 transition-colors group-hover:border-white/40"
              style={{ background: color }}>{c.name}</span>
          )}
          <h3 className="font-display text-xl font-semibold mb-2 tracking-tight">{post.title}</h3>
          <p className="text-sm text-ink2 leading-snug mb-4 line-clamp-3 transition-colors group-hover:text-white/85">{post.excerpt}</p>
          <span className="font-mono text-xs text-ink2 inline-flex items-center gap-2 mt-auto transition-colors group-hover:text-white/90">
            {post.readTime ?? 5} min read
            <span className="grid place-items-center w-7 h-7 rounded-full border-2 border-ink transition-all duration-300 group-hover:border-white/50 group-hover:bg-white/10 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </Link>
    </Tilt>
  );
}
