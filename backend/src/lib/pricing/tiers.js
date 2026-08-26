/**
 * Telling a plan from a line item.
 *
 * Modern pricing pages are not four cards in a row any more. Vercel's lists
 * "Hobby $0" and "Pro $20" alongside "Vercel Compute $0.12" and "Observability
 * $1.20"; read naively, the cheapest priced row is twelve cents and the page
 * says the product starts at $0.12/month, which is both wrong and confident —
 * the worst combination a review site can publish.
 *
 * So the headline may only come from something that reads like a subscription
 * tier. Add-ons, usage rates and feature rows are still stored, because they
 * are real and an editor may want them, but they cannot become the headline.
 */

const TIER_WORDS = [
  "free", "freemium", "starter", "start", "basic", "lite", "personal", "individual",
  "solo", "hobby", "core", "standard", "plus", "pro", "professional", "premium",
  "team", "teams", "business", "growth", "scale", "advanced", "essential",
  "essentials", "enterprise", "ultimate", "unlimited", "beginner", "custom",
  "seat", "full seat", "dev seat", "collab seat",
];

// Words that mark a row as something you add to a plan, not a plan itself.
const ADD_ON = /\b(add[-\s]?on|compute|bandwidth|storage|observability|firewall|analytics|credits?|overages?|usage|support\s+package|extra|per\s+\d)\b/i;

export function isTierName(name) {
  const t = String(name || "").trim().toLowerCase();
  if (!t || t.length > 30) return false;
  if (ADD_ON.test(t)) return false;
  return TIER_WORDS.some((w) => t === w || t.startsWith(w + " ") || t.endsWith(" " + w) || t === w + " plan");
}

/**
 * The plan a buyer would call "the cheapest paid plan".
 *
 * Tier-named plans first. Falls back to any paid plan only when nothing on the
 * page is recognisable, and tells the caller it had to, so confidence can drop.
 */
export function pickHeadlinePlan(plans = []) {
  const paid = plans.filter((p) => p.price !== null && p.price > 0 && !p.isCustom);
  if (!paid.length) return { plan: null, fromTier: false };

  const tiered = paid.filter((p) => isTierName(p.name));
  if (tiered.length) {
    return { plan: tiered.reduce((a, b) => (b.price < a.price ? b : a)), fromTier: true };
  }
  return { plan: paid.reduce((a, b) => (b.price < a.price ? b : a)), fromTier: false };
}

/**
 * Does this reading hang together? Returns the problems found, which the
 * confidence engine turns into a penalty and the admin desk shows verbatim.
 */
export function implausibilities(normalized) {
  const bad = [];
  const plans = normalized.plans || [];
  const price = normalized.startingPrice;

  if (price !== null && price > 0 && price < 2 && normalized.billingPeriod === "month"
      && normalized.pricingModel !== "usage") {
    bad.push("Starting price under $2/month usually means a usage rate was read as a plan");
  }
  if (price === 0 && normalized.pricingModel !== "free") {
    bad.push("Starting price of zero with paid tiers present");
  }
  // A tier called Pro or Business priced at zero is not a generous vendor, it
  // is a page whose prices never rendered. Grammarly came back with
  // "Free = 0, Pro = 0" and was recorded as a free product.
  const PAID_SOUNDING = /^(pro|professional|premium|business|team|teams|enterprise|advanced|plus|growth|scale|ultimate|standard)\b/i;
  const zeroPaid = plans.filter((p) => p.price === 0 && PAID_SOUNDING.test(String(p.name).trim()));
  if (zeroPaid.length) {
    bad.push("A paid-sounding tier (" + zeroPaid[0].name + ") is priced at zero, so the prices probably did not load");
  }

  const named = plans.filter((p) => isTierName(p.name));
  if (plans.length > 0 && named.length === 0) {
    bad.push("No plan carries a recognisable tier name");
  }
  if (plans.length === 1 && !plans[0].isCustom) {
    bad.push("Only one plan found, which is rarely a whole pricing page");
  }
  if (plans.some((p) => /^plan$/i.test(String(p.name).trim()))) {
    bad.push("A plan has no name of its own");
  }
  // The spread check looks only at tier-named plans. A page that lists real
  // tiers alongside usage rates legitimately spans three orders of magnitude,
  // and penalising that punished pages we were reading correctly.
  const pricedTiers = plans.filter((p) => p.price !== null && p.price > 0 && isTierName(p.name));
  if (pricedTiers.length > 2) {
    const values = pricedTiers.map((p) => p.price).sort((a, b) => a - b);
    const spread = values[values.length - 1] / Math.max(values[0], 0.01);
    if (spread > 200) bad.push("Tier prices span too wide a range to be one plan ladder");
  }
  return bad;
}

export { TIER_WORDS };
