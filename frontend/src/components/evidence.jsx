// External evidence: what other platforms' users say, and how much that is
// worth.
//
// The design problem this solves is §4 of the brief. A tool with no Toolhaven
// reviews used to lead with "no reviews yet", which reads as "nobody has
// bothered with this" — the opposite of the truth for a product with thousands
// of reviews elsewhere. So external evidence leads, and the absence of *our*
// reviews becomes a footnote that says exactly what it means.
//
// Two rules run through all of it. Ratings are never averaged into a single
// figure, because averaging is precisely what hides that one platform disagrees.
// And a rating never appears without the source it came from and the date it
// was checked.
import { ExternalLink, AlertTriangle, Info } from "lucide-react";

const CONFIDENCE_TONE = {
  high: "border-green-700 text-green-700",
  medium: "border-ink text-ink",
  low: "border-accentDeep text-accentDeep",
  insufficient: "border-ink/40 text-ink2",
};

// The badge states what the evidence is, rather than grading it. A reader
// takes "Low confidence" beside a 4.7 as a warning about the product; what
// it actually described was the shape of our sourcing. So the badge now
// carries the two facts that matter — how many platforms, how many reviews —
// and only turns cautionary when the evidence really is thin.
export function ConfidenceBadge({ confidence, className = "" }) {
  if (!confidence || !confidence.volume) return null;
  const thin = confidence.level === "low" || confidence.level === "insufficient";
  const platforms = confidence.sources === 1 ? "1 platform" : `${confidence.sources} platforms`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-nano uppercase tracking-[.12em] px-2 py-1 rounded-ui border tabular-nums ${CONFIDENCE_TONE[confidence.level]} ${className}`}
      title={confidence.reasons.join(" · ")}
    >
      {thin && <AlertTriangle size={11} aria-hidden="true" />}
      {platforms} · {confidence.volume.toLocaleString()} reviews
    </span>
  );
}

export function ExternalRatings({ external, toolName }) {
  if (!external) return null;
  const { sources, totalReviews, confidence, disagreement } = external;

  return (
    <section aria-labelledby="ext-ratings" className="border border-rule rounded-card bg-paper overflow-hidden"
      >
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6 border-b border-rule">
        <div className="min-w-0">
          <h2 id="ext-ratings" className="font-display text-xl sm:text-2xl font-semibold leading-tight mb-1">
            What users say elsewhere
          </h2>
          <p className="text-sm text-ink2 leading-snug text-pretty">
            {totalReviews.toLocaleString()} review{totalReviews === 1 ? "" : "s"} across{" "}
            {sources.length} independent platform{sources.length === 1 ? "" : "s"}. Not Toolhaven's numbers — each
            one links back to where it came from.
          </p>
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>

      <ul className="divide-y-2 divide-ink/10">
        {sources.map((s) => (
          <li key={s.sourceName} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:px-6">
            <span className="font-display text-2xl font-semibold tabular-nums leading-none shrink-0">
              {s.rating}
              <span className="font-mono text-micro text-ink2 ml-1">/{s.maxRating}</span>
            </span>
            <span className="min-w-0 flex-1">
              <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1.5 min-h-[28px] font-mono text-xs uppercase tracking-wide hover:text-accentDeep transition-colors">
                {s.sourceName}
                <ExternalLink size={12} aria-hidden="true" />
              </a>
              <span className="block font-mono text-label text-ink2 mt-0.5 tabular-nums">
                {s.reviewCount.toLocaleString()} review{s.reviewCount === 1 ? "" : "s"}
                {" · checked "}
                {new Date(s.retrievedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </span>
            </span>
            {/* §33 — a rating from a handful of people is not the same claim */}
            {s.smallSample && (
              <span className="inline-flex items-center gap-1.5 font-mono text-nano uppercase tracking-[.12em] text-accentDeep shrink-0">
                <AlertTriangle size={12} aria-hidden="true" /> Small sample
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* §34 — say it plainly rather than smoothing it into an average */}
      {disagreement && (
        <div className="flex items-start gap-3 p-4 sm:px-6 border-t border-rule bg-accent/[.06]">
          <Info size={16} className="text-accentDeep shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm leading-snug text-pretty">
            <strong>Platforms disagree about {toolName}.</strong>{" "}
            {disagreement.highest} rates it noticeably higher than {disagreement.lowest} — a spread of{" "}
            {disagreement.spread} points. Worth reading both before deciding; the smaller sample is usually the
            more volatile one.
          </p>
        </div>
      )}
    </section>
  );
}

// §7 — evidence confidence, which is emphatically not product quality. The
// tooltip says so, because a number labelled "trust" invites exactly that
// misreading.
export function TrustBadge({ trust, className = "" }) {
  if (!trust) return null;
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}
      title="How much evidence exists about this tool — not how good it is. Built from external reviews, cited facts, our own assessment and reader reviews.">
      <span className="font-display text-lg font-semibold tabular-nums leading-none">{trust.score}</span>
      <span className="font-mono text-micro uppercase tracking-wide text-ink2">/100 evidence</span>
    </span>
  );
}

// The honest version of "not rated yet": states what we do and don't have,
// without implying nobody uses the thing.
export function CommunityStanding({ reviewCount, hasExternal }) {
  if (reviewCount > 0) return null;
  return (
    <p className="font-mono text-label uppercase tracking-[.12em] text-ink2 text-pretty">
      No Toolhaven reader reviews yet
      {hasExternal ? " — the ratings above are from other platforms, not ours." : "."}
    </p>
  );
}
