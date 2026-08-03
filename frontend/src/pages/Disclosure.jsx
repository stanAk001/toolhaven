import { Link } from "react-router-dom";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";

// Affiliate disclosure rewritten to disarm the "you're paid to praise" doubt
// head-on: lead with editorial independence, frame the money as a wall, and
// make the FTC point a footnote rather than the headline.
export default function Disclosure() {
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      <PageHead kicker="Legal" title="Affiliate Disclosure">
        How Toolhaven makes money — and the wall between that and what we write.
      </PageHead>
      <Reveal stagger className="space-y-5 text-lg leading-relaxed">
        <p className="drop-cap">Let's be direct, because this is exactly where most "review" sites get shifty. Toolhaven is free to read because some of our outbound links are <strong>affiliate links</strong>: if you sign up for a tool through one, the company pays us a small commission. You pay the same price you'd pay going direct — sometimes less, since we chase the deals.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">What that money does <span className="text-accentDeep">not</span> buy</h2>
        <p>This is the part that matters, so we'll be blunt:</p>
        <ul className="space-y-2 pl-1">
          <li className="flex gap-3"><span className="text-accent font-bold shrink-0">✦</span><span>It does not buy a good review. We publish the <strong>downsides of every tool</strong> — including the ones that pay us the most.</span></li>
          <li className="flex gap-3"><span className="text-accent font-bold shrink-0">✦</span><span>It does not buy a ranking. We run <strong>zero paid placements</strong>. No company can buy its way up a list or onto one.</span></li>
          <li className="flex gap-3"><span className="text-accent font-bold shrink-0">✦</span><span>It does not buy our silence. If a tool is wrong for you, we say so — commission or not. Telling you to walk away is the most useful thing we can do.</span></li>
        </ul>

        <h2 className="font-display text-2xl font-semibold pt-4">Why affiliate links instead of ads</h2>
        <p>Because ads would mean cluttering the page and selling your attention to whoever bids highest. An affiliate link only earns when <em>you</em> decide a tool is worth trying and click through. That lines our incentive up with yours: to be <strong>right</strong>, not loud. We'd rather earn nothing on an honest "skip this one" than a commission on a recommendation we don't believe.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Keep us honest</h2>
        <p>Every tool page has a plainly-labelled "catch" section, because nothing is perfect. If a review ever reads like an advert to you, <Link to="/contact" className="underline text-accentDeep">tell us</Link> — we'll fix it or pull it. Our entire reason to exist is that you trust the verdict; the day you stop, we have nothing.</p>

        <p className="text-ink2 text-base pt-2">For the record: this disclosure also satisfies the U.S. FTC's endorsement guidelines and equivalent rules elsewhere. But we'd write it even if no one made us — see how we work in <Link to="/about" className="underline text-accentDeep">About</Link>, or how we handle data in our <Link to="/privacy" className="underline text-accentDeep">Privacy Policy</Link>.</p>
      </Reveal>
      <Link to="/tools" className="stamp mt-10">See the honest reviews →</Link>
    </div>
  );
}
