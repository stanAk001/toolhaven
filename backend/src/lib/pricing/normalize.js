/**
 * Turning an extraction into the one shape the rest of Toolhaven understands.
 *
 * Normalising is not the same as tidying away. The original text every figure
 * was read from travels with it into the database, because the only way to
 * answer "where did this price come from?" six months later is to have kept
 * the answer. Nothing here converts between currencies: a page that quotes
 * naira is recorded in naira, and the reader sees naira.
 */

import { pickHeadlinePlan } from "./tiers.js";

const PERIODS = new Set(["month", "year", "one-time", "usage"]);

export function normalize(extraction, { pricingUrl, sourceUrl, sourceType }) {
  const plans = (extraction.plans || []).map((p, i) => ({
    name: p.name.trim().slice(0, 60),
    price: p.price === null || p.price === undefined ? null : Number(p.price),
    currency: (p.currency || extraction.currency || "USD").toUpperCase().slice(0, 3),
    billingPeriod: PERIODS.has(p.billingPeriod) ? p.billingPeriod : "month",
    billingType: p.billingType || null,
    isFree: !!p.isFree || p.price === 0,
    isCustom: !!p.isCustom,
    isPopular: !!extraction.popularHint && p.name.toLowerCase().includes(String(extraction.popularHint).toLowerCase()),
    perUnit: p.perUnit || null,
    note: null,
    rawText: (p.rawText || "").slice(0, 400),
    orderIndex: i,
  }));

  const paid = plans.filter((p) => p.price !== null && p.price > 0);
  // The headline comes from a recognisable tier, not from whichever row on the
  // page happens to carry the smallest number. See tiers.js for why.
  const picked = pickHeadlinePlan(plans);
  const cheapest = picked.plan;

  // "Custom pricing" is an answer, not a gap: a product that only sells through
  // sales calls has a knowable pricing model even with no number attached.
  const allCustom = (plans.length > 0 && !paid.length && plans.every((p) => p.isCustom || p.isFree))
    // A page that publishes no numbers at all and asks you to call is still
    // stating its pricing model. Treating that as "unavailable" reported a
    // successful reading as a failure.
    || (plans.length === 0 && !!extraction.customOnly);
  const pricingModel =
    cheapest && cheapest.perUnit && /user|seat|member|editor|agent/.test(cheapest.perUnit) ? "per-seat"
      : cheapest && cheapest.billingPeriod === "usage" ? "usage"
        : cheapest && cheapest.billingPeriod === "one-time" ? "one-time"
          : allCustom && extraction.customOnly ? "custom"
            : cheapest && extraction.freePlan ? "freemium"
              : cheapest ? "subscription"
                : extraction.freePlan && !cheapest ? "free"
                  : null;

  return {
    currency: cheapest?.currency || extraction.currency || "USD",
    // A free tier is not a starting price. Where a product has a free plan and
    // no paid tier we could read, the honest answer is that we do not know what
    // the paid tier costs — not that it costs nothing.
    startingPrice: cheapest ? cheapest.price : (extraction.freePlan && !paid.length && allFreeNoUpgrade(extraction) ? 0 : null),
    headlineFromTier: picked.fromTier,
    billingPeriod: cheapest?.billingPeriod || (extraction.freePlan ? "month" : null),
    billingType: cheapest?.billingType || (cheapest?.billingPeriod === "year" ? "annual" : cheapest ? "monthly" : null),
    pricingModel,
    freePlan: !!extraction.freePlan,
    freeTrial: !!extraction.freeTrial,
    pricingUrl: pricingUrl || null,
    sourceUrl: sourceUrl || null,
    sourceType: sourceType || null,
    extractionMethod: extraction.method || null,
    plans,
  };
}

/**
 * How a normalized record should read on a page. One sentence, correct about
 * the billing period — "$108/year" must never become "$108/month".
 */
// A product is genuinely free only when nothing on the page sells an upgrade.
const allFreeNoUpgrade = (extraction) =>
  !(extraction.plans || []).some((p) => p.isCustom) && extraction.pricingModelHint !== "freemium";

export function headline(pricing) {
  if (!pricing) return null;
  if (pricing.pricingModel === "custom") return "Custom pricing";
  if (pricing.startingPrice === null) return null;
  if (pricing.startingPrice === 0 && pricing.pricingModel === "free") return "Free";

  const money = formatMoney(pricing.startingPrice, pricing.currency);
  const per = pricing.billingPeriod === "year" ? "/year"
    : pricing.billingPeriod === "one-time" ? " once"
      : pricing.billingPeriod === "usage" ? ""
        : "/month";
  const seat = pricing.plans?.find((p) => p.price === pricing.startingPrice)?.perUnit;
  const unit = seat && /user|seat|member|editor|agent/.test(seat) ? ` per ${seat}` : "";
  return money + per + unit;
}

export function formatMoney(value, currency = "USD") {
  if (value === null || value === undefined) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency,
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}
