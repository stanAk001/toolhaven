import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { getCategories, getTools, getTestimonials } from "../api/client.js";
import { useData } from "../lib/helpers.jsx";
import { CategoryCard, ToolCard, SkeletonGrid } from "../components/ui.jsx";
import { Reveal, Marquee, DrawUnderline } from "../components/motion.jsx";
import { CropMarks, HonestyLedger, SectionHead, VerdictSeal } from "../components/editorial.jsx";
import { FlapBoard } from "../components/flapboard.jsx";
import { TestimonialWall } from "../components/testimonials.jsx";

// single, truthful word per category for the cover's coverage rail
const CAT_LABEL = { ai: "AI", trading: "TRADING", productivity: "PRODUCTIVITY", design: "DESIGN", dev: "DEVELOPMENT", marketing: "MARKETING", video: "VIDEO", support: "SUPPORT" };
const FALLBACK_COVERAGE = Object.values(CAT_LABEL);

// The promises that scroll past in the ticker band — the opener's plain-talk
// pitch, broken into chants.
const TICKER = [
  "We read the fine print",
  "We list the downsides",
  "No sales theatre",
  "The right pick in ten minutes",
  "Every review, honest",
];

export default function Home() {
  const cats = useData(getCategories, []);
  const featured = useData(() => getTools({ featured: true, limit: 6 }), []);
  const toolStats = useData(() => getTools({ limit: 1 }), []);
  const praise = useData(() => getTestimonials({ limit: 7 }), []);
  // three real tools for the compare band, so it shows what it's asking for
  const headToHead = (featured.data?.items || []).slice(0, 3);
  const coverage = (cats.data || []).map((c) => CAT_LABEL[c.slug] || c.name.split(" ")[0].toUpperCase());

  return (
    <div className="fade-in">
      {/* ===== The cover ===== */}
      <section className="relative border-b-2 border-ink overflow-hidden">
        {/* screened newsprint behind the cover — a printed texture, not a toy:
            it holds still so the headline is the only thing asking for attention */}
        <span aria-hidden="true" className="newsfield absolute inset-0 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-6 sm:pt-8 pb-12 sm:pb-16">
          <HonestyLedger tools={toolStats.data?.total || 0} categories={(cats.data || []).length} />

          <FlapBoard words={coverage.length ? coverage : FALLBACK_COVERAGE}
            className="mt-5 sm:mt-6" />

          <Reveal stagger className="grid lg:grid-cols-12 gap-10 mt-10 sm:mt-12 lg:mt-16">
            {/* cover headline */}
            <div className="lg:col-span-8">
              <p className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-4 sm:mb-5">Cover story / Why we exist</p>
              <h1 className="font-display text-hero font-semibold text-balance">
                Finding the right tool shouldn't cost you a week of{" "}
                <span className="relative inline-block italic text-accent">
                  open tabs.
                  <DrawUnderline />
                </span>
              </h1>
            </div>

            {/* the lede column, set off by a rule like a printed sidebar */}
            <div className="lg:col-span-4 lg:border-l-2 lg:border-ink lg:pl-7 flex flex-col justify-end">
              <p className="drop-cap text-base sm:text-lg leading-relaxed mb-4 text-pretty">
                There are thousands of tools out there, and almost every "review" you find is quietly an ad.
                This is the opposite — we read the fine print, try the things ourselves, and tell you plainly
                what's worth your money.
              </p>
              <p className="font-mono text-micro uppercase tracking-wide text-ink2 mb-6">
                Ten minutes, not ten tabs. Downsides listed every time.
              </p>
              {/* the action and the promise, struck side by side */}
              <div className="flex items-center justify-between gap-3">
                <Link to="/tools" className="island whitespace-nowrap shrink-0">
                  Read the reviews
                  <span className="island-dot"><ArrowUpRight size={16} strokeWidth={2.5} /></span>
                </Link>
                <VerdictSeal size={80} className="text-ink" />
              </div>
            </div>
          </Reveal>
        </div>
        <CropMarks />
      </section>

      {/* ticker — an inky band of promises running past like a press sheet */}
      <Marquee items={TICKER}
        className="border-b-2 border-ink bg-ink text-paper py-3 font-mono text-xs uppercase tracking-[.18em]" />

      {/* categories */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16 lg:py-20">
        <SectionHead folio="01" kicker="The index" title="Browse by category"
          action={<Link to="/tools" className="inline-flex items-center min-h-touch md:min-h-0 font-mono text-xs uppercase hover:text-accentDeep whitespace-nowrap">All tools →</Link>} />
        {cats.loading ? <SkeletonGrid count={6} /> : (
          <Reveal stagger className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {(cats.data || []).map((c) => <CategoryCard key={c.slug} category={c} />)}
          </Reveal>
        )}
      </section>

      {/* featured tools */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16 lg:py-20">
        <SectionHead folio="02" kicker="Editor's picks" title="Featured right now" />
        {featured.loading ? <SkeletonGrid count={6} /> : (
          <Reveal stagger className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {(featured.data?.items || []).map((t) => <ToolCard key={t.slug} tool={t} />)}
          </Reveal>
        )}
      </section>

      {/* letters to the editor — reader testimonials pinned to the board */}
      {(praise.loading || (praise.data || []).length > 0) && (
        <section className="relative border-y-2 border-ink bg-paper2/30 overflow-hidden">
          <span aria-hidden="true" className="newsfield absolute inset-0 pointer-events-none" />
          <div className="relative max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16 lg:py-20">
            <SectionHead folio="03" kicker="Letters to the editor" title="What readers tell us"
              action={<span className="font-mono text-xs uppercase text-accentDeep whitespace-nowrap">Unedited &amp; unpaid</span>} />
            {praise.loading ? <SkeletonGrid count={6} /> : <TestimonialWall items={praise.data || []} />}
          </div>
        </section>
      )}

      {/* CTA band */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-12">
        <Reveal className="relative border-2 border-ink rounded-3xl p-7 sm:p-10 md:p-16 text-center bg-paper overflow-hidden"
          style={{ boxShadow: "8px 8px 0 var(--shadow-cast)" }}>
          <div className="halftone absolute inset-0 opacity-[.22] pointer-events-none" aria-hidden="true" />
          <div className="relative">
            {/* Three real tools, laid out as printed plates the way you'd actually
                deal them onto a desk to compare. The band used to say "head to
                head" and then show nothing at all. */}
            {headToHead.length === 3 && (
              <div className="flex justify-center items-center mb-6 sm:mb-7" aria-hidden="true">
                {headToHead.map((t, i) => (
                  <span key={t.slug}
                    className="grid place-items-center w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-xl border-2 border-ink font-display font-bold text-xl sm:text-2xl text-white transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1"
                    style={{
                      background: t.category?.colorPrimary || "#1C1714",
                      boxShadow: "4px 4px 0 var(--shadow-cast)",
                      transform: `rotate(${[-7, 1, 7][i]}deg)`,
                      marginLeft: i ? "-0.75rem" : 0,
                      zIndex: 3 - i,
                    }}>
                    {t.logoMono || t.name[0]}
                  </span>
                ))}
              </div>
            )}
            <p className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-3">Still deciding?</p>
            <h2 className="font-display text-3xl md:text-5xl font-semibold mb-3 leading-tight text-balance">Put three tools head to head.</h2>
            <p className="text-ink2 mb-7 max-w-xl mx-auto text-pretty">Line them up side by side and see the real differences — price, trial, and the catch.</p>
            <Link to="/compare" className="stamp">Compare tools →</Link>
          </div>
        </Reveal>
      </section>

      {/* vendor CTA — convert founders who want their tool reviewed */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 pb-16 sm:pb-20">
        <Reveal className="rounded-3xl border-2 border-ink bg-ink text-paper p-7 sm:p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-6"
          style={{ boxShadow: "8px 8px 0 var(--shadow-cast)" }}>
          <div>
            <p className="font-mono text-micro uppercase tracking-[.2em] text-accent mb-2">Built a tool?</p>
            <h2 className="font-display text-2xl md:text-3xl font-semibold leading-tight max-w-lg text-balance">Get it in front of buyers who actually trust the verdict.</h2>
            <p className="text-paper/70 mt-2 max-w-md text-pretty">An honest review, a buying audience, and no pay-to-play. Submit yours in five minutes.</p>
          </div>
          <Link to="/submit" className="stamp-paper shrink-0">Submit your tool →</Link>
        </Reveal>
      </section>
    </div>
  );
}
