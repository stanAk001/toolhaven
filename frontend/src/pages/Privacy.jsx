import { Link } from "react-router-dom";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";
import { Seo } from "../lib/seo.jsx";

// Privacy policy reflecting what the site actually collects: newsletter emails,
// contact-form messages, anonymised affiliate-click analytics, and the
// impact.com tracking tag loaded in index.html.
//
// That last one is why this page changed. Loading a third-party tracker is a
// disclosure obligation under GDPR/UK GDPR, and the policy previously claimed
// the opposite — "we don't run intrusive ad-tracking networks" — which stopped
// being true the moment the tag went in. A privacy policy that contradicts the
// page it sits on is worse than none: it is the specific thing a partner's
// compliance review looks for.
export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      <Seo title="Privacy policy" description="What Toolhaven collects, why, and how to ask us to delete it." path="/privacy" />
      <PageHead kicker="Legal" title="Privacy Policy">
        Last updated: August 2026. Plain English, no surprises.
      </PageHead>
      <Reveal stagger className="space-y-5 text-lg leading-relaxed">
        <p>Toolhaven ("we", "us") runs an independent guide to software tools. This policy explains what we collect, why, and what you can do about it. We try to collect as little as possible.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">What we collect</h2>
        <p><strong>Newsletter sign-ups.</strong> If you subscribe, we store the email address you give us so we can send the newsletter. Nothing else is required.</p>
        <p><strong>Contact messages.</strong> If you use our contact form, we keep the name, email, and message you send so we can reply.</p>
        <p><strong>Affiliate click analytics.</strong> When you click an outbound link to a tool, we record that the click happened — along with limited technical details like your browser type, a truncated IP address, and which page you came from — so we can see which tools readers find useful. This is aggregate analytics, not a profile of you.</p>
        <p><strong>Partner tracking (impact.com).</strong> Every page on this site loads a tracking tag from <span className="font-mono text-base">impact.com</span>, the affiliate network we work through. It records that a page was viewed and stores an identifier in your browser so that, if you later sign up to a tool you found here, the network can attribute that referral to us and pay the commission. We never see your name or account details from it — only whether a referral happened.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">What we don't do</h2>
        <p>We don't sell your data. We don't run advertising networks, show ads, or build advertising profiles — the only third-party tag on this site is the affiliate network's, described above, and it exists to attribute referrals rather than to target you. We don't ask for anything we don't need.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Affiliate links</h2>
        <p>Some outbound links are partner links. If you sign up to a tool through one, we may earn a commission at no extra cost to you. See our <Link to="/disclosure" className="underline text-accentDeep">Affiliate Disclosure</Link> for the full detail.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Third parties</h2>
        <p><strong>impact.com.</strong> Our affiliate network. Its tag runs on every page here and handles referral attribution, under <a href="https://impact.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="underline text-accentDeep">its own privacy policy</a>.</p>
        <p><strong>The tools themselves.</strong> When you click through to a tool, that company collects your data under its own privacy policy, not ours. We'd encourage you to read theirs before signing up.</p>
        <p><strong>Hosting.</strong> This site is served by Vercel and its data stored with Render, both of which process technical request data (such as IP addresses) as part of delivering the site.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Your choices</h2>
        <p>Every newsletter email has an unsubscribe link, and you can ask us to delete any data we hold about you at any time. Just reach out.</p>
        <p>To stop the affiliate tracking described above, block third-party scripts or cookies for this site in your browser settings, or use a content blocker. The site works normally either way — nothing here is gated behind tracking. Blocking it only means that if you do sign up to a tool, we don't get credited for it.</p>
        <p>If you're in the UK or EU, you have the right to ask what we hold, to have it corrected or deleted, and to object to how we use it. Use the contact page and we'll action it.</p>

        <h2 className="font-display text-2xl font-semibold pt-4">Contact</h2>
        <p>Questions about your data? Use our <Link to="/contact" className="underline text-accentDeep">contact page</Link> and we'll get back to you.</p>
      </Reveal>
      <Link to="/tools" className="stamp mt-10">Browse the tools →</Link>
    </div>
  );
}
