
// Inline article diagrams — generated SVG/flex illustrations that explain a
// concept in the post, drawn in the same risograph/print language as the rest
// of the site. Authored from the markdown via an image token, e.g.
//   ![Notion:flexible canvas|Asana:structured system](fig:vs "Same problem, opposite ends.")
// where the src after `fig:` picks the diagram, the alt carries pipe-separated
// `label:caption` items, and the markdown title becomes the caption.
import { Fragment } from "react";

// parse the alt string "A:desc|B:desc" into [{label, caption}]
function parseItems(alt = "") {
  return alt.split("|").map((s) => {
    const i = s.indexOf(":");
    return i === -1
      ? { label: s.trim(), caption: "" }
      : { label: s.slice(0, i).trim(), caption: s.slice(i + 1).trim() };
  }).filter((it) => it.label);
}

function Frame({ caption, children }) {
  return (
    <figure className="my-9">
      <div className="relative rounded-2xl border-2 border-ink bg-paper2/40 p-5 md:p-7 overflow-hidden"
        style={{ boxShadow: "5px 5px 0 var(--shadow-cast)" }}>
        <span className="halftone absolute inset-0 opacity-[.06] pointer-events-none" aria-hidden="true" />
        <div className="relative">{children}</div>
      </div>
      {caption && (
        <figcaption className="mt-2.5 font-mono text-[11px] uppercase tracking-[.16em] text-ink2 text-center">{caption}</figcaption>
      )}
    </figure>
  );
}

// A left-to-right numbered process; stacks on mobile.
function Steps({ items, color }) {
  return (
    <ol className="flex flex-col sm:flex-row sm:items-start">
      {items.map((it, i) => (
        <Fragment key={i}>
          <li className="flex-1 flex flex-col items-center text-center gap-2 px-2">
            <span className="grid place-items-center w-11 h-11 rounded-full text-white font-display font-bold text-lg shrink-0"
              style={{ background: color, boxShadow: "2px 2px 0 var(--shadow-cast)" }}>{i + 1}</span>
            <span className="font-display font-semibold leading-tight">{it.label}</span>
            {it.caption && <span className="font-mono text-[11px] text-ink2 leading-snug">{it.caption}</span>}
          </li>
          {i < items.length - 1 && (
            <span aria-hidden="true" className="hidden sm:grid place-items-center text-accent font-bold text-2xl pt-1.5">→</span>
          )}
        </Fragment>
      ))}
    </ol>
  );
}

// Horizontal ranking/comparison bars; caption value drives the fill.
function Bars({ items, color }) {
  const max = Math.max(...items.map((it) => Number(it.caption) || 0), 1);
  return (
    <div className="space-y-3">
      {items.map((it, i) => {
        const val = Number(it.caption) || 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-24 sm:w-32 shrink-0 font-mono text-[11px] sm:text-xs uppercase tracking-wide truncate">{it.label}</span>
            <div className="flex-1 h-6 rounded-full border-2 border-ink bg-paper overflow-hidden">
              <div className="h-full rounded-r-full transition-all" style={{ width: `${Math.max(8, (val / max) * 100)}%`, background: color }} />
            </div>
            <span className="w-7 text-right font-mono text-xs tabular-nums">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

// Two contenders, head to head, with an inked VS between.
function Versus({ items, color }) {
  const card = (t, key) => (
    <div key={key} className="rounded-xl border-2 border-ink bg-paper p-4 flex flex-col gap-1.5" style={{ boxShadow: "2px 2px 0 var(--shadow-cast)" }}>
      <span className="inline-flex items-center gap-2 font-display text-lg font-semibold leading-tight">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />{t.label}
      </span>
      {t.caption && <span className="font-mono text-[11px] text-ink2 leading-snug">{t.caption}</span>}
    </div>
  );
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
      {card(items[0], "a")}
      <span className="grid place-items-center w-9 h-9 rounded-full bg-ink text-paper font-display font-bold text-sm shrink-0">VS</span>
      {card(items[1], "b")}
    </div>
  );
}

// A rising ladder of tiers — last rung flagged in accent.
function Tiers({ items, color }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <div key={i} className="flex-1 rounded-xl border-2 border-ink bg-paper p-4 text-center"
            style={{ boxShadow: "2px 2px 0 var(--shadow-cast)", minHeight: `${88 + i * 16}px` }}>
            <span className="block font-mono text-[10px] uppercase tracking-[.18em] mb-1" style={{ color: last ? "#E8431F" : undefined }}>
              {last ? "Top tier" : `Tier ${i + 1}`}
            </span>
            <span className="block font-display text-lg font-semibold leading-tight">{it.label}</span>
            {it.caption && <span className="block font-mono text-[11px] text-ink2 mt-1">{it.caption}</span>}
          </div>
        );
      })}
    </div>
  );
}

// A grid of labelled tiles — a "toolkit" / lineup at a glance.
function Stack({ items, color }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-xl border-2 border-ink bg-paper p-3.5 flex items-start gap-2.5" style={{ boxShadow: "2px 2px 0 var(--shadow-cast)" }}>
          <span className="grid place-items-center w-9 h-9 rounded-lg text-white font-display font-bold shrink-0" style={{ background: color }}>
            {it.label[0]}
          </span>
          <span className="min-w-0">
            <span className="block font-display font-semibold leading-tight truncate">{it.label}</span>
            {it.caption && <span className="block font-mono text-[11px] text-ink2 leading-snug">{it.caption}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

const TYPES = { steps: Steps, bars: Bars, vs: Versus, tiers: Tiers, stack: Stack };

export function BlogFigure({ src = "", alt = "", title = "", color = "#1C1714" }) {
  const type = (src.split("fig:")[1] || "stack").trim();
  const Cmp = TYPES[type] || Stack;
  const items = parseItems(alt);
  if (!items.length) return null;
  return <Frame caption={title}><Cmp items={items} color={color} /></Frame>;
}
