// The Toolhaven Score panel.
//
// Two rules govern this component. It renders nothing at all when a tool hasn't
// been assessed — an absent score is honest, a zero is a claim. And the overall
// figure always arrives computed from the API, never derived here, so the
// headline can't disagree with the bars printed beneath it.
//
// It is labelled as *our* verdict throughout, because the community's star
// rating sits elsewhere on the same page and the two must never be mistaken for
// each other.
import { Link } from "react-router-dom";

// 0–10 → the accent when strong, ink when middling, muted when weak. Colour is
// reinforcement only: every bar carries its number, so the meaning survives
// greyscale and colourblindness.
function toneFor(v) {
  if (v >= 9) return "bg-accent";
  if (v >= 7.5) return "bg-ink/70";
  return "bg-ink/40";
}

export function ScorePanel({ score, toolName }) {
  if (!score) return null;

  const scored = score.dimensions.filter((d) => d.value != null);
  const partial = score.assessed < score.total;

  return (
    <section aria-labelledby="th-score" className="border border-rule rounded-card bg-paper overflow-hidden"
      >
      <div className="flex items-start gap-5 p-5 sm:p-6 border-b border-rule">
        <div className="shrink-0 text-center">
          <div className="font-display font-semibold leading-none tracking-tight tabular-nums text-[clamp(2.75rem,9vw,4rem)]">
            {score.overall.toFixed(1)}
          </div>
          <div className="font-mono text-micro uppercase tracking-[.16em] text-ink2 mt-1">out of 10</div>
        </div>
        <div className="min-w-0">
          <h2 id="th-score" className="font-display text-xl sm:text-2xl font-semibold leading-tight mb-1">
            The Toolhaven Score
          </h2>
          <p className="text-sm text-ink2 leading-snug text-pretty">
            Our own assessment of {toolName} across {score.total} things that decide whether software is worth
            paying for. Not a community average —{" "}
            <Link to="/how-we-review" className="underline underline-offset-2 hover:text-accentDeep transition-colors">
              here's how we score
            </Link>.
          </p>
        </div>
      </div>

      <dl className="p-5 sm:p-6 space-y-3.5">
        {scored.map((d) => (
          <div key={d.key}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <dt className="font-mono text-micro uppercase tracking-[.12em]" title={d.blurb}>{d.label}</dt>
              <dd className="font-display text-base font-semibold tabular-nums shrink-0">{d.value.toFixed(1)}</dd>
            </div>
            {/* role=img with a spoken label: a bare div would be silent, and the
                number beside it already carries the value for sighted readers */}
            <div className="h-2 rounded-ui bg-paper2 overflow-hidden"
              role="img" aria-label={`${d.label}: ${d.value.toFixed(1)} out of 10`}>
              <div className={`h-full rounded-ui ${toneFor(d.value)}`} style={{ width: `${(d.value / 10) * 100}%` }} />
            </div>
          </div>
        ))}
      </dl>

      {(score.notes || partial) && (
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-2">
          {score.notes && (
            <p className="text-sm text-ink2 leading-snug text-pretty border-l-4 border-accent pl-3">{score.notes}</p>
          )}
          {partial && (
            <p className="font-mono text-micro uppercase tracking-[.12em] text-ink2">
              {score.assessed} of {score.total} assessed — the rest we haven't tested hard enough to score
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// The compact form, for cards and comparison columns.
export function ScoreBadge({ score, className = "" }) {
  if (!score) return null;
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}
      title="The Toolhaven Score — our editorial assessment out of 10">
      <span className="font-display text-lg font-semibold tabular-nums leading-none">{score.overall.toFixed(1)}</span>
      <span className="font-mono text-micro uppercase tracking-wide text-ink2">/10</span>
    </span>
  );
}
