import { useState, useEffect, useMemo } from "react";
import { getPosts } from "../api/client.js";
import { SkeletonGrid, PostCard } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";
import { Breadcrumbs } from "../components/breadcrumbs.jsx";
import { Seo, breadcrumbSchema } from "../lib/seo.jsx";

export default function Blog() {
  const [active, setActive] = useState("all");
  const [posts, setPosts] = useState(null);
  const [loading, setLoading] = useState(true);

  // Every post, once. The archive is small enough that filtering in the browser
  // is instant, and — more importantly — having the whole set is what lets the
  // filter row show only the categories that actually contain something.
  useEffect(() => {
    getPosts().then((d) => setPosts(d?.items || [])).catch(() => setPosts([])).finally(() => setLoading(false));
  }, []);

  // A filter that always returns nothing is not a filter, it is a dead end.
  // This page offered twelve of them against eight posts, because the row was
  // built from the category list rather than from the archive.
  const facets = useMemo(() => {
    const counts = new Map();
    for (const p of posts || []) {
      const c = p.category;
      if (!c?.slug) continue;
      const seen = counts.get(c.slug) || { ...c, count: 0 };
      seen.count++;
      counts.set(c.slug, seen);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [posts]);

  const shown = active === "all" ? (posts || []) : (posts || []).filter((p) => p.category?.slug === active);

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-12 fade-in">
      <Seo
        title="Guides and honest takes on software"
        description="Comparisons, how-tos and straight talk on the tools worth your time — written by people who actually use them."
        path="/blog"
        schema={breadcrumbSchema([{ label: "Home", to: "/" }, { label: "Blog", to: "/blog" }])}
      />
      <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "Blog", to: "/blog" }]} />
      <PageHead kicker="The reading room" title={<>Guides &amp; honest takes</>}>
        Comparisons, how-tos and straight talk on the tools worth your time.
      </PageHead>

      {/* One scrolling line on a phone rather than a block of wrapping pills,
          and only the categories that have something in them. Each carries its
          count, so the row doubles as a picture of what the archive covers. */}
      {facets.length > 1 && (
        <div className="rail mb-8" role="group" aria-label="Filter posts by category">
          <Tab on={active === "all"} onClick={() => setActive("all")}>
            All <span className="tabular-nums opacity-55 ml-1.5">{posts?.length ?? 0}</span>
          </Tab>
          {facets.map((c) => (
            <Tab key={c.slug} on={active === c.slug} color={c.colorPrimary} onClick={() => setActive(c.slug)}>
              {c.name} <span className="tabular-nums opacity-55 ml-1.5">{c.count}</span>
            </Tab>
          ))}
        </div>
      )}

      {loading ? <SkeletonGrid count={6} className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5" />
        : shown.length === 0 ? (
          <div className="border-2 border-dashed border-ink/30 rounded-card px-6 py-14 text-center">
            <p className="font-display text-xl sm:text-2xl font-semibold text-balance mb-2">
              Nothing filed under that yet.
            </p>
            <p className="text-ink2 max-w-measure-sm mx-auto text-pretty mb-6">
              We only publish when we have something worth saying about a category.
            </p>
            <button type="button" onClick={() => setActive("all")} className="stamp">Show every piece</button>
          </div>
        ) : (
          <Reveal stagger className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {shown.map((p) => <PostCard key={p.slug} post={p} />)}
          </Reveal>
        )}
    </div>
  );
}

function Tab({ on, color, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`inline-flex items-center font-mono text-xs uppercase tracking-wide px-4 min-h-touch rounded-ui border-2 border-ink whitespace-nowrap transition-colors ${on ? "text-white" : "bg-paper hover:bg-paper2"}`}
      style={on ? { background: color || "#1C1714" } : undefined}>{children}</button>
  );
}
