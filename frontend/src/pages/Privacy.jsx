import { Link } from "react-router-dom";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";
import { Seo } from "../lib/seo.jsx";

// Privacy policy reflecting what the site actually collects: newsletter emails,
// contact-form messages, and anonymised affiliate-click analytics.
export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      <Seo title="Privacy policy" description="What Toolhaven collects, why, and how to ask us to delete it." path="/privacy" />
      <PageHead kicker="Legal" title="Privacy Policy">
        Last updated: June 2026. Plain English, no surprises.
      </PageHead>
      <Reveal stagger className="space-y-5 text-lg leading-relaxed">
        <p>Toolhaven ("we", "us") runs an independent guide to software tools. This policy explains what we collect, why, and what you can do about it. We try to collect as little as possible.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">What we collect</h2>
        <p><strong>Newsletter sign-ups.</strong> If you subscribe, we store the email address you give us so we can send the newsletter. Nothing else is required.</p>
        <p><strong>Contact messages.</strong> If you use our contact form, we keep the name, email, and message you send so we can reply.</p>
        <p><strong>Affiliate click analytics.</strong> When you click an outbound link to a tool, we record that the click happened — along with limited technical details like your browser type, a truncated IP address, and which page you came from — so we can see which tools readers find useful. This is aggregate analytics, not a profile of you.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">What we don't do</h2>
        <p>We don't sell your data. We don't run intrusive ad-tracking networks. We don't ask for anything we don't need.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Affiliate links</h2>
        <p>Some outbound links are partner links. If you sign up to a tool through one, we may earn a commission at no extra cost to you. See our <Link to="/disclosure" className="underline text-accentDeep">Affiliate Disclosure</Link> for the full detail.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Third parties</h2>
        <p>When you click through to a tool, that company collects your data under its own privacy policy, not ours. We'd encourage you to read theirs before signing up.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Your choices</h2>
        <p>Every newsletter email has an unsubscribe link, and you can ask us to delete any data we hold about you at any time. Just reach out.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Contact</h2>
        <p>Questions about your data? Use our <Link to="/contact" className="underline text-accentDeep">contact page</Link> and we'll get back to you.</p>
      </Reveal>
      <Link to="/tools" className="stamp mt-10">Browse the tools →</Link>
    </div>
  );
}
