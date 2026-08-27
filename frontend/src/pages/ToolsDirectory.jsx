// The directory.
//
// The filters used to be three unrelated things floating one under another — a
// search pill, a ragged wrap of nine category buttons, and a strip of native
// selects wearing the operating system's chevron. Nothing told you how many
// tools you were looking at, and filtering yourself down to nothing left you on
// a single grey line with no way back.
//
// They are one panel now: search and the live count on the same line, the
// categories on a rail that scrolls rather than wraps, and the refinements
// underneath behind a rule. Every control is the paper's own. The count is the
// important part — a filter you cannot see the effect of is a guess.
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { getCategories, getTools } from "../api/client.js";
import { ToolCard, SkeletonGrid } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";
import { Breadcrumbs } from "../components/breadcrumbs.jsx";
import { Seo, breadcrumbSchema } from "../lib/seo.jsx";

const SORTS = [
  ["popular", "Most popular"], ["rating", "Highest rated"], ["az", "Name A–Z"],
  ["price-lo", "Price: low to high"], ["price-hi", "Price: high to low"],
];
const RATINGS = [[0, "Any rating"], [4, "4.0 and up"], [4.5, "4.5 and up"]];
const PRICE_CAP = 150;

export default function ToolsDirectory() {
  // A search is a place, not just a state: arriving from the cover, sharing a
  // result, or hitting Back should all land on the same list. The term lives in
  // the URL so all three work.
  const [params, setParams] = useSearchParams();
  const [cats, setCats] = useState([]);
  const [active, setActive] = useState(params.get("category") || "all");
  const [search, setSearch] = useState(params.get("search") || "");
  const [debounced, setDebounced] = useState(params.get("search") || "");
  const [sort, setSort] = useState("popular");
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(PRICE_CAP);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(null); // the unfiltered size of the library

  useEffect(() => { getCategories().then(setCats).catch(() => {}); }, []);
  useEffect(() => { getTools({ limit: 1 }).then((d) => setTotal(d.total ?? null)).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 250); return () => clearTimeout(t); }, [search]);

  // Keep the address bar in step with the two filters worth linking to, and
  // replace rather than push so Back leaves the directory instead of walking
  // letter by letter through what someone typed.
  useEffect(() => {
    const next = new URLSearchParams();
    if (debounced) next.set("search", debounced);
    if (active !== "all") next.set("category", active);
    setParams(next, { replace: true });
  }, [debounced, active, setParams]);

  useEffect(() => {
    setLoading(true);
    const params = { sort, limit: 100 };
    if (active !== "all") params.category = active;
    if (debounced) params.search = debounced;
    if (minRating) params.minRating = minRating;
    if (maxPrice < PRICE_CAP) params.maxPrice = maxPrice;
    getTools(params).then(setData).catch(() => setData({ items: [] })).finally(() => setLoading(false));
  }, [active, debounced, sort, minRating, maxPrice]);

  const items = data?.items || [];
  const narrowed = active !== "all" || !!debounced || minRating > 0 || maxPrice < PRICE_CAP;
  const reset = () => { setActive("all"); setSearch(""); setMinRating(0); setMaxPrice(PRICE_CAP); };

  // group results by category for the sectioned layout
  const grouped = useMemo(() => {
    const map = {};
    for (const t of items) {
      const k = t.category?.slug || "other";
      (map[k] = map[k] || { cat: t.category, tools: [] }).tools.push(t);
    }
    const order = cats.map((c) => c.slug);
    return Object.entries(map).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [items, cats]);

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-12 fade-in">
      <Seo
        title="All tools — browse and compare software"
        description="Browse every tool we've reviewed, filtered by category, rating and price. Independent write-ups that list the downsides as well as the features."
        path="/tools"
        schema={breadcrumbSchema([{ label: "Home", to: "/" }, { label: "Tools", to: "/tools" }])}
      />
      <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "Tools", to: "/tools" }]} />
      <PageHead kicker="The index" title="The directory">
        Filter, search and browse every tool by category. Tap any card for the full honest rundown.
      </PageHead>

      {/* ===== the filter bar — one surface, three registers ===== */}
      <section aria-label="Filter the directory"
        className="border-2 border-ink rounded-card bg-paper overflow-hidden mb-8"
        style={{ boxShadow: "4px 4px 0 var(--shadow-cast)" }}>

        {/* search + the count it affects, on the same line */}
        <div className="flex items-center gap-3 px-4 sm:px-5 border-b-2 border-ink">
          <Search size={18} strokeWidth={2.5} aria-hidden="true" className="shrink-0 text-accentDeep" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            type="search" aria-label="Search tools" autoComplete="off" spellCheck={false}
            placeholder="Search tools…"
            className="flex-1 min-w-0 bg-transparent min-h-[3.25rem] outline-none text-base" />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search"
              className="grid place-items-center w-9 h-9 shrink-0 rounded-full text-ink2 hover:text-accentDeep hover:bg-paper2 transition-colors">
              <X size={15} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
          <span aria-live="polite"
            className="shrink-0 font-mono text-micro uppercase tracking-[.12em] text-ink2 tabular-nums whitespace-nowrap">
            {loading ? "…"
              : narrowed && total ? <><span className="text-accentDeep">{items.length}</span> / {total}</>
                : `${items.length} tools`}
          </span>
        </div>

        {/* The categories, all of them, wrapped.
            They used to sit on a horizontal scroller with a fade at its edge,
            which meant a phone showed four of twelve and sliced the fifth down
            the middle. A filter you cannot see is not a filter, and the sliced
            chip was the single scruffiest thing on the page. Wrapping shows the
            whole index at every width; the chips are light enough to take it. */}
        <div className="px-4 sm:px-5 py-3.5 border-b-2 border-ink">
          <div className="flex flex-wrap gap-x-1.5 gap-y-2" role="group" aria-label="Filter by category">
            <Chip on={active === "all"} onClick={() => setActive("all")}>All</Chip>
            {cats.map((c) => (
              <Chip key={c.slug} on={active === c.slug} color={c.colorPrimary} onClick={() => setActive(c.slug)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </div>

        {/* The refinements. On a phone the two selects share a row and the price
            takes its own, instead of each wrapping onto a ragged line of its
            own; `sm:contents` dissolves that pairing once there is room. */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-x-5 px-4 sm:px-5 py-3">
          <span aria-hidden="true" className="hidden sm:inline-flex items-center gap-2 font-mono text-micro uppercase tracking-[.14em] text-ink2">
            <SlidersHorizontal size={14} strokeWidth={2.5} /> Refine
          </span>

          <div className="grid grid-cols-2 gap-2 sm:contents">
            <Field label="Sort" value={sort} onChange={(v) => setSort(v)} options={SORTS} />
            <Field label="Minimum rating" value={minRating} onChange={(v) => setMinRating(Number(v))} options={RATINGS} />
          </div>

          <label className="flex items-center gap-3 w-full sm:w-auto">
            <span className="font-mono text-micro uppercase tracking-[.08em] text-ink2 whitespace-nowrap tabular-nums">
              Under ${maxPrice}{maxPrice >= PRICE_CAP ? "+" : ""}
            </span>
            <input type="range" min="0" max={PRICE_CAP} step="5" value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              aria-label={`Maximum price: $${maxPrice}${maxPrice >= PRICE_CAP ? " or more" : ""} per month`}
              className="range flex-1 sm:flex-none sm:w-40"
              style={{ "--fill": `${(maxPrice / PRICE_CAP) * 100}%` }} />
          </label>

          {narrowed && (
            <button type="button" onClick={reset}
              className="inline-flex items-center justify-center gap-1.5 min-h-touch w-full sm:w-auto sm:ml-auto font-mono text-micro uppercase tracking-[.12em] text-accentDeep hover:text-ink border-2 border-ink/25 sm:border-0 rounded-ui transition-colors">
              <X size={13} strokeWidth={2.5} aria-hidden="true" /> Reset filters
            </button>
          )}
        </div>
      </section>

      {loading ? <SkeletonGrid count={6} /> : grouped.length === 0 ? (
        <div className="border-2 border-dashed border-ink/30 rounded-card px-6 py-14 text-center">
          <p className="font-display text-xl sm:text-2xl font-semibold text-balance mb-2">
            Nothing matches that combination.
          </p>
          <p className="text-ink2 max-w-measure-sm mx-auto text-pretty mb-6">
            {total ? `There are ${total} tools in the index — try widening the price, dropping the rating floor, or clearing the search.`
              : "Try widening the price, dropping the rating floor, or clearing the search."}
          </p>
          <button type="button" onClick={reset} className="stamp">Clear all filters</button>
        </div>
      ) : (
        grouped.map(([slug, g]) => (
          <section key={slug} className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span aria-hidden="true" className="w-4 h-4 rotate-45 border-2 border-ink shrink-0" style={{ background: g.cat?.colorPrimary }} />
              <h2 className="font-display text-2xl md:text-3xl font-semibold">{g.cat?.name}</h2>
              <span aria-hidden="true" className="font-mono text-micro uppercase tracking-wide text-ink2 tabular-nums shrink-0">
                {g.tools.length}
              </span>
              <span aria-hidden="true" className="flex-1 h-0.5 bg-ink" />
            </div>
            <Reveal stagger className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {g.tools.map((t) => <ToolCard key={t.slug} tool={t} showCategory={false} />)}
            </Reveal>
          </section>
        ))
      )}
    </div>
  );
}

// A select wearing the paper's furniture: the native chevron is suppressed and
// our own caret drawn in ink, so it themes with everything else.
function Field({ label, value, onChange, options }) {
  return (
    <label className="field-wrap items-center w-full sm:w-auto">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field w-full sm:w-auto">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <span className="field-caret" aria-hidden="true"><ChevronDown size={15} strokeWidth={2.5} /></span>
    </label>
  );
}

/**
 * A category, set as an index entry rather than a button.
 *
 * Twelve identical heavy-bordered rectangles was most of why this panel read as
 * cluttered: every one of them shouted at the same volume, and none of them
 * said which category it was until you read the word. The colour does that job
 * now — a small square of the category's own ink, which is the same mark used
 * on the section heads further down the page — and the border drops to a
 * hairline until the thing is actually selected.
 */
function Chip({ on, color, onClick, children }) {
  return (
    // "All" has no category colour of its own, so it takes ink-on-paper from
    // the theme rather than a hard-coded dark hex — which was invisible against
    // the night edition's near-black background.
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`group/chip inline-flex items-center gap-2 font-mono text-label uppercase tracking-[.06em]
        px-3 min-h-touch sm:min-h-[36px] rounded-ui whitespace-nowrap transition-colors border-2
        ${on
          ? (color ? "text-white" : "bg-ink text-paper border-ink")
          : "border-ink/25 text-ink2 hover:text-ink hover:border-ink hover:bg-paper2"}`}
      style={on && color ? { background: color, borderColor: color } : undefined}>
      {color && (
        <span aria-hidden="true"
          className={`w-2 h-2 rotate-45 shrink-0 transition-colors ${on ? "bg-white/80" : ""}`}
          style={on ? undefined : { background: color }} />
      )}
      {children}
    </button>
  );
}
