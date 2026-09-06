// The editorial verdict — everything on a tool page that is Toolhaven's
// judgement rather than the vendor's claim or a platform's rating.
//
// Every block returns null when its field is empty. A tool nobody has assessed
// shows none of this rather than a row of empty headings: a section titled
// "You might regret this if..." with nothing under it implies there is nothing
// to regret, which is a claim we have not earned.
import { Link } from "react-router-dom";
import { Check, X, AlertTriangle, ArrowRight, Scale } from "lucide-react";
import { ToolLogo } from "./toollogo.jsx";
import { priceLabel } from "../lib/helpers.jsx";

const SWITCHING = {
  low: { label: "Low", tone: "border-green-700 text-green-700", note: "Your work is portable. Leaving is mostly a weekend." },
  medium: { label: "Medium", tone: "border-ink text-ink", note: "Expect to rebuild some workflows and reconnect integrations." },
  high: { label: "High", tone: "border-accentDeep text-accentDeep", note: "Real lock-in. Budget proper time before you commit." },
};

const CLAIM = {
  supported: { label: "Supported", tone: "text-green-700", Icon: Check },
  "partly-supported": { label: "Partly supported", tone: "text-ink", Icon: AlertTriangle },
  unsupported: { label: "Not supported by the evidence", tone: "text-accentDeep", Icon: X },
  untested: { label: "Not yet tested", tone: "text-ink2", Icon: AlertTriangle },
};

// Who it fits and who it doesn't, side by side so neither can be skimmed past.
export function AudienceFit({ verdict }) {
  const best = verdict?.bestFor || [];
  const not = verdict?.notIdealFor || [];
  if (!best.length && !not.length) return null;

  return (
    <section aria-labelledby="fit" className="mb-10">
      <h2 id="fit" className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-4">Who it’s for</h2>
      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        {best.length > 0 && (
          <div className="border border-rule rounded-card bg-paper p-5">
            <h3 className="font-display text-lg font-semibold mb-3">Best for</h3>
            <ul className="space-y-2">
              {best.map((x) => (
                <li key={x} className="flex gap-2.5 text-sm text-pretty">
                  <Check size={16} className="text-green-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {not.length > 0 && (
          <div className="border border-rule rounded-card bg-paper2/40 p-5">
            <h3 className="font-display text-lg font-semibold mb-3">Not ideal for</h3>
            <ul className="space-y-2">
              {not.map((x) => (
                <li key={x} className="flex gap-2.5 text-sm text-ink2 text-pretty">
                  <X size={16} className="text-accentDeep shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// The same judgement in the second person, which is where it actually lands.
export function LoveRegret({ verdict, toolName }) {
  const love = verdict?.loveIf || [];
  const regret = verdict?.regretIf || [];
  if (!love.length && !regret.length) return null;

  return (
    <section aria-labelledby="loveregret" className="mb-10">
      <h2 id="loveregret" className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-4">
        Before you commit
      </h2>
      <div className="grid sm:grid-cols-2 gap-5">
        {love.length > 0 && (
          <div className="border-l-4 border-green-700 pl-4 py-1">
            <h3 className="font-display text-lg font-semibold mb-2">You will probably love {toolName} if…</h3>
            <ul className="space-y-1.5 text-sm text-ink2">
              {love.map((x) => <li key={x} className="text-pretty">{x}</li>)}
            </ul>
          </div>
        )}
        {regret.length > 0 && (
          <div className="border-l-4 border-accent pl-4 py-1">
            <h3 className="font-display text-lg font-semibold mb-2">You might regret it if…</h3>
            <ul className="space-y-1.5 text-sm text-ink2">
              {regret.map((x) => <li key={x} className="text-pretty">{x}</li>)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// The vendor's positioning set against what the evidence supports. Phrased as
// an assessment of a claim, never as an accusation about a company.
export function RealityCheck({ verdict }) {
  if (!verdict?.companyClaim) return null;
  const v = CLAIM[verdict.claimVerdict] || CLAIM.untested;
  const Icon = v.Icon;

  return (
    <section aria-labelledby="reality" className="mb-10 border border-rule rounded-card bg-paper overflow-hidden">
      <h2 id="reality" className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep px-5 pt-5 pb-3">
        Reality check
      </h2>
      <dl className="px-5 pb-5 space-y-4">
        <div>
          <dt className="font-mono text-label uppercase tracking-wide text-ink2 mb-1">They say</dt>
          <dd className="font-display text-lg leading-snug text-pretty">{verdict.companyClaim}</dd>
        </div>
        {verdict.claimEvidence && (
          <div>
            <dt className="font-mono text-label uppercase tracking-wide text-ink2 mb-1">What the evidence shows</dt>
            <dd className="text-sm leading-relaxed text-pretty">{verdict.claimEvidence}</dd>
          </div>
        )}
        <div className="flex items-center gap-2 pt-3 border-t border-rule">
          <Icon size={16} className={v.tone + " shrink-0"} aria-hidden="true" />
          <span className={"font-mono text-xs uppercase tracking-wide " + v.tone}>{v.label}</span>
        </div>
      </dl>
    </section>
  );
}

// What adds to the bill, and how hard it is to leave once you are in.
export function CostAndSwitching({ verdict }) {
  const costs = verdict?.costNotes || [];
  const sw = verdict?.switchingCost ? SWITCHING[verdict.switchingCost] : null;
  if (!costs.length && !sw) return null;

  return (
    <section aria-labelledby="cost" className="mb-10 grid sm:grid-cols-2 gap-3 sm:gap-4">
      <h2 id="cost" className="sr-only">Cost and switching</h2>

      {costs.length > 0 && (
        <div className="border border-rule rounded-card bg-paper p-5">
          <h3 className="font-mono text-micro uppercase tracking-[.16em] text-accentDeep mb-3">Cost considerations</h3>
          <ul className="space-y-2">
            {costs.map((c) => (
              <li key={c} className="flex gap-2.5 text-sm text-ink2">
                <span aria-hidden="true" className="text-accent shrink-0">&#10022;</span>
                <span className="text-pretty">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sw && (
        <div className="border border-rule rounded-card bg-paper p-5">
          <h3 className="font-mono text-micro uppercase tracking-[.16em] text-accentDeep mb-3">Switching difficulty</h3>
          <span className={"inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wide px-3 py-1.5 rounded-full border mb-3 " + sw.tone}>
            <Scale size={13} aria-hidden="true" /> {sw.label}
          </span>
          <p className="text-sm text-ink2 leading-snug text-pretty">{verdict.switchingNote || sw.note}</p>
        </div>
      )}
    </section>
  );
}

// Alternatives that each answer a stated need. When an editor has curated them
// every card carries its reason; when they are only category neighbours we say
// so, rather than implying a recommendation we never made.
export function AlternativeFinder({ alternatives = [], editorial, toolName }) {
  if (!alternatives.length) return null;

  return (
    <section aria-labelledby="alts" className="mb-10">
      <h2 id="alts" className="font-display text-title font-semibold mb-1 text-balance">
        Not sure {toolName} is right for you?
      </h2>
      <p className="font-mono text-micro uppercase tracking-[.12em] text-ink2 mb-5">
        {editorial ? "Picked by us, with the reason each one is here" : "Others in the same category"}
      </p>

      <ul className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        {alternatives.map((a) => (
          <li key={a.slug}>
            <Link to={"/tools/" + a.slug}
              className="tactile group flex gap-3 h-full border border-rule rounded-card bg-paper p-4">
              <ToolLogo tool={a} size={40} />
              <span className="min-w-0 flex-1">
                {a.reason && (
                  <span className="block font-mono text-label uppercase tracking-wide text-accentDeep mb-1">
                    {a.reason}
                  </span>
                )}
                <span className="block font-display text-lg font-semibold leading-tight">{a.name}</span>
                <span className="block text-xs text-ink2 leading-snug line-clamp-2 mt-1">{a.description}</span>
                <span className="block font-mono text-label text-ink2 mt-2 tabular-nums">{priceLabel(a)}</span>
              </span>
              <ArrowRight size={16} aria-hidden="true"
                className="shrink-0 text-ink2 transition-transform group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// The closing judgement. Signed, so a reader knows a person stands behind it.
export function FinalVerdict({ verdict, toolName }) {
  if (!verdict) return null;
  if (!verdict.finalVerdict && !verdict.biggestStrength && !verdict.biggestTradeoff && !verdict.valueAssessment) return null;

  return (
    <section aria-labelledby="final" className="mb-10 border border-rule rounded-card bg-paper overflow-hidden tactile-lg">
      <div className="border-b border-rule px-5 sm:px-6 py-4">
        <h2 id="final" className="font-display text-xl sm:text-2xl font-semibold leading-tight text-balance">
          The Toolhaven verdict on {toolName}
        </h2>
      </div>

      <div className="px-5 sm:px-6 py-5 space-y-5">
        {(verdict.biggestStrength || verdict.biggestTradeoff) && (
          <dl className="grid sm:grid-cols-2 gap-4">
            {verdict.biggestStrength && (
              <div>
                <dt className="font-mono text-label uppercase tracking-wide text-green-700 mb-1">Biggest strength</dt>
                <dd className="text-sm leading-snug text-pretty">{verdict.biggestStrength}</dd>
              </div>
            )}
            {verdict.biggestTradeoff && (
              <div>
                <dt className="font-mono text-label uppercase tracking-wide text-accentDeep mb-1">Biggest trade-off</dt>
                <dd className="text-sm leading-snug text-pretty">{verdict.biggestTradeoff}</dd>
              </div>
            )}
          </dl>
        )}

        {verdict.valueAssessment && (
          <div>
            <p className="font-mono text-label uppercase tracking-wide text-ink2 mb-1">Is it worth the money?</p>
            <p className="text-sm leading-relaxed text-pretty">{verdict.valueAssessment}</p>
          </div>
        )}

        {verdict.finalVerdict && (
          <p className="font-display text-lg leading-relaxed text-pretty border-l-4 border-accent pl-4">
            {verdict.finalVerdict}
          </p>
        )}

        {verdict.reviewedBy && (
          <p className="font-mono text-label uppercase tracking-[.12em] text-ink2">
            Assessed by {verdict.reviewedBy}
            {verdict.updatedAt ? " / updated " + new Date(verdict.updatedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : ""}
          </p>
        )}
      </div>
    </section>
  );
}
