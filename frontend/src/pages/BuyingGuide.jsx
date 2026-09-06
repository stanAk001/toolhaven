/**
 * A buying guide.
 *
 * The order of this page is an argument about credibility. What we looked at
 * and how we chose comes before what we recommend, because a recommendation
 * whose method is hidden below the affiliate links is a sales page. The
 * disclosure sits near the top for the same reason — putting it in the footer
 * is technically compliant and practically a way of not being read.
 *
 * Nothing here prints a price or a star rating. See guidepick.jsx for why.
 */
import { useParams, Link } from "react-router-dom";
import { getGuide } from "../api/client.js";
import { useData } from "../lib/helpers.jsx";
import { GuidePick, GuideComparison } from "../components/guidepick.jsx";
import { Breadcrumbs } from "../components/breadcrumbs.jsx";
import { NotFoundBlock } from "../components/editorial.jsx";
import { Seo, breadcrumbSchema } from "../lib/seo.jsx";

const when = (iso) => (iso
  ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  : null);

export default function BuyingGuide() {
  const { slug } = useParams();
  const { data: g, loading, error } = useData(() => getGuide(slug), [slug]);

  if (loading) return <div className="max-w-3xl mx-auto px-5 sm:px-6 py-16 text-ink2">Loading…</div>;
  if (error || !g) {
    return (
      <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14">
        <NotFoundBlock
          title="We haven't written that one"
          body="This guide doesn't exist, or it isn't published yet."
          to="/guides" cta="See every guide" />
      </div>
    );
  }

  const trail = [
    { label: "Home", to: "/" },
    { label: "Buying guides", to: "/guides" },
    { label: g.title, to: `/guides/${g.slug}` },
  ];

  /**
   * Structured data, but only what the page genuinely supports.
   *
   * An ItemList of the picks is honest — that is exactly what the page is. No
   * Product or Offer markup, because we publish no price and no rating, and
   * emitting Offer nodes without them is how a site earns a manual action.
   */
  const schema = [
    breadcrumbSchema(trail),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: g.title,
      numberOfItems: g.picks.length,
      itemListElement: g.picks.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.brand ? `${p.brand} ${p.name}` : p.name,
      })),
    },
    ...(g.faqs.length ? [{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: g.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    }] : []),
  ];

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      <Seo
        title={g.seo.title}
        description={g.seo.description}
        path={`/guides/${g.slug}`}
        canonical={g.seo.canonicalUrl || undefined}
        image={g.seo.ogImageUrl || undefined}
        type="article"
        schema={schema}
      />
      <Breadcrumbs trail={trail} />

      <header className="mb-8">
        <div className="rule-2 mb-4 sm:mb-5" />
        <p className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-3">
          Buying guide{g.category ? ` / ${g.category.name}` : ""}
        </p>
        <h1 className="font-display text-display font-semibold text-balance">{g.title}</h1>
        {g.standfirst && (
          <p className="text-base sm:text-lg text-ink2 mt-4 max-w-measure text-pretty">{g.standfirst}</p>
        )}

        {/* The provenance line: when, and how many were in the running. Only
            the parts we actually know are printed. */}
        <p className="font-mono text-nano uppercase tracking-[.14em] text-ink2 mt-5">
          {g.updatedAt ? `Updated ${when(g.updatedAt)}` : `Published ${when(g.publishedAt)}`}
          {g.productsConsidered ? ` · ${g.productsConsidered} considered` : ""}
          {` · ${g.picks.length} recommended`}
        </p>
      </header>

      {/* Near the top, not buried in the footer. */}
      <aside className="border-y border-rule py-4 mb-9">
        <p className="text-sm leading-relaxed text-pretty">
          <strong className="font-semibold">How we're paid.</strong>{" "}
          Some links on this page go to Amazon, and Toolhaven earns a commission on qualifying
          purchases at no extra cost to you. As an Amazon Associate we earn from qualifying
          purchases. It doesn't change what we recommend — no brand pays to be here, and every
          pick lists what's wrong with it.{" "}
          <Link to="/disclosure" className="underline underline-offset-4 text-accentDeep">Full disclosure</Link>.
        </p>
      </aside>

      {g.intro && (
        <div className="prose-editorial max-w-measure mb-10">
          {g.intro.split("\n").filter(Boolean).map((para, i) => (
            <p key={i} className={i === 0 ? "text-lg leading-relaxed" : undefined}>{para}</p>
          ))}
        </div>
      )}

      {g.methodology && (
        <section aria-labelledby="method" className="border border-rule rounded-card bg-paper2/30 p-5 sm:p-6 mb-10">
          <h2 id="method" className="font-mono text-micro uppercase tracking-[.18em] text-accentDeep mb-3">
            How we chose
          </h2>
          <div className="space-y-3">
            {g.methodology.split("\n").filter(Boolean).map((para, i) => (
              <p key={i} className="text-sm leading-relaxed text-pretty">{para}</p>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="picks" className="mb-12">
        <h2 id="picks" className="font-display text-title font-semibold mb-1">What we recommend</h2>
        <p className="font-mono text-micro uppercase tracking-[.12em] text-ink2 mb-6">
          In order, with what each one is and isn't for
        </p>
        <div className="space-y-6">
          {g.picks.map((p, i) => <GuidePick key={p.id} pick={p} index={i} />)}
        </div>
      </section>

      <GuideComparison picks={g.picks} />

      {g.faqs.length > 0 && (
        <section aria-labelledby="faq" className="mb-12">
          <h2 id="faq" className="font-display text-title font-semibold mb-5">Questions people ask</h2>
          <dl className="border-t border-rule">
            {g.faqs.map((f) => (
              <div key={f.question} className="border-b border-rule py-4">
                <dt className="font-display text-lg font-semibold leading-snug mb-1.5 text-pretty">{f.question}</dt>
                <dd className="text-sm leading-relaxed text-ink2 whitespace-pre-line text-pretty">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {g.finalWord && (
        <section aria-labelledby="final"
          className="border border-rule rounded-card bg-paper p-5 sm:p-6 shadow-press-lg mb-10">
          <h2 id="final" className="font-mono text-micro uppercase tracking-[.18em] text-accentDeep mb-3">
            If you only read one part
          </h2>
          <div className="space-y-3">
            {g.finalWord.split("\n").filter(Boolean).map((para, i) => (
              <p key={i} className="font-display text-lg leading-relaxed text-pretty">{para}</p>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to="/guides" className="stamp-paper">All buying guides →</Link>
        <Link to="/tools" className="stamp-paper">Browse software →</Link>
      </div>
    </div>
  );
}
