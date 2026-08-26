/**
 * The pipeline, wired to the database.
 *
 *   discover -> fetch -> extract -> normalise -> score -> diff -> store
 *
 * Every stage lives in its own module; this one only decides what to do with
 * their answers. Three rules govern the writing:
 *
 *   1. An editor's manual override is never overwritten by a crawl. The crawl
 *      still runs and still records what it found, so the desk can see that the
 *      override and reality have diverged — it just does not publish over it.
 *   2. Nothing is deleted. A price that changes becomes a history row first.
 *   3. A figure below the publishing threshold is stored but flagged for review
 *      rather than shown. Storing it is how an editor can approve it; showing it
 *      would be Toolhaven vouching for something it is not sure of.
 */
import { prisma } from "../prisma.js";
import { findPricingSource } from "./discover.js";
import { extractPricing } from "./extract.js";
import { normalize } from "./normalize.js";
import { scorePricing, isPublishable, STATUS, PUBLISH_THRESHOLD } from "./confidence.js";
import { diffPricing, isSignificant } from "./changes.js";

// How long until a tool is looked at again. Popular tools move more and matter
// more; a tool nobody opens can wait three weeks.
const CADENCE_DAYS = { high: 2, normal: 7, low: 21 };
const RETRY_DAYS = { firstFailure: 1, backoff: 3, givenUp: 30 };

const daysFromNow = (d) => new Date(Date.now() + d * 86400000);

export function cadenceFor(clicks30d) {
  if (clicks30d >= 25) return CADENCE_DAYS.high;
  if (clicks30d >= 3) return CADENCE_DAYS.normal;
  return CADENCE_DAYS.low;
}

const snapshotOf = (row) => ({
  startingPrice: row.startingPrice, currency: row.currency, billingPeriod: row.billingPeriod,
  pricingModel: row.pricingModel, freePlan: row.freePlan, freeTrial: row.freeTrial,
  plans: (row.plans || []).map((p) => ({ name: p.name, price: p.price })),
});

async function log(toolId, row) {
  // A log that fails must never fail the run it is describing.
  try { await prisma.pricingVerificationLog.create({ data: { toolId, ...row } }); } catch { /* noop */ }
}

async function recordHistory(toolId, previous, change, sourceUrl, fallback) {
  const from = previous ? snapshotOf(previous) : fallback || {};
  await prisma.toolPricingHistory.create({
    data: {
      toolId,
      currency: from.currency || "USD",
      startingPrice: from.startingPrice ?? null,
      billingPeriod: from.billingPeriod ?? null,
      pricingModel: from.pricingModel ?? null,
      freePlan: !!from.freePlan,
      freeTrial: !!from.freeTrial,
      planSnapshot: from.plans ? from.plans : undefined,
      changeType: change.changeType,
      previousPrice: change.previousPrice ?? null,
      newPrice: change.newPrice ?? null,
      percentChange: change.percentChange ?? null,
      summary: change.summary || null,
      sourceUrl: sourceUrl || null,
    },
  });
}

async function touchAttempt(toolId, existing, retryInDays, failures) {
  const data = {
    lastAttemptedAt: new Date(),
    nextVerificationAt: daysFromNow(retryInDays),
    consecutiveFailures: failures ?? (existing?.consecutiveFailures || 0) + 1,
  };
  if (existing) await prisma.toolPricing.update({ where: { toolId }, data });
  else await prisma.toolPricing.create({ data: { toolId, verificationStatus: STATUS.UNAVAILABLE, ...data } });
}

async function clickCount(toolId) {
  const since = new Date(Date.now() - 30 * 86400000);
  try { return await prisma.affiliateClick.count({ where: { toolId, createdAt: { gte: since } } }); }
  catch { return 0; }
}

/**
 * Verify one tool's pricing, end to end.
 *
 * @param {object} tool  { id, name, slug, websiteUrl }
 * @param {object} opts  { force } — lets an editor's explicit "check it now"
 *                       write over an override they themselves set
 * @returns {{outcome, status?, score?, changed?, detail?}}
 */
export async function verifyToolPricing(tool, opts = {}) {
  const started = Date.now();
  const existing = await prisma.toolPricing.findUnique({
    where: { toolId: tool.id },
    include: { plans: { orderBy: { orderIndex: "asc" } } },
  });

  // The vendor's own site, never the affiliate redirect: a tracking URL is not
  // the vendor's domain and would fail the same-site check, correctly.
  const official = tool.websiteUrl || null;
  if (!official) {
    await log(tool.id, { outcome: "error", detail: "no website URL on record", durationMs: Date.now() - started });
    await touchAttempt(tool.id, existing, RETRY_DAYS.givenUp);
    return { outcome: "error", detail: "no website URL on record" };
  }

  const found = await findPricingSource(official);
  if (found.failed) {
    await log(tool.id, {
      outcome: found.outcome, sourceUrl: official, durationMs: Date.now() - started,
      detail: found.detail + " (" + found.attempts.length + " address(es) tried)",
    });
    const fails = (existing?.consecutiveFailures || 0) + 1;
    const retry = fails >= 3 ? RETRY_DAYS.givenUp : fails === 1 ? RETRY_DAYS.firstFailure : RETRY_DAYS.backoff;
    await touchAttempt(tool.id, existing, retry, fails);
    return { outcome: found.outcome, detail: found.detail };
  }

  const extraction = extractPricing(found.html);
  const normalized = normalize(extraction, {
    pricingUrl: found.url, sourceUrl: found.url, sourceType: found.sourceType,
  });
  const scored = scorePricing(normalized, {
    officialUrl: official, sourceUrl: found.url, sourceType: found.sourceType, fetchedAt: new Date(),
  });

  const foundSomething = normalized.plans.length > 0
    || normalized.startingPrice !== null
    || scored.status === STATUS.CUSTOM;

  await log(tool.id, {
    outcome: foundSomething ? "success" : "no-pricing-found",
    sourceUrl: found.url, method: normalized.extractionMethod, confidence: scored.score,
    plansFound: normalized.plans.length, durationMs: Date.now() - started,
    detail: scored.reasons.join(" | ").slice(0, 500),
  });

  const change = diffPricing(existing ? snapshotOf(existing) : null, normalized);
  const next = daysFromNow(cadenceFor(await clickCount(tool.id)));

  // The override guard. The crawl is still recorded; it just does not take the
  // wheel from a person who has already decided what belongs here.
  if (existing?.isManualOverride && !opts.force) {
    await prisma.toolPricing.update({
      where: { toolId: tool.id },
      data: { lastAttemptedAt: new Date(), nextVerificationAt: next, consecutiveFailures: 0 },
    });
    if (change && isSignificant(change)) await recordHistory(tool.id, existing, change, found.url);
    return {
      outcome: "success", status: existing.verificationStatus, score: existing.confidenceScore,
      skipped: "manual override in place", changed: change?.changeType || null,
    };
  }

  if (change) await recordHistory(tool.id, existing, change, found.url, normalized);

  // Confident enough to publish, or held back for a person to look at. Storing
  // an uncertain reading is how the desk gets to approve it; showing it would
  // be Toolhaven vouching for something it is not sure of.
  const publishable = isPublishable(scored.status, scored.score);
  const needsReview = !publishable && foundSomething;

  const data = {
    currency: normalized.currency || "USD",
    startingPrice: normalized.startingPrice,
    billingPeriod: normalized.billingPeriod,
    billingType: normalized.billingType,
    pricingModel: normalized.pricingModel,
    freePlan: normalized.freePlan,
    freeTrial: normalized.freeTrial,
    verificationStatus: scored.status,
    confidenceScore: scored.score,
    confidenceReasons: scored.reasons,
    pricingUrl: normalized.pricingUrl,
    sourceUrl: normalized.sourceUrl,
    sourceType: normalized.sourceType,
    extractionMethod: normalized.extractionMethod,
    // Only a publishable reading updates "last verified" — the date a reader
    // sees has to mean "we confirmed this", not "we looked".
    lastVerifiedAt: publishable ? new Date() : existing?.lastVerifiedAt ?? null,
    lastAttemptedAt: new Date(),
    nextVerificationAt: next,
    consecutiveFailures: 0,
    pendingReview: needsReview,
  };

  const saved = await prisma.$transaction(async (tx) => {
    const row = await tx.toolPricing.upsert({
      where: { toolId: tool.id }, update: data, create: { toolId: tool.id, ...data },
    });
    // Plans are replaced wholesale: the page is the source of truth for which
    // tiers exist, and a tier that has gone must go here too. The version that
    // was here is already in the history table.
    await tx.toolPricingPlan.deleteMany({ where: { pricingId: row.id } });
    if (normalized.plans.length) {
      await tx.toolPricingPlan.createMany({
        data: normalized.plans.map((p) => ({
          pricingId: row.id, name: p.name, price: p.price, currency: p.currency,
          billingPeriod: p.billingPeriod, billingType: p.billingType, isFree: p.isFree,
          isCustom: p.isCustom, isPopular: p.isPopular, perUnit: p.perUnit,
          note: p.note, rawText: p.rawText, orderIndex: p.orderIndex,
        })),
      });
    }
    return row;
  });

  return {
    outcome: "success",
    status: saved.verificationStatus,
    score: saved.confidenceScore,
    plans: normalized.plans.length,
    published: publishable,
    pendingReview: needsReview,
    changed: change?.changeType || null,
    significant: isSignificant(change),
  };
}

export { PUBLISH_THRESHOLD };
