import { Link } from "react-router-dom";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";
import { Seo } from "../lib/seo.jsx";

// Standard terms of use for a content/affiliate site — informational content,
// no warranties, links go to third parties.
export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      <Seo title="Terms of use" description="The terms that apply when you use Toolhaven." path="/terms" />
      <PageHead kicker="Legal" title="Terms of Use">
        Last updated: June 2026. The short version: use it freely, do your own homework.
      </PageHead>
      <Reveal stagger className="space-y-5 text-lg leading-relaxed">
        <p>By using Toolhaven, you agree to these terms. If you don't agree, please don't use the site.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">What this site is</h2>
        <p>Toolhaven is an independent guide that reviews and compares software tools. Everything here is for general information. It is not professional, financial, legal, or investment advice. Tools in our Stock Trading category are software, not recommendations to buy or sell any security — trading involves risk, and the decisions are yours.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Accuracy</h2>
        <p>We work hard to keep prices, features, and descriptions accurate, but tools change constantly. Always confirm the details on the tool's own website before signing up or paying. We're not liable for decisions you make based on information here.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Affiliate links</h2>
        <p>Some links are affiliate links and may earn us a commission at no cost to you. This never changes our reviews — see the <Link to="/disclosure" className="underline text-accentDeep">Affiliate Disclosure</Link>.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Third-party sites</h2>
        <p>When you click through to a tool, you leave Toolhaven and are bound by that company's terms and privacy policy. We don't control and aren't responsible for their content, pricing, or practices.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Your content</h2>
        <p>If you submit a review, message, or email, keep it lawful and your own. Don't post anything misleading, abusive, or that infringes someone else's rights.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Changes</h2>
        <p>We may update these terms from time to time. Continued use after a change means you accept the new version.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Contact</h2>
        <p>Questions about these terms? Reach us through the <Link to="/contact" className="underline text-accentDeep">contact page</Link>.</p>
      </Reveal>
      <Link to="/tools" className="stamp mt-10">Browse the tools →</Link>
    </div>
  );
}
