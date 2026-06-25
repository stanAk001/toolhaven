import { useState, useEffect } from "react";
import { getCategories, getPosts } from "../api/client.js";
import { SkeletonGrid, PostCard } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";

export default function Blog() {
  const [cats, setCats] = useState([]);
  const [active, setActive] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getCategories().then(setCats).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    const params = active === "all" ? {} : { category: active };
    getPosts(params).then(setData).catch(() => setData({ items: [] })).finally(() => setLoading(false));
  }, [active]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 fade-in">
      <PageHead kicker="The reading room" title={<>Guides &amp; honest takes</>}>
        Comparisons, how-tos and straight talk on the tools worth your time.
      </PageHead>

      <div className="flex flex-wrap gap-2 mb-8">
        <Tab on={active === "all"} onClick={() => setActive("all")}>All</Tab>
        {cats.map((c) => (
          <Tab key={c.slug} on={active === c.slug} color={c.colorPrimary} onClick={() => setActive(c.slug)}>{c.name}</Tab>
        ))}
      </div>

      {loading ? <SkeletonGrid count={6} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" /> : (
        <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(data?.items || []).map((p) => <PostCard key={p.slug} post={p} />)}
        </Reveal>
      )}
    </div>
  );
}

function Tab({ on, color, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`font-mono text-xs uppercase tracking-wide px-4 py-2 rounded-full border-2 border-ink ${on ? "text-white" : "bg-paper hover:bg-paper2"}`}
      style={on ? { background: color || "#1C1714" } : undefined}>{children}</button>
  );
}
