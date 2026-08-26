/**
 * Pricing endpoints.
 *
 * Public routes serve only what has already been verified and stored — a reader
 * never waits on a vendor's website, and a vendor never sees traffic
 * proportional to Toolhaven's. Admin routes drive the pipeline and are behind
 * the same token gate as the rest of the desk.
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";
import { cached } from "../lib/cache.js";
import { verifyToolPricing } from "../lib/pricing/service.js";
import { runOnce, stats as workerStats } from "../lib/pricing/scheduler.js";
import { isPublishable, band, STATUS } from "../lib/pricing/confidence.js";
import { headline, formatMoney } from "../lib/pricing/normalize.js";
import { isTierName } from "../lib/pricing/tiers.js";

const r = Router();

/**
 * What a reader is allowed to see. Anything not confidently verified collapses
 * to "we could not confirm this" plus a link to the vendor — never a hedged
 * number, because a hedged number is still a number people will quote.
 */
export function publicShape(row) {
  if (!row) return null;
  const publishable = row.isManualOverride || isPublishable(row.verificationStatus, row.confidenceScore);

  const base = {
    status: publishable ? row.verificationStatus : "unavailable",
    pricingUrl: row.pricingUrl || row.sourceUrl || null,
    lastVerifiedAt: row.lastVerifiedAt || null,
    lastAttemptedAt: row.lastAttemptedAt || null,
    sourceLabel: row.sourceType === "official-pricing-page" ? "Official pricing page"
      : row.sourceType === "official-website" ? "Official website" : null,
    isManualOverride: !!row.isManualOverride,
  };
  if (!publishable) return base;

  return {
    ...base,
    currency: row.currency,
    startingPrice: row.startingPrice,
    billingPeriod: row.billingPeriod,
    billingType: row.billingType,
    pricingModel: row.pricingModel,
    freePlan: row.freePlan,
    freeTrial: row.freeTrial,
    headline: headline({
      startingPrice: row.startingPrice, currency: row.currency,
      billingPeriod: row.billingPeriod, pricingModel: row.pricingModel,
      plans: row.plans || [],
    }),
    // Readers see the plan ladder, not the price list. A vendor's pricing page
    // often mixes real tiers with usage rates and add-ons — Vercel lists
    // "Observability $1.20" beside "Pro $20" — and putting those in the same
    // table asks someone choosing a plan to work out which rows are plans.
    // Everything stays in the database and on the admin desk for audit.
    plans: tierPlans(row.plans).map((p) => ({
      name: p.name,
      price: p.price,
      display: p.isCustom ? "Custom" : p.price === 0 ? "Free" : formatMoney(p.price, p.currency),
      currency: p.currency,
      billingPeriod: p.billingPeriod,
      isFree: p.isFree,
      isCustom: p.isCustom,
      isPopular: p.isPopular,
      perUnit: p.perUnit,
    })),
  };
}


/** Tier rows only, unless filtering would leave too little to be useful. */
function tierPlans(plans = []) {
  const tiers = plans.filter((p) => isTierName(p.name));
  return tiers.length >= 2 ? tiers : plans;
}
// GET /api/tools/:id/pricing — by id or slug, whichever the caller has
r.get("/:id/pricing", cached(300), ah(async (req, res, next) => {
  const key = req.params.id;
  const tool = await prisma.tool.findFirst({
    where: /^\d+$/.test(key) ? { id: Number(key) } : { slug: key },
    select: { id: true, name: true, slug: true, websiteUrl: true },
  });
  if (!tool) { const e = new Error("Tool not found"); e.status = 404; return next(e); }

  const row = await prisma.toolPricing.findUnique({
    where: { toolId: tool.id },
    include: { plans: { orderBy: { orderIndex: "asc" } } },
  });
  res.json({
    tool: { id: tool.id, name: tool.name, slug: tool.slug },
    officialUrl: tool.websiteUrl || null,
    pricing: publicShape(row),
  });
}));

// GET /api/tools/:id/pricing/history
r.get("/:id/pricing/history", cached(300), ah(async (req, res, next) => {
  const key = req.params.id;
  const tool = await prisma.tool.findFirst({
    where: /^\d+$/.test(key) ? { id: Number(key) } : { slug: key },
    select: { id: true, name: true, slug: true },
  });
  if (!tool) { const e = new Error("Tool not found"); e.status = 404; return next(e); }

  const rows = await prisma.toolPricingHistory.findMany({
    where: { toolId: tool.id },
    orderBy: { detectedAt: "desc" },
    take: 40,
  });
  res.json({
    tool,
    history: rows.map((h) => ({
      changeType: h.changeType,
      previousPrice: h.previousPrice,
      newPrice: h.newPrice,
      percentChange: h.percentChange,
      currency: h.currency,
      summary: h.summary,
      detectedAt: h.detectedAt,
    })),
  });
}));

export default r;
