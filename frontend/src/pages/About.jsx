import { Link } from "react-router-dom";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";
import { TestimonialStrip } from "../components/testimonials.jsx";
import { getTestimonials } from "../api/client.js";
import { useData } from "../lib/helpers.jsx";
import { Seo } from "../lib/seo.jsx";

export default function About() {
  const praise = useData(() => getTestimonials({ limit: 3 }), []);

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      <Seo title="About Toolhaven" description="Who we are, how we pick tools, and why we publish the downsides of everything we recommend." path="/about" />
      <PageHead kicker="About" title="Why we built a tools guide that admits the downsides." />
      <Reveal stagger className="space-y-5 text-lg leading-relaxed">
        <p>Toolhaven started from a simple frustration: every "best tools" list online reads like a press release. Glowing scores, no real cons, and a suspicious habit of ranking whoever pays the most at the top.</p>
        <p>We do it the other way round. We try the tools, we read the pricing fine print, and we write up what we actually found — including the parts that might make you walk away. If a tool isn't right for you, the most useful thing we can do is say so.</p>
        <h2 className="font-display text-2xl font-semibold pt-4">How we pick</h2>
        <p>We look at what a tool does, who it's genuinely for, what it really costs once the trial ends, and how it stacks up against the obvious alternatives. Then we explain it in plain English, no jargon.</p>
        <h2 className="font-display text-2xl font-semibold pt-4">A note on links</h2>
        <p className="text-ink2">Some of our links are partner links. If you sign up through one, it doesn't change your price. It also doesn't change what we write — our whole reason to exist is that you trust the recommendation.</p>
      </Reveal>

      {(praise.data || []).length > 0 && (
        <section className="mt-14">
          <div className="rule-2 mb-5" />
          <p className="font-mono text-xs uppercase tracking-[.2em] text-accentDeep mb-6">In readers' words</p>
          <TestimonialStrip items={praise.data} />
        </section>
      )}

      <Link to="/tools" className="stamp mt-12">Browse the tools →</Link>
    </div>
  );
}
