// How we review — the methodology page.
//
// This is the page a SaaS partner, a sceptical reader or an affiliate network
// checks before deciding whether the rest of the site means anything. It only
// describes what the platform genuinely does: the criteria below map to fields
// that actually exist on a tool, and the moderation flow described is the one
// the admin console really runs.
import { Link } from "react-router-dom";
import { PageHead, SectionHead, KeyPoints, MarginContents } from "../components/editorial.jsx";
import { Breadcrumbs } from "../components/breadcrumbs.jsx";
import { Seo, breadcrumbSchema } from "../lib/seo.jsx";

const CRITERIA = [
  ["Functionality", "Does it do the job it claims, without needing three other tools bolted on?"],
  ["Ease of use", "How long before someone new is actually productive — an hour, or an afternoon?"],
  ["Features", "Depth where it matters for the job, not a long list of things nobody switches on."],
  ["Value", "What you get for the money, judged against the free tier and the nearest alternative."],
  ["Pricing", "Whether the plan you'd realistically need is the one advertised, or two tiers up."],
  ["Reliability", "Does it hold up under real load, and what happens on a bad day."],
  ["Support & docs", "Whether you can solve your own problem at 2am, and what happens when you can't."],
  ["Who it's for", "A tool that's wrong for you isn't a bad tool. We say plainly who each one suits."],
];

// One list drives the margin rail and the anchors, so the two cannot drift.
const SECTIONS = [
  { id: "criteria", label: "What we assess" },
  { id: "rating", label: "The rating" },
  { id: "catch", label: "Every catch" },
  { id: "listing", label: "Getting listed" },
  { id: "corrections", label: "Corrections" },
];

export default function HowWeReview() {
  const trail = [{ label: "Home", to: "/" }, { label: "How we review", to: "/how-we-review" }];

  return (
    <div className="relative max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      <Seo
        title="How we review"
        description="The criteria behind every Toolhaven rating, how ratings are calculated, and the rules that keep commercial relationships out of editorial decisions."
        path="/how-we-review"
        schema={breadcrumbSchema(trail)}
      />
      <MarginContents items={SECTIONS} />
      <Breadcrumbs trail={trail} />
      <PageHead kicker="Method" title="How we review">
        Every rating on this site comes from the same eight questions, asked in the same order. Here they are.
      </PageHead>

      {/* What a sceptical reader wants to know before deciding whether to
          read the method at all. */}
      <KeyPoints label="In short" points={[
        "Every tool is judged on the same eight questions, in the same order.",
        "A rating is our assessment, not a popularity score, and it is never influenced by whether a tool pays us.",
        "Every review names a catch. A tool with no downside listed has not been reviewed properly.",
      ]} />

      <div className="prose-editorial max-w-measure">
        <p className="text-lg leading-relaxed">
          Most software "reviews" are the vendor's own marketing page, reworded. The test we set ourselves is
          simple: could someone read a Toolhaven page, buy the thing, and feel we'd been straight with them?
          That means publishing the downsides of tools we recommend — including ones we earn a commission on.
        </p>
      </div>

      <span id="criteria" className="block scroll-mt-28" />
      <SectionHead folio="01" kicker="The criteria" title="What we actually assess" />
      <dl className="border-t border-rule mb-12">
        {CRITERIA.map(([term, detail], i) => (
          <div key={term} className="border-b border-rule py-4 flex gap-4 sm:gap-6">
            <span aria-hidden="true" className="font-mono text-micro tabular-nums text-ink2/60 shrink-0 w-6 pt-1">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <dt className="font-display text-lg font-semibold leading-tight mb-1">{term}</dt>
              <dd className="text-ink2 leading-snug text-pretty">{detail}</dd>
            </div>
          </div>
        ))}
      </dl>

      <span id="rating" className="block scroll-mt-28" />
      <SectionHead folio="02" kicker="The number" title="What a rating means" />
      <div className="prose-editorial max-w-measure mb-12">
        <p>
          A rating is a summary of the criteria above, out of five. It is a judgement, not a measurement — two
          people could weigh the same tool differently, and we'd rather say that than dress it up as science.
        </p>
        <p>
          Ratings are <strong>not</strong> weighted by whether a tool has an affiliate programme. A tool we earn
          nothing from can outrank one we do, and several already do. If that ever stops being true, this page
          is wrong and we should be called out on it.
        </p>
        <p>
          Reader reviews are separate from our rating. They're moderated before publication — to remove spam and
          vendor astroturfing, not criticism.
        </p>
      </div>

      <span id="catch" className="block scroll-mt-28" />
      <SectionHead folio="03" kicker="The catch" title="Why every tool has one" />
      <div className="prose-editorial max-w-measure mb-12">
        <p>
          Every tool on Toolhaven carries a field we call <em>the catch</em>: the thing you'd wish someone had
          told you a month in. A pricing cliff, a learning curve, a limit on the free tier.
        </p>
        <p>
          If we can't name a catch, the tool isn't ready to publish — not because everything is flawed, but
          because it means we haven't used it hard enough to be useful about it.
        </p>
      </div>

      <span id="listing" className="block scroll-mt-28" />
      <SectionHead folio="04" kicker="Submissions" title="How a tool gets listed" />
      <div className="prose-editorial max-w-measure mb-12">
        <p>
          Anyone can <Link to="/submit">submit a tool</Link>. Nothing publishes automatically. Each submission
          moves through <strong>pending → reviewing → listed</strong>, or is declined, and a submission is a
          request to be assessed — not a purchase of a listing or a rating.
        </p>
        <p>
          Paying us does not get a tool listed, and there is no way to buy a position. See the{" "}
          <Link to="/disclosure">affiliate disclosure</Link> for exactly how the money works.
        </p>
      </div>

      <span id="corrections" className="block scroll-mt-28" />
      <SectionHead folio="05" kicker="Corrections" title="When we get it wrong" />
      <div className="prose-editorial max-w-measure">
        <p>
          Software changes. Pricing moves, features ship, free tiers shrink. Every tool page carries the date it
          was last updated, and if something on this site is out of date or wrong,{" "}
          <Link to="/contact">tell us</Link> — we'd rather fix it than defend it.
        </p>
      </div>
    </div>
  );
}
