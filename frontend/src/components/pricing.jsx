/**
 * The pricing block on a tool page.
 *
 * Everything here is read from the vendor's own pricing page by the
 * verification pipeline and stored; the page never waits on an external site.
 * Three states, and they are genuinely different claims rather than three
 * shades of the same hedge:
 *
 *   verified    we read this from their pricing page and stand behind it
 *   custom      they publish no numbers; the answer is "talk to them"
 *   unavailable we could not confirm it, so we say so and point at the source
 *
 * The last one used to be a sentence apologising for itself. A reader does not
 * need our reasoning — they need the link that answers their question.
 */
import { useState, useId } from "react";
import { ChevronDown, Check, Minus, ExternalLink, ShieldCheck } from "lucide-react";

/* Relative where it is useful, exact on hover — "verified 2 days ago" reads as
   maintained, but anyone deciding to spend money can see the actual date. */
function verifiedAgo(iso) {
  if (!iso) return null;
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  const exact = then.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  if (days <= 0) return { relative: "today", exact };
  if (days === 1) return { relative: "yesterday", exact };
  if (days < 7) return { relative: days + " days ago", exact };
  if (days < 14) return { relative: "last week", exact };
  if (days < 60) return { relative: Math.floor(days / 7) + " weeks ago", exact };
  return { relative: Math.floor(days / 30) + " months ago", exact };
}

const yesNo = (v) => (v
  ? <span className="inline-flex items-center gap-1.5"><Check size={13} aria-hidden="true" /> Yes</span>
  : <span className="inline-flex items-center gap-1.5 opacity-55"><Minus size={13} aria-hidden="true" /> No</span>);

/** The verification line. Quiet by design: a claim, its date, and nothing else. */
function VerifiedLine({ pricing, tone = "dark" }) {
  const when = verifiedAgo(pricing.lastVerifiedAt);
  if (!when) return null;
  const muted = tone === "dark" ? "text-white/70" : "text-ink2";
  return (
    <p className={`inline-flex items-center gap-1.5 font-mono text-label uppercase tracking-[.12em] ${muted}`}>
      <ShieldCheck size={12} aria-hidden="true" />
      <span>Pricing verified <time dateTime={pricing.lastVerifiedAt} title={when.exact}>{when.relative}</time></span>
    </p>
  );
}

/** The plan ladder, as a table because that is what it is. */
function PlanTable({ plans, tone = "dark" }) {
  if (!plans?.length) return null;
  const line = tone === "dark" ? "border-white/20" : "border-ink/15";
  const muted = tone === "dark" ? "text-white/60" : "text-ink2";
  const body = tone === "dark" ? "text-white" : "text-ink";

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-sm border-collapse">
        <caption className="sr-only">Plans and prices</caption>
        <thead>
          <tr className={`border-b ${line}`}>
            <th scope="col" className={`text-left font-mono text-nano uppercase tracking-[.14em] ${muted} pb-2 pr-4`}>Plan</th>
            <th scope="col" className={`text-right font-mono text-nano uppercase tracking-[.14em] ${muted} pb-2 px-4`}>Price</th>
            <th scope="col" className={`text-left font-mono text-nano uppercase tracking-[.14em] ${muted} pb-2 pl-4`}>Billing</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.name} className={`border-b ${line} last:border-0`}>
              <th scope="row" className={`text-left font-normal ${body} py-2 pr-4`}>
                {p.name}
                {p.isPopular && (
                  <span className={`ml-2 font-mono text-nano uppercase tracking-[.12em] ${muted}`}>
                    their pick
                  </span>
                )}
              </th>
              <td className={`text-right tabular-nums ${body} py-2 px-4 whitespace-nowrap`}>{p.display}</td>
              <td className={`text-left font-mono text-label ${muted} py-2 pl-4 whitespace-nowrap`}>
                {p.isCustom ? "Talk to sales"
                  : p.isFree ? "Free"
                    : (p.billingPeriod === "year" ? "Yearly" : p.billingPeriod === "one-time" ? "One-off" : "Monthly")
                      + (p.perUnit ? " · per " + p.perUnit : "")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The link out. Always present, in every state — it is the one thing that
    always answers the reader's question. */
function OfficialLink({ href, name, tone = "dark", strong = false }) {
  if (!href) return null;
  const cls = tone === "dark"
    ? "text-white hover:text-white/75 underline-offset-4"
    : "text-accentDeep hover:text-ink underline-offset-4";
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow"
      className={`inline-flex items-center gap-2 font-mono text-label uppercase tracking-[.12em] underline min-h-touch sm:min-h-0 transition-colors ${cls} ${strong ? "font-semibold" : ""}`}>
      {name ? `${name}'s official pricing` : "View official pricing"}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

/**
 * The hero control. Collapsed it states the price; opened it shows the ladder
 * and the caveats. A real button, because it looked like one long before it
 * behaved like one.
 */
export function PriceDisclosure({ tool }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const p = tool.pricing;
  const official = p?.pricingUrl || tool.websiteUrl || null;

  const verified = p && p.status === "verified" && p.headline;
  const custom = p && p.status === "custom_pricing";
  const label = verified ? p.headline : custom ? "Custom pricing" : "Pricing";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="group inline-flex items-center gap-2.5 font-mono text-sm text-white tabular-nums
          border-2 border-white/30 hover:border-white/70 focus-visible:border-white
          rounded-ui pl-3.5 pr-2.5 py-1.5 transition-colors min-h-touch sm:min-h-0"
      >
        {verified && <span className="font-mono text-nano uppercase tracking-[.14em] text-white/60">from</span>}
        <span className="font-semibold">{label}</span>
        {p?.freePlan && (
          <span className="font-mono text-nano uppercase tracking-[.12em] text-white/60 border-l border-white/25 pl-2.5">
            free plan
          </span>
        )}
        <ChevronDown size={14} aria-hidden="true"
          className={"transition-transform duration-300 " + (open ? "rotate-180" : "group-hover:translate-y-0.5")} />
      </button>

      <div id={panelId} hidden={!open}
        className="w-full mt-1 border-2 border-white/30 rounded-card bg-black/20 backdrop-blur-sm p-4 sm:p-5">
        {verified || custom ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-4">
              <div>
                <p className="font-mono text-label uppercase tracking-[.16em] text-white/60 mb-1">
                  {verified ? "Starting at" : "Pricing"}
                </p>
                <p className="font-display text-2xl sm:text-3xl font-semibold leading-none text-white tabular-nums">
                  {verified ? p.headline : "Quoted on request"}
                </p>
              </div>
              <VerifiedLine pricing={p} />
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 pb-4 border-b border-white/20">
              <div>
                <dt className="font-mono text-nano uppercase tracking-wide text-white/55 mb-1">Free plan</dt>
                <dd className="font-mono text-sm text-white">{yesNo(p.freePlan)}</dd>
              </div>
              <div>
                <dt className="font-mono text-nano uppercase tracking-wide text-white/55 mb-1">Free trial</dt>
                <dd className="font-mono text-sm text-white">{yesNo(p.freeTrial)}</dd>
              </div>
              {p.sourceLabel && (
                <div className="col-span-2 sm:col-span-1">
                  <dt className="font-mono text-nano uppercase tracking-wide text-white/55 mb-1">Source</dt>
                  <dd className="font-mono text-sm text-white">{p.sourceLabel}</dd>
                </div>
              )}
            </dl>

            <PlanTable plans={p.plans} />

            <p className="text-xs text-white/65 leading-snug text-pretty mt-4 mb-3">
              Plan prices move, and vendors localise them. Check before you commit.
            </p>
            <OfficialLink href={official} name={tool.name} />
          </>
        ) : (
          <>
            <p className="font-mono text-label uppercase tracking-[.16em] text-white/60 mb-1.5">Pricing</p>
            <p className="font-display text-xl sm:text-2xl font-semibold leading-tight text-white mb-2">
              Current pricing unavailable
            </p>
            <p className="text-sm text-white/75 leading-snug text-pretty mb-4 max-w-md">
              We could not confidently verify {tool.name}&rsquo;s latest public pricing, so we are not
              going to print a figure. Their own page has the current numbers.
            </p>
            <OfficialLink href={official} name={tool.name} strong />
          </>
        )}
      </div>
    </>
  );
}

/**
 * The sidebar summary, on paper rather than on the hero's colour. Same facts,
 * quieter voice — this one sits next to the buy button and must not compete
 * with it.
 */
export function PricingCard({ tool }) {
  const p = tool.pricing;
  const official = p?.pricingUrl || tool.websiteUrl || null;
  const verified = p && p.status === "verified" && p.headline;
  const custom = p && p.status === "custom_pricing";

  return (
    <div>
      <p className="font-mono text-label uppercase tracking-wide text-ink2 mb-1">Pricing</p>
      {verified ? (
        <>
          <p className="font-display text-2xl font-semibold leading-none tabular-nums mb-1">{p.headline}</p>
          {p.freePlan && (
            <p className="font-mono text-label uppercase tracking-wide text-green-700 mb-1">Free plan available</p>
          )}
          <div className="mb-4"><VerifiedLine pricing={p} tone="light" /></div>
        </>
      ) : custom ? (
        <>
          <p className="font-display text-xl font-semibold leading-tight mb-1">Quoted on request</p>
          <p className="text-xs text-ink2 mb-4 text-pretty">They publish no public prices.</p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink2 mb-2 text-pretty">Not confirmed yet.</p>
          <div className="mb-4"><OfficialLink href={official} tone="light" /></div>
        </>
      )}
    </div>
  );
}
