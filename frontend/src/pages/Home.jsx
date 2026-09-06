import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import { getCategories, getTools, getTestimonials, getToolRails } from "../api/client.js";
import { useData } from "../lib/helpers.jsx";
import { CategoryCard, ToolCard, SkeletonGrid } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { LedgerBoard, SectionHead, VerdictSeal } from "../components/editorial.jsx";
import { Seo, orgSchema, siteSchema } from "../lib/seo.jsx";
import { TestimonialWall } from "../components/testimonials.jsx";
import { ToolRail } from "../components/rails.jsx";


// The promises that scroll past in the ticker band — the opener's plain-talk
// pitch, broken into chants.
const TICKER = [
  "We read the fine print",
  "We list the downsides",
  "No sales theatre",
  "The right pick in ten minutes",
  "Every review, honest",
];

/**
 * The way into the index, on the cover.
 *
 * Set as a printed entry line — a rule under the field, ink caret, no box and
 * no rounded pill — so it reads as part of the page rather than a search widget
 * dropped onto it. The term goes into the URL, so the result is a place a
 * reader can link to or come back to.
 */
function CoverSearch({ categories }) {
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const popular = categories.slice(0, 4);

  const submit = (e) => {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/tools?search=${encodeURIComponent(q)}` : "/tools");
  };

  return (
    <div className="mt-7 sm:mt-9 max-w-xl">
      <form onSubmit={submit} role="search">
        <label htmlFor="cover-search" className="block font-mono text-micro uppercase tracking-[.2em] text-ink2 mb-2">
          Search the index
        </label>
        <div className="flex items-center gap-3 border-b border-rule pb-2 focus-within:border-accent transition-colors">
          <Search size={18} strokeWidth={2.5} aria-hidden="true" className="shrink-0 text-accentDeep" />
          <input
            id="cover-search"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="What are you trying to do?"
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent outline-none min-h-touch font-display text-lg placeholder:text-ink2/60"
          />
          <button type="submit" className="stamp text-xs shrink-0">
            Search
          </button>
        </div>
      </form>

      {/* These read as a line of prose but behave as navigation, so they take
          a real target rather than leaning on the inline exemption. */}
      {popular.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-1 font-mono text-label text-ink2">
          <span className="uppercase tracking-[.14em] mr-1">Or browse</span>
          {popular.map((c, i) => (
            <span key={c.slug} className="inline-flex items-center">
              {i > 0 && <span aria-hidden="true" className="text-ink2/50 mr-1">·</span>}
              <Link to={`/categories/${c.slug}`}
                className="inline-flex items-center min-h-[26px] underline underline-offset-4 hover:text-accentDeep transition-colors">
                {c.name}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export default function Home() {
  const cats = useData(getCategories, []);
  const featured = useData(() => getTools({ featured: true, limit: 6 }), []);
  const toolStats = useData(() => getTools({ limit: 1 }), []);
  const praise = useData(() => getTestimonials({ limit: 7 }), []);
  const rails = useData(getToolRails, []);
  // three real tools for the compare band, so it shows what it's asking for
  const headToHead = (featured.data?.items || []).slice(0, 3);

  return (
    <div className="fade-in">
      {/* The home page carries the site-level schema: who publishes this, and
          the search endpoint crawlers can offer directly in results. */}
      <Seo
        title=""
        description="Explore, compare and evaluate useful software and digital tools. Independent reviews that list the downsides, not just the features."
        path="/"
        schema={[orgSchema(), siteSchema()]}
      />
      {/* ===== The cover ===== */}
      <section className="relative border-b border-rule overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-6 sm:pt-8 pb-12 sm:pb-16">
          {/* the four figures the cover opens on, printed on one ruled line */}
          <LedgerBoard
            tools={toolStats.data?.total ?? null}
            categories={(cats.data || []).length || null} />

          <Reveal stagger className="grid lg:grid-cols-12 gap-10 mt-10 sm:mt-12 lg:mt-16">
            {/* cover headline */}
            <div className="lg:col-span-8">
              <p className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-4 sm:mb-5">Cover story / Why we exist</p>
              <h1 className="font-display text-hero font-semibold text-balance">
                Finding the right tool shouldn't cost you a week of{" "}
<span className="text-accent">open tabs.</span>
              </h1>

              {/* The cover said what we are and why we exist, and then left the
                  reader with nowhere to go but scroll. Searching the index is
                  the thing this site is for, so it belongs on the first screen —
                  set as a ruled entry on the page rather than a floating pill. */}
              <CoverSearch categories={cats.data || []} />
            </div>

            {/* the lede column, set off by a rule like a printed sidebar */}
            {/* Aligned to the top of the headline rather than the bottom of the
                column. It used to hang off the baseline, which worked when the
                headline was the only thing in the main column and left a hole
                above the lede once the search line was added. */}
            <div className="lg:col-span-4 lg:border-l lg:border-rule lg:pl-7 flex flex-col justify-start lg:pt-2">
              <p className="text-base sm:text-lg leading-relaxed mb-4 text-pretty">
                There are thousands of tools out there, and almost every "review" you find is quietly an ad.
                This is the opposite — we read the fine print, try the things ourselves, and tell you plainly
                what's worth your money.
              </p>
              <p className="font-mono text-micro uppercase tracking-wide text-ink2 mb-6">
                Ten minutes, not ten tabs. Downsides listed every time.
              </p>
              {/* the action, then the two policies it is offered under */}
              <div className="flex flex-col items-start gap-5">
                <Link to="/tools" className="island whitespace-nowrap shrink-0">
                  Read the reviews
                  <span className="island-dot"><ArrowUpRight size={16} strokeWidth={2.5} /></span>
                </Link>
                <VerdictSeal className="w-full" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* the standing promises — stated once, not scrolled past */}
      <div className="border-b border-rule bg-ink text-paper">
        <ul className="max-w-6xl mx-auto px-5 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-1.5
          font-mono text-nano sm:text-micro uppercase tracking-[.16em] text-paper/80">
          {TICKER.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>

      {/* categories */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16 lg:py-20">
        <SectionHead folio="01" kicker="The index" title="Browse by category"
          action={<Link to="/tools" className="inline-flex items-center min-h-touch md:min-h-[28px] font-mono text-xs uppercase hover:text-accentDeep whitespace-nowrap">All tools →</Link>} />
        {cats.loading ? <SkeletonGrid count={6} /> : (
          <Reveal stagger className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {(cats.data || []).map((c) => <CategoryCard key={c.slug} category={c} />)}
          </Reveal>
        )}
      </section>

      {/* featured tools */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16 lg:py-20">
        <SectionHead folio="02" kicker="Hand-picked" title="Featured right now" />
        {featured.loading ? <SkeletonGrid count={6} /> : (
          <Reveal stagger className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {(featured.data?.items || []).map((t) => <ToolCard key={t.slug} tool={t} />)}
          </Reveal>
        )}
      </section>

      {/* ===== The rails =====
           Each one names the measure it ranks by, and hides itself when there
           isn't enough real data behind it. None of them look at affiliate
           status. ===== */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6">
        <ToolRail
          kicker="Moving right now"
          title="Trending this month"
          basis="Ranked by outbound clicks in the last 30 days"
          tools={rails.data?.trending}
          to="/tools"
        />
        <ToolRail
          kicker="Assessed by us"
          title="Editor's picks"
          basis="Tools carrying a Toolhaven Score — ones we've actually sat down with"
          tools={rails.data?.editorsPicks}
          to="/best"
        />
        <ToolRail
          kicker="What readers rate"
          title="Most reviewed"
          basis="Ranked by number of reader reviews"
          tools={rails.data?.mostReviewed}
          to="/tools"
        />
        <ToolRail
          kicker="Just added"
          title="New to the index"
          basis="Most recently published profiles"
          tools={rails.data?.recentlyAdded}
          to="/tools"
        />
      </section>

      {(praise.loading || (praise.data || []).length > 0) && (
        <section className="relative border-y border-rule bg-paper2/30 overflow-hidden">
          <div className="relative max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16 lg:py-20">
            <SectionHead folio="03" kicker="Letters to the editor" title="What readers tell us"
              action={<span className="font-mono text-xs uppercase text-accentDeep whitespace-nowrap">Unedited &amp; unpaid</span>} />
            {praise.loading ? <SkeletonGrid count={6} /> : <TestimonialWall items={praise.data || []} />}
          </div>
        </section>
      )}

      {/* CTA band */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-12">
        <Reveal className="relative border border-rule rounded-card p-7 sm:p-10 md:p-16 text-center bg-paper overflow-hidden"
          >
          <div className="relative">
            {/* Three real tools, laid out as printed plates the way you'd actually
                deal them onto a desk to compare. The band used to say "head to
                head" and then show nothing at all. */}
            {headToHead.length === 3 && (
              <div className="flex justify-center items-center mb-6 sm:mb-7" aria-hidden="true">
                {headToHead.map((t, i) => (
                  <span key={t.slug}
                    className="grid place-items-center w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-card border border-rule font-display font-bold text-xl sm:text-2xl text-white transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1"
                    style={{
                      background: t.category?.colorPrimary || "#0E1116",
                      transform: `rotate(${[-7, 1, 7][i]}deg)`,
                      marginLeft: i ? "-0.75rem" : 0,
                      zIndex: 3 - i }}>
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
        <Reveal className="rounded-card border border-rule bg-ink text-paper p-7 sm:p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
          <div>
            <p className="font-mono text-micro uppercase tracking-[.2em] text-paper/70 mb-2">Built a tool?</p>
            <h2 className="font-display text-2xl md:text-3xl font-semibold leading-tight max-w-lg text-balance">Get it in front of buyers who actually trust the verdict.</h2>
            <p className="text-paper/70 mt-2 max-w-md text-pretty">An honest review, a buying audience, and no pay-to-play. Submit yours in five minutes.</p>
          </div>
          <Link to="/submit" className="stamp-paper shrink-0">Submit your tool →</Link>
        </Reveal>
      </section>
    </div>
  );
}
