import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { getCategories, getTools } from "../api/client.js";
import { ToolCard, SkeletonGrid } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";

const SORTS = [
  ["popular", "Most popular"], ["rating", "Highest rated"], ["az", "Name A–Z"],
  ["price-lo", "Price: low to high"], ["price-hi", "Price: high to low"],
];

export default function ToolsDirectory() {
  const [cats, setCats] = useState([]);
  const [active, setActive] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState("popular");
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(150);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getCategories().then(setCats).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 250); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    setLoading(true);
    const params = { sort, limit: 100 };
    if (active !== "all") params.category = active;
    if (debounced) params.search = debounced;
    if (minRating) params.minRating = minRating;
    if (maxPrice < 150) params.maxPrice = maxPrice;
    getTools(params).then(setData).catch(() => setData({ items: [] })).finally(() => setLoading(false));
  }, [active, debounced, sort, minRating, maxPrice]);

  // group results by category for the sectioned layout
  const grouped = useMemo(() => {
    const items = data?.items || [];
    const map = {};
    for (const t of items) {
      const k = t.category?.slug || "other";
      (map[k] = map[k] || { cat: t.category, tools: [] }).tools.push(t);
    }
    const order = cats.map((c) => c.slug);
    return Object.entries(map).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [data, cats]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 fade-in">
      <PageHead kicker="The index" title="The directory">
        Filter, search and browse every tool by category. Tap any card for the full honest rundown.
      </PageHead>

      {/* search */}
      <div className="flex items-center gap-3 border-2 border-ink rounded-full px-5 mb-6 max-w-lg bg-paper focus-within:outline focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-ink">
        <Search size={18} aria-hidden="true" className="shrink-0" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          type="search" aria-label="Search tools" autoComplete="off" spellCheck={false}
          placeholder="Search tools…"
          className="flex-1 bg-transparent py-3 outline-none text-base" />
      </div>

      {/* tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Tab on={active === "all"} onClick={() => setActive("all")}>All</Tab>
        {cats.map((c) => (
          <Tab key={c.slug} on={active === c.slug} color={c.colorPrimary} onClick={() => setActive(c.slug)}>
            {c.name}
          </Tab>
        ))}
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-4 mb-8 font-mono text-xs">
        <label className="flex items-center gap-2">SORT
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="border-2 border-ink bg-paper px-2 py-1">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">MIN RATING
          <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className="border-2 border-ink bg-paper px-2 py-1">
            <option value={0}>Any</option><option value={4}>4+</option><option value={4.5}>4.5+</option>
          </select>
        </label>
        <label className="flex items-center gap-2">MAX ${maxPrice}{maxPrice >= 150 ? "+" : ""}
          <input type="range" min="0" max="150" step="5" value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))} className="accent-accent" />
        </label>
      </div>

      {loading ? <SkeletonGrid count={6} /> : grouped.length === 0 ? (
        <p className="py-16 text-center font-mono text-ink2">No tools match those filters.</p>
      ) : (
        grouped.map(([slug, g]) => (
          <section key={slug} className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-4 h-4 rotate-45 border-2 border-ink" style={{ background: g.cat?.colorPrimary }} />
              <h2 className="font-display text-2xl md:text-3xl font-semibold">{g.cat?.name}</h2>
              <span className="flex-1 h-0.5 bg-ink" />
            </div>
            <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {g.tools.map((t) => <ToolCard key={t.slug} tool={t} />)}
            </Reveal>
          </section>
        ))
      )}
    </div>
  );
}

function Tab({ on, color, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`font-mono text-xs uppercase tracking-wide px-4 py-2 rounded-full border-2 border-ink transition-colors ${on ? "text-white" : "bg-paper hover:bg-paper2"}`}
      style={on ? { background: color || "#1C1714" } : undefined}>
      {children}
    </button>
  );
}
