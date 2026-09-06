// A best-of page: the one thing on the site that answers a commercial-intent
// search directly ("best accounting software").
//
// The structure is deliberate. Selection criteria come *before* the picks, so
// the reader knows what the ranking means before they read it. Every entry
// carries its catch. And the figures in the table are read live from each Tool
// row rather than copied in, so a list written today can't be quoting stale
// pricing next quarter.
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowUpRight } from "lucide-react";
import { getBestList } from "../api/client.js";
import { useData, goAffiliate, priceLabel } from "../lib/helpers.jsx";
import { Stars, Loader } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { NotFoundBlock, SectionHead } from "../components/editorial.jsx";
import { Breadcrumbs } from "../components/breadcrumbs.jsx";
import { ShareBar } from "../components/share.jsx";
import { Seo, breadcrumbSchema, SITE_URL } from "../lib/seo.jsx";

export default function BestList() {
  const { slug } = useParams();
  const { data: list, loading, error } = useData(() => getBestList(slug), [slug]);

  if (loading) return <Loader />;
  if (error || !list) {
    return (
      <>
        <Seo title="List not found" path={`/best/${slug}`} noIndex />
        <NotFoundBlock code="" kicker="Missing" title="That list isn't in print."
          message="It may have been renamed or unpublished." to="/best" cta="All best-of lists →" />
      </>
    );
  }

  const entries = list.entries || [];
  const trail = [
    { label: "Home", to: "/" },
    { label: "Best of", to: "/best" },
    { label: list.title, to: `/best/${list.slug}` },
  ];

  // ItemList tells a crawler this page ranks things, and in what order. The FAQ
  // block is only emitted when questions are actually rendered on the page.
  const schema = [
    breadcrumbSchema(trail),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: list.title,
      description: list.subtitle || undefined,
      numberOfItems: entries.length,
      itemListElement: entries.map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: e.tool.name,
        url: `${SITE_URL}/tools/${e.tool.slug}`,
      })),
    },
    ...(list.faqs?.length
      ? [{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: list.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      }]
      : []),
  ];

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-6 py-10 sm:py-12 fade-in">
      <Seo
        title={list.title}
        description={list.subtitle || `${entries.length} tools compared on price, free tier and the catch on each. Independent picks — nobody paid for a place.`}
        path={`/best/${list.slug}`}
        type="article"
        schema={schema}
      />
      <Breadcrumbs trail={trail} />

      <header className="mb-8">
        <div className="rule-2 mb-4 sm:mb-5" />
        <p className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-3">
          Best of{list.category ? ` · ${list.category.name}` : ""}
        </p>
        <h1 className="font-display text-display font-semibold text-balance">{list.title}</h1>
        {list.subtitle && (
          <p className="text-base sm:text-lg text-ink2 mt-4 max-w-measure text-pretty">{list.subtitle}</p>
        )}
        <p className="font-mono text-micro uppercase tracking-[.14em] text-ink2 mt-4">
          {entries.length} tools · Updated {new Date(list.updatedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          <span className="text-accent"> · No paid placements</span>
        </p>
      </header>

      {list.audience && (
        <p className="border-l-4 border-accent pl-4 py-1 mb-8 text-pretty max-w-measure">
          <span className="font-mono text-micro uppercase tracking-[.14em] text-accentDeep block mb-1">Who this is for</span>
          {list.audience}
        </p>
      )}

      {list.intro && (
        <div className="prose-editorial max-w-measure mb-10">
          <ReactMarkdown>{list.intro}</ReactMarkdown>
        </div>
      )}

      {/* How the picks were made, stated before the picks themselves. */}
      {list.criteria && (
        <section className="border border-rule rounded-card bg-paper2/40 p-5 sm:p-6 mb-10">
          <h2 className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-3">How we chose</h2>
          <div className="prose-editorial max-w-measure text-sm">
            <ReactMarkdown>{list.criteria}</ReactMarkdown>
          </div>
          <Link to="/how-we-review"
            className="inline-flex items-center gap-1.5 min-h-touch font-mono text-micro uppercase tracking-wide mt-2 hover:text-accentDeep transition-colors">
            Our full review method <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        </section>
      )}

      {/* the summary table — scan first, read after */}
      {entries.length > 0 && (
        <section className="mb-12">
          <SectionHead folio="01" kicker="At a glance" title="The shortlist" />
          <div className="cmp-wrap border border-rule rounded-card bg-paper">
            <table className="cmp w-full text-sm border-collapse">
              <caption className="sr-only">{list.title} — summary of all {entries.length} picks</caption>
              <thead>
                <tr>
                  <th scope="col" className="cmp-corner">Tool</th>
                  <th scope="col" className="cmp-head">Best for</th>
                  <th scope="col" className="cmp-head">Price</th>
                  <th scope="col" className="cmp-head">Free tier</th>
                  <th scope="col" className="cmp-head">Rating</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <th scope="row" className="cmp-label !normal-case !tracking-normal">
                      <Link to={`/tools/${e.tool.slug}`} className="font-display text-base font-semibold text-ink hover:text-accentDeep transition-colors">
                        {e.tool.name}
                      </Link>
                      {e.award && <span className="block text-accentDeep mt-0.5">{e.award}</span>}
                    </th>
                    <td className="cmp-cell cmp-prose">{e.tool.bestFor || "—"}</td>
                    <td className="cmp-cell tabular-nums whitespace-nowrap">{priceLabel(e.tool)}</td>
                    <td className="cmp-cell">{e.tool.freeTier ? "Yes" : "No"}</td>
                    <td className="cmp-cell"><Stars r={e.tool.rating} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* the picks in full */}
      <SectionHead folio="02" kicker="In detail" title="Every pick, and its catch" />
      <Reveal stagger as="ol" className="border-t border-rule mb-12">
        {entries.map((e, i) => <Entry key={e.id} entry={e} rank={i + 1} listSlug={list.slug} />)}
      </Reveal>

      {list.faqs?.length > 0 && (
        <section className="mb-12">
          <SectionHead folio="03" kicker="Before you pick" title="Common questions" />
          <dl className="border-t border-rule">
            {list.faqs.map((f) => (
              <div key={f.id} className="border-b border-rule py-5">
                <dt className="font-display text-lg sm:text-xl font-semibold mb-2 text-balance">{f.question}</dt>
                <dd className="text-ink2 leading-relaxed text-pretty max-w-measure">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {list.related?.length > 0 && (
        <section>
          <SectionHead folio="04" kicker="Keep reading" title="Related lists" />
          <ul className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            {list.related.map((rl) => (
              <li key={rl.slug}>
                <Link to={`/best/${rl.slug}`}
                  className="tactile block h-full border border-rule rounded-card bg-paper p-5 hover:bg-paper2/60 transition-colors">
                  <span className="font-display text-lg font-semibold leading-tight block mb-1">{rl.title}</span>
                  {rl.subtitle && <span className="text-sm text-ink2 leading-snug line-clamp-2">{rl.subtitle}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t border-rule mt-12 pt-6">
        <ShareBar context="best" title={list.title} />
      </div>

      <p className="font-mono text-label uppercase tracking-[.12em] text-ink2 mt-8 text-pretty">
        Some outbound links are partner links. They never affect the order of this list.{" "}
        <Link to="/disclosure" className="underline underline-offset-2 hover:text-accentDeep transition-colors">How we make money</Link>
      </p>
    </div>
  );
}

function Entry({ entry, rank, listSlug }) {
  const t = entry.tool;
  const color = t.category?.colorPrimary || "#7C3AED";

  return (
    <li className="border-b border-rule py-6">
      <div className="flex items-start gap-4 sm:gap-6">
        <span aria-hidden="true"
          className="folio font-display font-semibold leading-[.72] text-ink/15 select-none shrink-0 tabular-nums text-[clamp(2rem,6vw,3.5rem)] w-[1.6em] text-right">
          {String(rank).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
            <span aria-hidden="true"
              className="w-10 h-10 grid place-items-center rounded-ui border border-rule font-display font-bold text-sm text-white shrink-0"
              style={{ background: color }}>
              {t.logoMono || t.name[0]}
            </span>
            <h3 className="font-display text-xl sm:text-2xl font-semibold leading-none tracking-tight">
              <Link to={`/tools/${t.slug}`} className="hover:text-accentDeep transition-colors">{t.name}</Link>
            </h3>
            {entry.award && (
              <span className="font-mono text-micro uppercase tracking-wide px-2 py-1 rounded-ui bg-accent text-white">
                {entry.award}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
            <Stars r={t.rating} />
            <span className="font-mono text-xs tabular-nums text-ink2">{priceLabel(t)}</span>
            {t.freeTrial && <span className="font-mono text-micro uppercase tracking-wide text-accentDeep">Free trial</span>}
          </div>

          <p className="text-sm sm:text-base text-ink2 leading-snug text-pretty max-w-measure mb-3">
            {entry.blurb || t.description}
          </p>

          {t.pros?.length > 0 && (
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mb-3 max-w-measure">
              {t.pros.map((p) => (
                <li key={p.id} className="flex gap-2 text-sm text-ink2">
                  <span aria-hidden="true" className="shrink-0 mt-[.45em] w-1.5 h-1.5 bg-accent" />
                  <span>{p.text}</span>
                </li>
              ))}
            </ul>
          )}

          {t.caveat && (
            <p className="text-sm leading-snug text-pretty max-w-measure mb-4">
              <span className="font-mono text-micro uppercase tracking-[.14em] text-accentDeep mr-2">The catch</span>
              <span className="text-ink2">{t.caveat}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => goAffiliate(t, `best/${listSlug}`)} className="stamp text-xs">
              Try {t.name} <ArrowUpRight size={13} aria-hidden="true" />
            </button>
            <Link to={`/tools/${t.slug}`}
              className="inline-flex items-center min-h-touch font-mono text-xs uppercase tracking-wide hover:text-accentDeep transition-colors">
              Full review →
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
