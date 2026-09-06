// The index of best-of lists. Deliberately thin: its job is to route people
// (and crawlers) into the individual lists, which are where the value is.
import { Link } from "react-router-dom";
import { getBestLists } from "../api/client.js";
import { useData } from "../lib/helpers.jsx";
import { Loader } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";
import { Breadcrumbs } from "../components/breadcrumbs.jsx";
import { Seo, breadcrumbSchema } from "../lib/seo.jsx";

export default function BestIndex() {
  const { data, loading } = useData(getBestLists, []);
  const items = data?.items || [];
  const trail = [{ label: "Home", to: "/" }, { label: "Best of", to: "/best" }];

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-6 py-10 sm:py-12 fade-in">
      <Seo
        title="Best tools, by job"
        description="Shortlists for the decisions people actually make — the best tools for a job, compared on price, free tier and the catch on each."
        path="/best"
        schema={breadcrumbSchema(trail)}
      />
      <Breadcrumbs trail={trail} />
      <PageHead kicker="Best of" title="Shortlists, not long lists">
        One page per decision. Every pick carries its price, its free tier and its catch — and nobody paid for a place.
      </PageHead>

      {loading ? <Loader /> : items.length === 0 ? (
        <div className="border border-dashed border-rule rounded-card px-6 py-12 text-center">
          <p className="font-display text-xl sm:text-2xl font-semibold mb-2">No lists published yet.</p>
          <p className="text-ink2 max-w-measure-sm mx-auto text-pretty">
            In the meantime, the <Link to="/tools" className="underline underline-offset-2 hover:text-accentDeep">full directory</Link> has
            every tool we've reviewed.
          </p>
        </div>
      ) : (
        <Reveal stagger as="ul" className="border-t border-rule">
          {items.map((l) => (
            <li key={l.slug} className="border-b border-rule">
              <Link to={`/best/${l.slug}`}
                className="group flex items-start gap-4 sm:gap-6 py-6 px-1 transition-colors hover:bg-paper2/60">
                <div className="min-w-0 flex-1">
                  {l.category && (
                    <span className="font-mono text-micro uppercase tracking-[.16em] text-accentDeep block mb-1.5">
                      {l.category.name}
                    </span>
                  )}
                  <h2 className="font-display text-xl sm:text-2xl font-semibold leading-tight tracking-tight mb-1.5 text-balance">
                    {l.title}
                  </h2>
                  {l.subtitle && (
                    <p className="text-sm sm:text-base text-ink2 leading-snug text-pretty max-w-measure mb-3">{l.subtitle}</p>
                  )}
                  <span className="font-mono text-micro uppercase tracking-wide text-ink2">
                    {l.toolCount} tools · Updated {new Date(l.updatedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                  </span>
                </div>

                {/* the tools inside, as stacked monogram chips */}
                <span aria-hidden="true" className="hidden sm:flex items-center -space-x-2 shrink-0 pt-1">
                  {(l.entries || []).map((e, i) => (
                    <span key={e.tool.slug}
                      className="w-9 h-9 grid place-items-center rounded-full border border-rule font-display font-bold text-label text-white"
                      style={{ background: e.tool.category?.colorPrimary || "#0E1116", zIndex: 10 - i }}>
                      {e.tool.logoMono || e.tool.name[0]}
                    </span>
                  ))}
                </span>

                <span aria-hidden="true"
                  className="hidden sm:grid place-items-center w-9 h-9 rounded-full border border-rule shrink-0 mt-1 transition-all duration-300 group-hover:bg-ink group-hover:text-paper group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </li>
          ))}
        </Reveal>
      )}
    </div>
  );
}
