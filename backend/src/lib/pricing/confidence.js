/**
 * How much a figure is allowed to claim.
 *
 * This is the module that decides whether a price appears on a tool page as a
 * verified fact, appears hedged, or does not appear at all. It exists because
 * the alternative — showing whatever the extractor returned — would eventually
 * put a wrong price under Toolhaven's name, and a review site that gets a price
 * wrong has spent the only thing it has.
 *
 * Scoring is additive from evidence, never from optimism. A price with no plan
 * name, no currency and no period attached is a number someone found on a
 * webpage, and it scores like one.
 */

export const STATUS = {
  VERIFIED: "verified",
  PARTIAL: "partially_verified",
  UNVERIFIED: "unverified",
  UNAVAILABLE: "unavailable",
  CUSTOM: "custom_pricing",
};

// Only a figure at or above this may be presented to a reader as a price.
export const PUBLISH_THRESHOLD = 0.8;

import { implausibilities } from "./tiers.js";

const sameSite = (a, b) => {
  try {
    const reg = (h) => h.replace(/^www\./, "").split(".").slice(-2).join(".");
    return reg(new URL(a).hostname) === reg(new URL(b).hostname);
  } catch { return false; }
};

/**
 * @param {object} normalized   output of normalize()
 * @param {object} ctx          { officialUrl, pricingUrl, sourceUrl, sourceType, fetchedAt }
 * @returns {{status, score, reasons}}
 */
export function scorePricing(normalized, ctx = {}) {
  const reasons = [];
  let score = 0;

  // Provenance is worth more than anything the page says, because a correct
  // price from the wrong site is still the wrong price.
  if (ctx.sourceUrl && ctx.officialUrl && sameSite(ctx.sourceUrl, ctx.officialUrl)) {
    score += 0.34; reasons.push("Read from the vendor's own domain");
  } else if (ctx.sourceUrl) {
    reasons.push("Source is not the vendor's own domain");
  }

  if (ctx.sourceType === "official-pricing-page") { score += 0.16; reasons.push("Found the official pricing page"); }
  else if (ctx.sourceType === "official-website") { score += 0.06; reasons.push("Read from the vendor's website, not a dedicated pricing page"); }

  const method = normalized.extractionMethod;
  if (method === "json-ld") { score += 0.18; reasons.push("Vendor published machine-readable pricing"); }
  else if (method === "embedded-json") { score += 0.12; reasons.push("Read from the page's own pricing data"); }
  else if (method === "html-text") { score += 0.06; reasons.push("Read from the page's pricing layout"); }

  const plans = normalized.plans || [];
  const named = plans.filter((p) => p.name && p.name.length > 1);
  if (named.length >= 3) { score += 0.12; reasons.push(`${named.length} named plans agree on the structure`); }
  else if (named.length === 2) { score += 0.08; reasons.push("Two named plans found"); }
  else if (named.length === 1) { score += 0.04; reasons.push("Only one plan identified"); }
  else reasons.push("No plan names found");

  // The headline figure has to be attached to a plan, not floating.
  const headlinePlan = plans.find((p) => p.price === normalized.startingPrice && p.price !== null);
  if (headlinePlan) { score += 0.08; reasons.push(`Starting price belongs to the "${headlinePlan.name}" plan`); }
  else if (normalized.startingPrice !== null) reasons.push("Starting price is not tied to a named plan");

  if (normalized.currency) { score += 0.06; reasons.push(`Currency identified as ${normalized.currency}`); }
  else reasons.push("No currency identified");

  if (normalized.billingPeriod) { score += 0.06; reasons.push(`Billed per ${normalized.billingPeriod}`); }
  else reasons.push("No billing period identified");

  // Recency: a price verified long ago describes software that may have
  // repriced twice since.
  const ageDays = ctx.fetchedAt ? (Date.now() - new Date(ctx.fetchedAt).getTime()) / 86400000 : 0;
  if (ageDays > 90) { score -= 0.15; reasons.push("Last checked more than three months ago"); }
  else if (ageDays > 30) { score -= 0.05; reasons.push("Last checked more than a month ago"); }

  // Does the reading hang together? These checks catch a confidently-wrong
  // answer: a usage rate read as a plan, a zero headline on a product that
  // plainly charges, a single nameless tier. Each is worth more than any
  // single positive signal, because a wrong price does far more damage to a
  // review site than a missing one.
  const problems = implausibilities(normalized);
  for (const p of problems) { score -= 0.22; reasons.push(p); }

  // A tier-named headline is what separates a real plan from an add-on row.
  // Without one, nothing reaches the publishing threshold.
  if (normalized.startingPrice !== null && normalized.startingPrice > 0) {
    if (normalized.headlineFromTier) { score += 0.08; reasons.push("Headline price belongs to a named tier"); }
    else { score -= 0.25; reasons.push("Headline price is not attached to a recognisable tier"); }
  }

  score = Math.max(0, Math.min(1, Number(score.toFixed(3))));

  let status;
  if (normalized.pricingModel === "custom" && normalized.startingPrice === null) status = STATUS.CUSTOM;
  // "Verified" has to mean a verified *price*. A page where we established
  // only that a free tier exists is not a verified price, however well the
  // rest of the signals scored — Grammarly came back verified with nothing
  // to show, which is a status that means nothing to a reader.
  else if (normalized.startingPrice === null && normalized.pricingModel !== "free") status = STATUS.UNAVAILABLE;
  else if (score >= PUBLISH_THRESHOLD) status = STATUS.VERIFIED;
  else if (score >= 0.6) status = STATUS.PARTIAL;
  else status = STATUS.UNVERIFIED;

  return { status, score, reasons };
}

/**
 * Whether a reader may be shown this at all.
 *
 * "Custom pricing" has to clear a bar too. A page we half-read — one tier
 * found, the rest missed — can look sales-led when it is nothing of the kind,
 * and publishing "Contact sales" for a product with a public $4 plan is the
 * same failure as publishing the wrong number.
 */
export const CUSTOM_THRESHOLD = 0.75;

export const isPublishable = (status, score) =>
  (status === STATUS.VERIFIED && score >= PUBLISH_THRESHOLD)
  || (status === STATUS.CUSTOM && score >= CUSTOM_THRESHOLD);

/** Plain-language band, for the admin desk. */
export const band = (score) =>
  score >= 0.95 ? "Highly verified" : score >= 0.8 ? "Verified" : score >= 0.6 ? "Partially verified" : "Unverified";
