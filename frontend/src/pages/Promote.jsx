/**
 * /promote — the page that sells promotion.
 *
 * Written under one constraint that shapes everything on it: Toolhaven does not
 * yet have an audience worth boasting about, so this page does not boast. There
 * are no visitor counts, no "reach 100,000 developers", no logos of companies
 * that never bought anything, no testimonials nobody gave. Every number shown
 * is either a price an editor set or a placement count read from the database.
 *
 * What it sells instead is specific and checkable: named placements, a real
 * duration, analytics counted from events, and a clear statement of what money
 * cannot buy. A vendor who reads this and buys knows exactly what they are
 * getting — which is the only version of this that survives contact with a
 * second campaign.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, X, ArrowUpRight } from "lucide-react";
import { getPromotionPlans } from "../api/client.js";
import { PageHead } from "../components/editorial.jsx";
import { Breadcrumbs } from "../components/breadcrumbs.jsx";
import { CustomBuild } from "../components/custombuild.jsx";
import { saveBuild } from "../lib/buildhandoff.js";
import { Reveal } from "../components/motion.jsx";
import { Seo, breadcrumbSchema } from "../lib/seo.jsx";

const money = (minor, currency) => {
  if (!Number.isInteger(minor)) return null;
  const symbol = currency === "NGN" ? "₦" : "$";
  const major = minor / 100;
  return symbol + (major % 1 === 0 ? major.toLocaleString("en-US") : major.toFixed(2));
};

const STEPS = [
  ["Choose your tool", "It's already listed, so there's nothing to re-submit. Pick it from your dashboard."],
  ["Pick a package", "Each one names the placements it includes and how long it runs."],
  ["Write the copy", "A headline, a sentence, and the button text. We check it before it runs."],
  ["Pay", "Secure card payment. The price you see is the price you're charged."],
  ["We review it", "An editor reads every campaign. Usually within a working day."],
  ["It runs", "You watch impressions, page views and outbound clicks as they're recorded."],
];

const BUYS = [
  "Additional visibility on Toolhaven",
  "Named promotional placements",
  "Traffic distribution to your own site",
  "Campaign exposure for a fixed period",
  "Performance reporting from real events",
];

const DOES_NOT_BUY = [
  "A positive review",
  "A higher Toolhaven Score",
  "A better rating",
  "An organic ranking position",
  "Removal of legitimate criticism",
  "An award or a “best tool” designation",
];

const FAQ = [
  ["Does paying change my review or score?",
    "No. Editorial and commercial are kept apart on purpose — a campaign decides where an advert appears and for how long, and nothing else. If we've written something critical about your tool, it stays written."],
  ["Do I need to submit my tool again?",
    "No. If your tool is already published on Toolhaven, sign in with the email address you submitted it with and it will be waiting for you."],
  ["What if my tool isn't approved yet?",
    "You'll need to wait until it's published. There's nothing to promote until there's a listing to send people to."],
  ["How are the numbers counted?",
    "An impression is recorded when a promotional card has actually been on screen — not when the page was served. Clicks are recorded on the outbound hop. Every figure in your dashboard is a count of those events; none of them are estimated."],
  ["Will the traffic convert?",
    "We can't tell you that, and we won't pretend to. Toolhaven can show you what it recorded on Toolhaven. What happens after someone lands on your site is measurable in your own analytics — every outbound link carries UTM tags so you can find it there."],
  ["Can I get a refund?",
    "If we reject a campaign before it runs, yes. Once a campaign has started it's running against inventory that was held for you, so refunds are handled case by case — email us."],
  ["Which placements are actually automatic?",
    "The on-site ones: homepage, category and discovery surfaces are rendered by the site. Social posts and newsletter placements are written and published by an editor, so they're fulfilled by hand and we say so rather than implying a machine does it."],
];

function PlanCard({ plan }) {
  // `price` is resolved on the server from where the buyer is. There is no
  // client-side currency choice, so this is simply the price — the one the card
  // will be charged.
  const price = plan.price;
  return (
    <article className="flex flex-col h-full rounded-card border border-rule bg-surface p-4 sm:p-5">
      <h3 className="font-display text-base sm:text-xl font-semibold tracking-tight text-balance">{plan.name}</h3>
      {plan.description && (
        <p className="hidden sm:block text-sm text-ink2 leading-snug mt-1.5 text-pretty">{plan.description}</p>
      )}

      <p className="mt-3 sm:mt-4 mb-1">
        {plan.quoteOnly ? (
          <span className="font-display text-lg sm:text-2xl font-semibold">Priced per campaign</span>
        ) : price ? (
          <>
            <span className="font-display text-2xl sm:text-3xl font-semibold tabular-nums">
              {money(price.minor, price.currency)}
            </span>
            <span className="block sm:inline font-mono text-nano uppercase tracking-[.14em] text-ink2 sm:ml-2">
              {plan.durationDays} days
            </span>
          </>
        ) : (
          <span className="font-mono text-sm text-ink2">Not priced yet</span>
        )}
      </p>

      {plan.features?.length > 0 && (
        <ul className="space-y-1.5 mt-3 sm:mt-4 mb-5">
          {plan.features.map((f) => (
            <li key={f} className="flex gap-2 sm:gap-2.5 text-xs sm:text-sm leading-snug">
              <Check size={13} aria-hidden="true" className="text-green-700 shrink-0 mt-[3px]" />
              <span className="text-pretty">{f}</span>
            </li>
          ))}
        </ul>
      )}

      <Link to="/promote/dashboard" className="stamp text-xs mt-auto w-full justify-center">
        {plan.quoteOnly ? "Ask for a quote" : "Start a campaign"}
      </Link>
    </article>
  );
}

export default function Promote() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  const trail = [{ label: "Home", to: "/" }, { label: "Promote", to: "/promote" }];

  useEffect(() => {
    // No currency argument: the server works out where the request came from
    // and prices everything in one currency accordingly. The buyer is never
    // asked, and never shown a switch.
    getPromotionPlans()
      .then(setData)
      .catch(() => setData({ plans: [], placements: [] }));
  }, []);

  const plans = data?.plans || [];
  const placements = (data?.placements || []).filter((p) => p.active !== false);

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      <Seo
        title="Promote your tool"
        description="Your Toolhaven listing helps people discover your product. Promote it when you want additional visibility across our discovery and promotional channels."
        path="/promote"
        schema={breadcrumbSchema(trail)}
      />
      <Breadcrumbs trail={trail} />

      <PageHead kicker="Toolhaven Promote" title="Put your tool in front of more people">
        Your Toolhaven listing helps people discover your product. Promote it when you want
        additional visibility across our discovery and promotional channels.
      </PageHead>

      <div className="flex flex-wrap gap-3 mb-14">
        <Link to="/promote/dashboard" className="stamp">Promote your tool →</Link>
        <a href="#options" className="stamp-paper">See the options</a>
      </div>

      {/* ───────── how it works ───────── */}
      <section className="mb-14" aria-labelledby="how">
        <h2 id="how" className="font-display text-2xl font-semibold tracking-tight mb-1">How it works</h2>
        <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-5">
          Your tool is already listed — there is nothing to submit again
        </p>
        {/* Two across on a phone rather than one long column: six stacked
            steps turned this into a scroll, and the sequence reads better as a
            block you can take in at once. */}
        <ol className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-8 gap-y-5">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="border-t border-rule pt-3">
              <span className="font-mono text-nano tabular-nums text-ink2/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-sm sm:text-base font-semibold leading-tight mt-1 mb-1 text-balance">
                {title}
              </h3>
              <p className="text-xs sm:text-sm text-ink2 leading-snug text-pretty">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ───────── options ───────── */}
      <section id="options" className="scroll-mt-24 mb-14" aria-labelledby="options-h">
        <h2 id="options-h" className="font-display text-2xl font-semibold tracking-tight mb-1">
          Promotion options
        </h2>
        {/* No mention of providers or currencies. Which rail takes the card is
            our problem to solve, not a decision to hand the buyer. */}
        <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-5">
          Every package names the placements it includes and how long it runs
        </p>

        {!data ? (
          <p className="text-ink2">Loading…</p>
        ) : plans.length === 0 ? (
          <p className="text-ink2">Promotion packages aren't on sale just now.</p>
        ) : (
          <Reveal stagger className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {plans.map((p) => <PlanCard key={p.slug} plan={p} />)}
          </Reveal>
        )}
      </section>

      {/* ───────── build your own ─────────
          The button carries the build across the sign-in step rather than
          dropping the visitor on a login screen with nothing to show for what
          they just chose. */}
      <CustomBuild
        className="mb-14"
        onStart={(build) => { saveBuild(build); navigate("/promote/dashboard"); }}
      />

      {/* ───────── placements ───────── */}
      {placements.length > 0 && (
        <section className="mb-14" aria-labelledby="where">
          <h2 id="where" className="font-display text-2xl font-semibold tracking-tight mb-1">
            Where your tool can appear
          </h2>
          <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-5">
            Availability is the real count of open slots, not a sales tactic
          </p>
          <dl className="border-t border-rule">
            {placements.map((p) => (
              <div key={p.key} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule py-3">
                <div className="min-w-0 flex-1">
                  <dt className="font-display text-base font-semibold leading-tight">
                    {p.label}
                    {p.manual && (
                      <span className="ml-2 font-mono text-nano uppercase tracking-[.12em] text-ink2 font-normal">
                        fulfilled by an editor
                      </span>
                    )}
                  </dt>
                  {p.description && <dd className="text-sm text-ink2 leading-snug mt-0.5 text-pretty">{p.description}</dd>}
                </div>
                <dd className="font-mono text-nano uppercase tracking-[.12em] tabular-nums shrink-0">
                  {p.available
                    ? <span className="text-ink2">{p.free} of {p.maxActive} open</span>
                    : <span className="text-accentDeep">Currently unavailable</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* ───────── analytics ───────── */}
      <section className="mb-14" aria-labelledby="analytics">
        <h2 id="analytics" className="font-display text-2xl font-semibold tracking-tight mb-1">What you can measure</h2>
        <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-5">
          Counted from recorded events — nothing is estimated
        </p>
        <div className="grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-4">
          <div className="border-t border-rule pt-3">
            <h3 className="font-display text-sm sm:text-base font-semibold mb-1">On Toolhaven</h3>
            <p className="text-xs sm:text-sm text-ink2 leading-snug text-pretty">
              Impressions when a card has actually been on screen, views of your tool page,
              and outbound clicks to your site — broken down by placement.
            </p>
          </div>
          <div className="border-t border-rule pt-3">
            <h3 className="font-display text-sm sm:text-base font-semibold mb-1">On your own site</h3>
            <p className="text-xs sm:text-sm text-ink2 leading-snug text-pretty">
              Every outbound link carries UTM tags, so the traffic shows up in your analytics
              as <code className="font-mono text-xs">utm_source=toolhaven</code> and you can
              judge it for yourself.
            </p>
          </div>
        </div>
        <p className="font-mono text-nano text-ink2 mt-4 text-pretty">
          These metrics represent activity recorded by Toolhaven and do not necessarily represent
          conversions on your website.
        </p>
      </section>

      {/* ───────── editorial independence ───────── */}
      <section className="mb-14" aria-labelledby="independence">
        <div className="rule-2 mb-4" />
        <h2 id="independence" className="font-display text-2xl font-semibold tracking-tight mb-1">
          What promotion does — and doesn't — buy
        </h2>
        <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-5">
          The line that makes a recommendation worth reading
        </p>
        <div className="grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-5">
          <div>
            <p className="font-mono text-nano uppercase tracking-[.16em] text-ink2 mb-2">Promotion buys</p>
            <ul className="space-y-1.5">
              {BUYS.map((x) => (
                <li key={x} className="flex gap-2 sm:gap-2.5 text-xs sm:text-sm leading-snug">
                  <Check size={13} aria-hidden="true" className="text-green-700 shrink-0 mt-[3px]" />
                  <span className="text-pretty">{x}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono text-nano uppercase tracking-[.16em] text-ink2 mb-2">Promotion does not buy</p>
            <ul className="space-y-1.5">
              {DOES_NOT_BUY.map((x) => (
                <li key={x} className="flex gap-2 sm:gap-2.5 text-xs sm:text-sm leading-snug">
                  <X size={13} aria-hidden="true" className="text-accentDeep shrink-0 mt-[3px]" />
                  <span className="text-pretty">{x}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-sm text-ink2 leading-snug mt-5 max-w-measure text-pretty">
          Paid placements are labelled wherever they appear, and they sit in their own blocks rather
          than mixed into ranked results. If we've written something critical about your tool, buying
          a campaign does not remove it.{" "}
          <Link to="/disclosure" className="underline underline-offset-4 text-accentDeep">How we're paid</Link>.
        </p>
      </section>

      {/* ───────── faq ───────── */}
      <section className="mb-14" aria-labelledby="faq">
        <h2 id="faq" className="font-display text-2xl font-semibold tracking-tight mb-5">Questions</h2>
        <dl className="border-t border-rule">
          {FAQ.map(([q, a]) => (
            <div key={q} className="border-b border-rule py-4">
              <dt className="font-display text-base font-semibold leading-tight mb-1.5">{q}</dt>
              <dd className="text-sm text-ink2 leading-relaxed max-w-measure text-pretty">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border border-rule rounded-card bg-paper2/40 p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold tracking-tight mb-1">Ready when you are</h2>
        <p className="text-ink2 max-w-measure text-pretty mb-5">
          Sign in with the email address you submitted your tool with. If it's published, it'll be
          waiting for you.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/promote/dashboard" className="stamp">
            Promote your tool <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <Link to="/submit" className="stamp-paper">Not listed yet? Submit your tool</Link>
        </div>
      </section>
    </div>
  );
}
