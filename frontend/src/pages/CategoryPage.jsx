import { useParams } from "react-router-dom";
import { getCategory } from "../api/client.js";
import { useData, iconFor } from "../lib/helpers.jsx";
import { ToolCard, PostCard, Loader } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { NotFoundBlock } from "../components/editorial.jsx";

export default function CategoryPage() {
  const { slug } = useParams();
  const { data: cat, loading, error } = useData(() => getCategory(slug), [slug]);

  if (loading) return <Loader />;
  if (error || !cat) return <NotFoundBlock code="" kicker="Missing" title="Category not found."
    message="That category isn't on the shelf — it may have been renamed or removed." to="/tools" cta="Browse all tools →" />;

  const Icon = iconFor(cat.iconKey);
  const color = cat.colorPrimary;

  return (
    <div className="fade-in">
      <section className="relative border-b-2 border-ink overflow-hidden" style={{ background: color }}>
        <div className="halftone absolute inset-0 opacity-20 pointer-events-none" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-6 py-16 text-white">
          <div className="flex items-center gap-4 mb-4">
            <span className="w-14 h-14 grid place-items-center border-2 border-white"><Icon size={26} /></span>
            <span className="font-mono text-xs uppercase tracking-wide">{cat.tools?.length || 0} tools</span>
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-semibold mb-3">{cat.name}</h1>
          <p className="max-w-2xl text-white/90 text-lg">{cat.description}</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(cat.tools || []).map((t) => <ToolCard key={t.slug} tool={{ ...t, category: cat }} />)}
        </Reveal>
      </section>

      {cat.blogPosts?.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <h2 className="font-display text-2xl font-semibold border-b-2 border-ink pb-2 mb-5">Related reading</h2>
          <Reveal stagger className="grid sm:grid-cols-3 gap-4">
            {cat.blogPosts.map((p) => <PostCard key={p.slug} post={{ ...p, category: p.category || cat }} />)}
          </Reveal>
        </section>
      )}
    </div>
  );
}
