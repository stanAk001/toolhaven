/**
 * Noticing that a price moved.
 *
 * The rule is that history is append-only. When a price changes, the previous
 * state is written to its own row and the new one takes its place; nothing is
 * ever edited in place, because "what did this cost in March?" is a question
 * Toolhaven should be able to answer and most directories cannot.
 *
 * Only meaningful movement is recorded. Re-reading the same page every week and
 * writing "no change" forty times would bury the one week that mattered.
 */

const round1 = (n) => Math.round(n * 10) / 10;
const planKey = (p) => String(p.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * @returns {null|{changeType, previousPrice, newPrice, percentChange, summary}}
 *          null when nothing worth recording has changed.
 */
export function diffPricing(previous, next) {
  if (!next) return null;
  if (!previous) {
    return {
      changeType: "first-record",
      previousPrice: null,
      newPrice: next.startingPrice ?? null,
      percentChange: null,
      summary: "First pricing record for this tool.",
    };
  }

  const before = previous.startingPrice ?? null;
  const after = next.startingPrice ?? null;

  // A currency change makes the numbers incomparable, so it is reported as
  // itself rather than as a 400% increase.
  if (previous.currency && next.currency && previous.currency !== next.currency) {
    return {
      changeType: "currency-changed",
      previousPrice: before, newPrice: after, percentChange: null,
      summary: `Pricing now quoted in ${next.currency}, previously ${previous.currency}.`,
    };
  }

  if (before !== null && after !== null && before !== after) {
    const pct = before === 0 ? null : round1(((after - before) / before) * 100);
    return {
      changeType: after > before ? "increase" : "decrease",
      previousPrice: before, newPrice: after, percentChange: pct,
      summary: `Starting price ${after > before ? "rose" : "fell"} from ${before} to ${after}${pct === null ? "" : ` (${pct > 0 ? "+" : ""}${pct}%)`}.`,
    };
  }

  if (!!previous.freePlan !== !!next.freePlan) {
    return {
      changeType: "free-plan-changed",
      previousPrice: before, newPrice: after, percentChange: null,
      summary: next.freePlan ? "A free plan has appeared." : "The free plan is gone.",
    };
  }

  const was = new Set((previous.plans || []).map(planKey));
  const now = new Set((next.plans || []).map(planKey));
  const added = [...now].filter((k) => !was.has(k));
  const removed = [...was].filter((k) => !now.has(k));
  if (added.length) {
    const names = (next.plans || []).filter((p) => added.includes(planKey(p))).map((p) => p.name);
    return { changeType: "plan-added", previousPrice: before, newPrice: after, percentChange: null,
      summary: `New plan${names.length > 1 ? "s" : ""}: ${names.join(", ")}.` };
  }
  if (removed.length) {
    const names = (previous.plans || []).filter((p) => removed.includes(planKey(p))).map((p) => p.name);
    return { changeType: "plan-removed", previousPrice: before, newPrice: after, percentChange: null,
      summary: `Plan${names.length > 1 ? "s" : ""} withdrawn: ${names.join(", ")}.` };
  }

  if (previous.billingPeriod && next.billingPeriod && previous.billingPeriod !== next.billingPeriod) {
    return { changeType: "billing-changed", previousPrice: before, newPrice: after, percentChange: null,
      summary: `Billing period changed from ${previous.billingPeriod} to ${next.billingPeriod}.` };
  }
  return null;
}

/** Movement large enough that an editor should look before readers do. */
export const isSignificant = (change, thresholdPct = 15) =>
  !!change && (
    ["plan-removed", "free-plan-changed", "currency-changed", "billing-changed"].includes(change.changeType)
    || (change.percentChange !== null && Math.abs(change.percentChange) >= thresholdPct)
  );
