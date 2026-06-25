import { useParams, Link } from "react-router-dom";
import { Check, ArrowUpRight } from "lucide-react";
import { getTool } from "../api/client.js";
import { useData, goAffiliate, priceLabel } from "../lib/helpers.jsx";
import { Stars, ToolCard, Loader } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { NotFoundBlock } from "../components/editorial.jsx";
import { ReviewsSection } from "../components/reviews.jsx";

export default function ToolDetail() {
  const { slug } = useParams();
  const { data: tool, loading, error } = useData(() => getTool(slug), [slug]);

  if (loading) return <Loader />;
  if (error || !tool) return <NotFoundBlock code="" kicker="Missing" title="Tool not found."
    message="We couldn't find that one — it may have been renamed or pulled from the list." to="/tools" cta="Browse all tools →" />;

  const color = tool.category?.colorPrimary || "#7C3AED";
  const accent = tool.category?.colorAccent || "#00F5FF";
  const go = () => goAffiliate(tool, `tool/${tool.slug}`);

  return (
    <div className="fade-in">
      {/* hero — a generated review-cover banner in the tool's category colour */}
      <section className="max-w-4xl mx-auto px-6 pt-8 pb-10">
        <figure className="relative overflow-hidden rounded-2xl border-2 border-ink"
          style={{ background: color, boxShadow: "6px 6px 0 var(--shadow-cast)" }}>
          {/* accent wash, print tooth, and the monogram bleeding off the corner */}
          <span aria-hidden="true" className="absolute inset-0"
            style={{ background: `radial-gradient(130% 130% at 100% 0%, ${accent}66, transparent 55%)` }} />
          <span aria-hidden="true" className="halftone absolute inset-0 opacity-20 mix-blend-multiply" />
          <span aria-hidden="true"
            className="absolute -bottom-10 -right-4 font-display font-bold text-white/10 leading-none select-none"
            style={{ fontSize: "clamp(140px,24vw,280px)" }}>{tool.logoMono || tool.name[0]}</span>

          <div className="relative p-6 md:p-9">
            <div className="flex items-center justify-between gap-4 mb-7 font-mono text-[11px] uppercase tracking-[.18em] text-white/90">
              <Link to={`/category/${tool.category?.slug}`} className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
                ← {tool.category?.name}
              </Link>
              <span className="hidden sm:inline text-white/70">Honest review · Downsides included</span>
            </div>

            <div className="flex items-start gap-5">
              <span className="w-20 h-20 grid place-items-center rounded-2xl bg-paper border-2 border-ink font-display font-bold text-3xl text-ink shrink-0"
                style={{ boxShadow: "3px 3px 0 var(--shadow-cast)" }}>
                {tool.logoMono || tool.name[0]}
              </span>
              <div className="min-w-0">
                <h1 className="font-display text-4xl md:text-5xl font-semibold leading-[.95] text-white text-balance">{tool.name}</h1>
                <p className="text-lg text-white/85 mt-2 max-w-xl text-pretty">{tool.description}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-7">
              <span className="inline-flex items-center bg-paper border-2 border-ink rounded-full px-3 py-1.5">
                <Stars r={tool.rating} size={14} />
              </span>
              <span className="font-mono text-sm text-white tabular-nums border-2 border-white/30 rounded-full px-3 py-1.5">
                {priceLabel(tool)}{tool.freeTrial ? " · free trial" : ""}
              </span>
              <button onClick={go} className="stamp-paper sm:ml-auto">
                Get {tool.name} <ArrowUpRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </figure>
      </section>

      <section className="max-w-4xl mx-auto px-6 grid md:grid-cols-3 gap-10 py-8 border-t-2 border-ink">
        <div className="md:col-span-2">
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
        </div>

        {/* sticky aside — the printed verdict card */}
        <aside className="md:sticky md:top-24 self-start">
          <div className="border-2 border-ink bg-paper rounded-2xl overflow-hidden" style={{ boxShadow: "6px 6px 0 var(--shadow-cast)" }}>
            {/* colour cap, tying the card to its category */}
            <div className="h-2.5" style={{ background: color }} />
            <div className="p-5">
              <p className="font-mono text-[11px] uppercase tracking-[.16em] text-accentDeep mb-2">The verdict</p>
              <div className="flex items-end gap-2 mb-4">
                <span className="font-display text-4xl font-semibold leading-none tabular-nums">{Number(tool.rating).toFixed(1)}</span>
                <span className="pb-1"><Stars r={tool.rating} size={13} showNum={false} /></span>
              </div>
              <div className="rule mb-4" />
              <p className="font-mono text-[11px] uppercase tracking-wide text-ink2 mb-1">Best for</p>
              <p className="text-sm mb-4">{tool.bestFor}</p>
              <p className="font-mono text-[11px] uppercase tracking-wide text-ink2 mb-1">Pricing</p>
              <p className="text-sm mb-5 tabular-nums">{priceLabel(tool)}{tool.freeTrial ? " · free trial" : ""}</p>
              <button onClick={go} className="stamp w-full justify-center">Get {tool.name} <ArrowUpRight size={16} aria-hidden="true" /></button>
            </div>
          </div>
        </aside>
      </section>

      {tool.related?.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-10 border-t-2 border-ink">
          <h2 className="font-display text-2xl font-semibold mb-5">Related tools</h2>
          <Reveal stagger className="grid sm:grid-cols-2 gap-4">
            {tool.related.map((t) => <ToolCard key={t.slug} tool={t} />)}
          </Reveal>
        </section>
      )}
    </div>
  );
}
