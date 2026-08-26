import { useParams, Link } from "react-router-dom";
import { Check, ArrowUpRight } from "lucide-react";
import { getTool } from "../api/client.js";
import { useData, goAffiliate } from "../lib/helpers.jsx";
import { Stars, ToolCard, Loader } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { NotFoundBlock } from "../components/editorial.jsx";
import { ReviewsSection } from "../components/reviews.jsx";
import { ScorePanel } from "../components/score.jsx";
import { ExternalRatings, TrustBadge, CommunityStanding } from "../components/evidence.jsx";
import { ToolLogo } from "../components/toollogo.jsx";
import { SocialProof, LastVerified } from "../components/socialproof.jsx";
import { AudienceFit, RealityCheck, CostAndSwitching, LoveRegret, FinalVerdict, AlternativeFinder } from "../components/verdict.jsx";
import { pairSlug } from "../lib/comparepair.js";
import { ShareBar } from "../components/share.jsx";
import { PriceDisclosure, PricingCard } from "../components/pricing.jsx";
import { Breadcrumbs } from "../components/breadcrumbs.jsx";
import { Seo, toolSchema, breadcrumbSchema } from "../lib/seo.jsx";

export default function ToolDetail() {
  const { slug } = useParams();
  const { data: tool, loading, error } = useData(() => getTool(slug), [slug]);

  if (loading) return <Loader />;
  if (error || !tool) {
    return (
      <>
        {/* a missing tool must not be indexed as a real page */}
        <Seo title="Tool not found" path={`/tools/${slug}`} noIndex />
        <NotFoundBlock code="" kicker="Missing" title="Tool not found."
          message="We couldn't find that one — it may have been renamed or pulled from the list." to="/tools" cta="Browse all tools →" />
      </>
    );
  }

  // the biggest outside platform, when one has been recorded
  const headline = (tool?.external?.sources || [])
    .slice().sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))[0] || null;
  const color = tool.category?.colorPrimary || "#7C3AED";
  const accent = tool.category?.colorAccent || "#00F5FF";
  const go = () => goAffiliate(tool, `tool/${tool.slug}`);

  const trail = [
    { label: "Home", to: "/" },
    { label: "Tools", to: "/tools" },
    ...(tool.category ? [{ label: tool.category.name, to: `/categories/${tool.category.slug}` }] : []),
    { label: tool.name, to: `/tools/${tool.slug}` },
  ];

  // The description leads with what the tool is and who it suits — a search
  // result has about 155 characters to earn the click.
  const metaDescription = [
    tool.description,
    tool.bestFor ? `Best for ${tool.bestFor.replace(/\.$/, "")}.` : "",
  ].filter(Boolean).join(" ").slice(0, 300);

  return (
    <div className="fade-in">
      <Seo
        title={`${tool.name} review — features, pricing and the catch`}
        description={metaDescription}
        path={`/tools/${tool.slug}`}
        schema={[toolSchema(tool), breadcrumbSchema(trail)]}
      />
      <div className="max-w-4xl mx-auto px-5 sm:px-6 pt-5">
        <Breadcrumbs trail={trail} />
      </div>
      {/* hero — a generated review-cover banner in the tool's category colour */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 pt-6 sm:pt-8 pb-8 sm:pb-10">
        <figure className="relative overflow-hidden rounded-card border-2 border-ink"
          style={{ background: color, boxShadow: "6px 6px 0 var(--shadow-cast)" }}>
          {/* accent wash, print tooth, and the monogram bleeding off the corner */}
          <span aria-hidden="true" className="absolute inset-0"
            style={{ background: `radial-gradient(130% 130% at 100% 0%, ${accent}66, transparent 55%)` }} />
          <span aria-hidden="true" className="halftone absolute inset-0 opacity-20 mix-blend-multiply" />
          <span aria-hidden="true"
            className="absolute -bottom-10 -right-4 font-display text-monogram font-bold text-white/10 select-none">{tool.logoMono || tool.name[0]}</span>

          <div className="relative p-5 sm:p-6 md:p-9">
            <div className="flex items-center justify-between gap-4 mb-7 font-mono text-label uppercase tracking-[.18em] text-white/90">
              <Link to={`/categories/${tool.category?.slug}`} className="inline-flex items-center gap-1.5 min-h-[28px] hover:text-white transition-colors">
                ← {tool.category?.name}
              </Link>
              <span className="hidden sm:inline text-white/70">Honest review · Downsides included</span>
            </div>

            <div className="flex items-start gap-4 sm:gap-5">
              <ToolLogo tool={tool} size={72} labelled
                className="!rounded-card w-16 h-16 sm:w-20 sm:h-20"
                />
              <div className="min-w-0">
                <h1 className="font-display text-display font-semibold text-white text-balance">{tool.name}</h1>
                <p className="text-base sm:text-lg text-white/85 mt-2 max-w-measure text-pretty">{tool.description}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-7">
              {/* A tool nobody has reviewed has no rating — printing 0.0 with
                  five empty stars reads as "rated zero", which is a claim we
                  have no basis for. */}
              {tool.reviewCount > 0 && (
                <span className="inline-flex items-center bg-paper border-2 border-ink rounded-ui px-3 py-1.5">
                  <Stars r={tool.rating} size={14} />
                </span>
              )}
              {/* A real control now. It looked like a button, and when we had no
                  figures it said "See pricing" — an instruction to click, on
                  something that did nothing when clicked. */}
              <PriceDisclosure tool={tool} />
              {/* No partner-link badge here by design. The disclosure runs
                  in the footer of every page and in full at /disclosure;
                  repeating it beside the button made the page read like an ad. */}
              <button onClick={go} className="stamp-paper sm:ml-auto">
                Get {tool.name} <ArrowUpRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </figure>
      </section>

      <div className="max-w-4xl mx-auto px-5 sm:px-6">
        {tool.external && (
          <div className="mb-8">
            <ExternalRatings external={tool.external} toolName={tool.name} />
          </div>
        )}

        <SocialProof facts={tool.facts || []} tool={tool} />
      </div>

      <section className="max-w-4xl mx-auto px-5 sm:px-6 grid md:grid-cols-3 gap-10 py-8 border-t-2 border-ink">
        <div className="md:col-span-2">
          {/* Renders nothing unless this tool has actually been assessed. */}
          {tool.score && (
            <div className="mb-8">
              <ScorePanel score={tool.score} toolName={tool.name} />
            </div>
          )}

          <h2 className="font-mono text-xs uppercase tracking-wide mb-3" style={{ color }}>What it is</h2>
          <p className="drop-cap font-display text-xl leading-relaxed mb-8">{tool.fullDescription || tool.description}</p>

          {tool.features?.length > 0 && (
            <>
              <h2 className="font-mono text-xs uppercase tracking-wide mb-3" style={{ color }}>Key features</h2>
              <ul className="grid sm:grid-cols-2 gap-3 mb-8">
                {tool.features.map((f) => (
                  <li key={f.id} className="flex gap-2 text-sm"><Check size={16} style={{ color }} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span><b>{f.featureName}.</b> {f.description}</span></li>
                ))}
              </ul>
            </>
          )}

          {tool.pros?.length > 0 && (
            <>
              <h2 className="font-mono text-xs uppercase tracking-wide mb-3" style={{ color }}>What's good</h2>
              <ul className="grid sm:grid-cols-2 gap-3 mb-8">
                {tool.pros.map((p) => (
                  <li key={p.id} className="flex gap-2 text-sm"><Check size={16} style={{ color }} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{p.text}</span></li>
                ))}
              </ul>
            </>
          )}

          {tool.caveat && (
            <div className="mb-8 border-l-4 pl-4 py-1" style={{ borderColor: color }}>
              <p className="font-mono text-xs uppercase tracking-wide mb-1">The catch</p>
              <p className="text-ink2">{tool.caveat}</p>
            </div>
          )}


          {/* Everything below is our assessment rather than the vendor's
              copy. Each block hides itself when it has no data, so an
              unassessed tool shows none of it instead of empty headings. */}
          <AudienceFit verdict={tool.verdict} />
          <RealityCheck verdict={tool.verdict} />
          <CostAndSwitching verdict={tool.verdict} />
          <LoveRegret verdict={tool.verdict} toolName={tool.name} />
          <FinalVerdict verdict={tool.verdict} toolName={tool.name} />

          {tool.testimonials?.length > 0 && (
            <>
              <h2 className="font-mono text-xs uppercase tracking-wide mb-3" style={{ color }}>What people say</h2>
              <div className="space-y-4 mb-4">
                {tool.testimonials.map((t) => (
                  <blockquote key={t.id} className="border-l-4 pl-4" style={{ borderColor: color }}>
                    <p className="font-display text-lg italic">“{t.content}”</p>
                    <footer className="font-mono text-xs text-ink2 mt-1">— {t.userName}{t.userTitle ? `, ${t.userTitle}` : ""}</footer>
                  </blockquote>
                ))}
              </div>
            </>
          )}

          <ReviewsSection toolId={tool.id} color={color} initial={tool.reviews || []} />

          {/* The share row a maker sends to their own audience — the loop that
              brings people here who've never heard of the site. */}
          <div className="border-t-2 border-ink mt-10 pt-6">
            <ShareBar
              context="tool"
              title={`${tool.name} — an honest review on Toolhaven`}
            />
          </div>
        </div>

        {/* sticky aside — the printed verdict card */}
        <aside className="md:sticky md:top-24 self-start">
          <div className="border-2 border-ink bg-paper rounded-card overflow-hidden" style={{ boxShadow: "6px 6px 0 var(--shadow-cast)" }}>
            {/* colour cap, tying the card to its category */}
            <div className="h-2.5" style={{ background: color }} />
            <div className="p-5">
              {/* The card leads with whatever real evidence exists, in order of
                  weight: our readers first, then the biggest outside platform.
                  When there is neither, it shows no rating block at all — the
                  old "Not yet rated" line was a fact about our coverage that
                  readers understandably took as a verdict on the tool. */}
              {tool.reviewCount >= 3 ? (
                <>
                  <p className="font-mono text-label uppercase tracking-[.16em] text-accentDeep mb-2">Community rating</p>
                  <div className="flex items-end gap-2 mb-1">
                    <span className="font-display text-4xl font-semibold leading-none tabular-nums">{Number(tool.rating).toFixed(1)}</span>
                    <span className="pb-1"><Stars r={tool.rating} size={13} showNum={false} /></span>
                  </div>
                  <p className="font-mono text-label uppercase tracking-wide text-ink2 mb-4">
                    From {Number(tool.reviewCount).toLocaleString()} reader{tool.reviewCount === 1 ? "" : "s"}
                  </p>
                </>
              ) : headline ? (
                <>
                  <p className="font-mono text-label uppercase tracking-[.16em] text-accentDeep mb-2">
                    Rated on {headline.sourceName}
                  </p>
                  <div className="flex items-end gap-1.5 mb-1">
                    <span className="font-display text-4xl font-semibold leading-none tabular-nums">{headline.rating}</span>
                    <span className="font-mono text-sm text-ink2 pb-1 tabular-nums">/ {headline.maxRating}</span>
                  </div>
                  <p className="font-mono text-label uppercase tracking-wide text-ink2 mb-4">
                    From {Number(headline.reviewCount).toLocaleString()} reviews ·{" "}
                    <a href={headline.sourceUrl} target="_blank" rel="noopener noreferrer nofollow"
                      className="inline-flex items-center min-h-[26px] underline underline-offset-2 hover:text-accentDeep transition-colors">check it</a>
                  </p>
                </>
              ) : null}
              <div className="rule mb-4" />
              <p className="font-mono text-label uppercase tracking-wide text-ink2 mb-1">Best for</p>
              <p className="text-sm mb-4">{tool.bestFor}</p>
              <PricingCard tool={tool} />
              <button onClick={go} className="stamp w-full justify-center">Get {tool.name} <ArrowUpRight size={16} aria-hidden="true" /></button>
            </div>
          </div>
        </aside>
      </section>

      {tool.hasEditorialAlternatives && (
        <section className="max-w-4xl mx-auto px-5 sm:px-6 pt-8 sm:pt-10 border-t-2 border-ink">
          <AlternativeFinder
            alternatives={tool.alternatives}
            editorial
            toolName={tool.name}
          />
        </section>
      )}

      {tool.related?.length > 0 && (
        <section className="max-w-4xl mx-auto px-5 sm:px-6 py-8 sm:py-10 border-t-2 border-ink">
          <h2 className="font-display text-2xl font-semibold mb-5">Related tools</h2>
          <Reveal stagger className="grid grid-cols-2 gap-3 sm:gap-4">
            {tool.related.map((t) => <ToolCard key={t.slug} tool={t} />)}
          </Reveal>

          {/* Real links into the comparison pages. Without these the pair URLs
              would exist only in the sitemap — reachable, but with nothing
              pointing at them, which is a weak signal and a dead end for a
              reader who is clearly still deciding. */}
          <div className="mt-8">
            <h3 className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-3">
              Head to head
            </h3>
            <ul className="flex flex-wrap gap-2">
              {tool.related.map((t) => (
                <li key={t.slug}>
                  <Link to={`/compare/${pairSlug(tool.slug, t.slug)}`}
                    className="inline-flex items-center min-h-touch font-mono text-label uppercase tracking-wide border-2 border-ink rounded-ui px-4 bg-paper hover:bg-paper2 transition-colors">
                    {tool.name} vs {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
