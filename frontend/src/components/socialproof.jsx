// Social proof, with its receipts attached.
//
// The rule this component exists to enforce: four kinds of evidence must never
// be blended into one number.
//
//   official   the vendor's own published figure     → cite and date it
//   external   a third-party review platform         → cite and date it
//   community  computed from Toolhaven reviews       → ours, but readers' words
//   editorial  the Toolhaven Score                   → our judgement
//
// "4.7/5 from 128 reviews" and "3,000+ integrations" are not the same class of
// claim, and a strip that presents them identically is quietly misleading. Each
// fact here carries where it came from and when it was last checked.
//
// If nothing has been verified, this renders nothing. An empty section is
// honest; an invented one is not.
import { ScoreBadge } from "./score.jsx";

const KIND_LABEL = {
  official: "Vendor",
  external: "Third party",
  community: "Toolhaven readers",
  editorial: "Toolhaven",
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : null;

/**
 * @param {object[]} facts  ToolFact rows: { kind, label, value, sourceName, sourceUrl, verifiedAt }
 * @param {object}   tool   for the community rating and score
 */
export function SocialProof({ facts = [], tool }) {
  const hasCommunity = Number(tool?.reviewCount) > 0;
  const hasScore = Boolean(tool?.score);
  const verified = facts.filter((f) => f.value);

  // Nothing verified, no reviews, no score → say nothing at all.
  if (!verified.length && !hasCommunity && !hasScore) return null;

  return (
    <section aria-labelledby="proof" className="border-y border-rule py-5 my-8">
      <h2 id="proof" className="sr-only">Evidence and adoption</h2>

      <ul className="flex flex-wrap items-stretch gap-x-8 gap-y-5">
        {hasScore && (
          <Item
            value={<ScoreBadge score={tool.score} />}
            label="Toolhaven Score"
            kind="editorial"
            note="Our assessment"
          />
        )}

        {hasCommunity && (
          <Item
            value={`${Number(tool.rating).toFixed(1)}/5`}
            label={`From ${Number(tool.reviewCount).toLocaleString()} reader${tool.reviewCount === 1 ? "" : "s"}`}
            kind="community"
            note="Reader reviews"
          />
        )}

        {verified.map((f) => (
          <Item
            key={f.id}
            value={f.value}
            label={f.label}
            kind={f.kind}
            note={f.sourceName}
            href={f.sourceUrl}
            verifiedAt={f.verifiedAt}
          />
        ))}
      </ul>
    </section>
  );
}

function Item({ value, label, kind, note, href, verifiedAt }) {
  const source = note || KIND_LABEL[kind] || null;
  const when = fmtDate(verifiedAt);

  return (
    <li className="min-w-0">
      <div className="font-display text-2xl font-semibold leading-none tabular-nums mb-1.5">{value}</div>
      <div className="font-mono text-micro uppercase tracking-[.14em] text-ink2">{label}</div>
      {source && (
        <div className="font-mono text-nano uppercase tracking-[.12em] text-ink2/70 mt-1">
          {/* the citation — a figure without one is just a number we typed */}
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow"
              className="underline underline-offset-2 hover:text-accentDeep transition-colors">
              {source}
            </a>
          ) : source}
          {when && <span> · checked {when}</span>}
        </div>
      )}
    </li>
  );
}

// A single line for the foot of a profile, stating when the page's factual
// claims were last confirmed. Rendered only when something actually has been.
export function LastVerified({ facts = [] }) {
  const dates = facts.map((f) => f.verifiedAt).filter(Boolean).map((d) => new Date(d));
  if (!dates.length) return null;
  const newest = new Date(Math.max(...dates));
  return (
    <p className="font-mono text-micro uppercase tracking-[.12em] text-ink2 mt-6">
      Product information last verified{" "}
      {newest.toLocaleDateString(undefined, { month: "long", year: "numeric" })}.
      Pricing and features change — check the vendor before buying.
    </p>
  );
}
