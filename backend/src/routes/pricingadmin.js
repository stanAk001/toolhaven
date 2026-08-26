/**
 * The pricing desk.
 *
 * Everything here is behind the editor token. The operating principle is that
 * a person always outranks the crawler: an override is never overwritten, a
 * held-back reading is only published when someone approves it, and every
 * failed attempt keeps its technical detail here rather than leaking to a
 * reader.
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";
import { verifyToolPricing } from "../lib/pricing/service.js";
import { runOnce, stats as workerStats } from "../lib/pricing/scheduler.js";
import { band, isPublishable } from "../lib/pricing/confidence.js";

const r = Router();
r.use(requireAdmin);

const toolOr404 = async (key, next) => {
  const tool = await prisma.tool.findFirst({
    where: /^\d+$/.test(key) ? { id: Number(key) } : { slug: key },
    select: { id: true, name: true, slug: true, websiteUrl: true },
  });
  if (!tool) { const e = new Error("Tool not found"); e.status = 404; next(e); return null; }
  return tool;
};

// GET /api/admin/pricing — the monitoring table
r.get("/", ah(async (req, res) => {
  const tools = await prisma.tool.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, slug: true, websiteUrl: true,
      pricing: { include: { _count: { select: { plans: true } } } },
    },
    orderBy: [{ popularity: "desc" }],
  });

  const latestChanges = await prisma.toolPricingHistory.findMany({
    where: { changeType: { in: ["increase", "decrease", "plan-removed", "free-plan-changed", "currency-changed"] } },
    orderBy: { detectedAt: "desc" },
    take: 60,
  });
  const changeByTool = new Map();
  for (const c of latestChanges) if (!changeByTool.has(c.toolId)) changeByTool.set(c.toolId, c);

  const rows = tools.map((t) => {
    const p = t.pricing;
    const recentChange = changeByTool.get(t.id) || null;
    return {
      id: t.id, name: t.name, slug: t.slug, websiteUrl: t.websiteUrl,
      hasWebsite: !!t.websiteUrl,
      startingPrice: p?.startingPrice ?? null,
      currency: p?.currency || "USD",
      billingPeriod: p?.billingPeriod || null,
      pricingModel: p?.pricingModel || null,
      freePlan: !!p?.freePlan,
      freeTrial: !!p?.freeTrial,
      status: p?.verificationStatus || null,
      confidence: p?.confidenceScore ?? null,
      confidenceBand: p ? band(p.confidenceScore) : null,
      reasons: p?.confidenceReasons || [],
      published: p ? (p.isManualOverride || isPublishable(p.verificationStatus, p.confidenceScore)) : false,
      pendingReview: !!p?.pendingReview,
      isManualOverride: !!p?.isManualOverride,
      overrideNote: p?.overrideNote || null,
      sourceType: p?.sourceType || null,
      sourceUrl: p?.sourceUrl || null,
      extractionMethod: p?.extractionMethod || null,
      lastVerifiedAt: p?.lastVerifiedAt || null,
      lastAttemptedAt: p?.lastAttemptedAt || null,
      nextVerificationAt: p?.nextVerificationAt || null,
      consecutiveFailures: p?.consecutiveFailures || 0,
      planCount: p?._count?.plans || 0,
      recentChange: recentChange && {
        changeType: recentChange.changeType,
        previousPrice: recentChange.previousPrice,
        newPrice: recentChange.newPrice,
        percentChange: recentChange.percentChange,
        summary: recentChange.summary,
        detectedAt: recentChange.detectedAt,
      },
    };
  });

  res.json({
    items: rows,
    summary: {
      total: rows.length,
      published: rows.filter((x) => x.published).length,
      pendingReview: rows.filter((x) => x.pendingReview).length,
      overrides: rows.filter((x) => x.isManualOverride).length,
      failing: rows.filter((x) => x.consecutiveFailures >= 3).length,
      neverChecked: rows.filter((x) => !x.lastAttemptedAt).length,
      changesToReview: rows.filter((x) => x.recentChange).length,
    },
    worker: workerStats,
  });
}));

// POST /api/admin/pricing/:id/verify — check this one now, and wait for it
r.post("/:id/verify", ah(async (req, res, next) => {
  const tool = await toolOr404(req.params.id, next);
  if (!tool) return;
  const result = await verifyToolPricing(tool, { force: req.body?.force === true });
  const row = await prisma.toolPricing.findUnique({
    where: { toolId: tool.id }, include: { plans: { orderBy: { orderIndex: "asc" } } },
  });
  res.json({ result, pricing: row });
}));

// POST /api/admin/pricing/run — work through whatever is due right now
r.post("/run", ah(async (req, res) => {
  const limit = Math.min(Number(req.body?.limit) || 5, 20);
  res.json(await runOnce({ limit, log: false }));
}));

// GET /api/admin/pricing/:id/logs — every attempt, successful or not
r.get("/:id/logs", ah(async (req, res, next) => {
  const tool = await toolOr404(req.params.id, next);
  if (!tool) return;
  const logs = await prisma.pricingVerificationLog.findMany({
    where: { toolId: tool.id }, orderBy: { createdAt: "desc" }, take: 25,
  });
  const history = await prisma.toolPricingHistory.findMany({
    where: { toolId: tool.id }, orderBy: { detectedAt: "desc" }, take: 25,
  });
  const pricing = await prisma.toolPricing.findUnique({
    where: { toolId: tool.id }, include: { plans: { orderBy: { orderIndex: "asc" } } },
  });
  res.json({ tool, logs, history, plans: pricing?.plans || [] });
}));

// POST /api/admin/pricing/:id/approve — publish a reading held back for review
r.post("/:id/approve", ah(async (req, res, next) => {
  const tool = await toolOr404(req.params.id, next);
  if (!tool) return;
  const existing = await prisma.toolPricing.findUnique({ where: { toolId: tool.id } });
  if (!existing) { const e = new Error("Nothing has been extracted for this tool yet."); e.status = 400; return next(e); }
  if (existing.startingPrice === null && existing.pricingModel !== "custom") {
    const e = new Error("There is no price here to approve."); e.status = 400; return next(e);
  }
  // Approving is a person vouching for it, so it becomes an override — the
  // crawler may not quietly undo a decision someone made on purpose.
  const row = await prisma.toolPricing.update({
    where: { toolId: tool.id },
    data: {
      verificationStatus: existing.pricingModel === "custom" ? "custom_pricing" : "verified",
      confidenceScore: Math.max(existing.confidenceScore, 0.8),
      pendingReview: false,
      isManualOverride: true,
      overrideNote: (req.body?.note || "Approved from the pricing desk.").slice(0, 300),
      overriddenBy: (req.body?.by || "editor").slice(0, 60),
      lastVerifiedAt: new Date(),
    },
  });
  res.json({ pricing: row });
}));

// POST /api/admin/pricing/:id/reject — this reading is wrong; do not show it
r.post("/:id/reject", ah(async (req, res, next) => {
  const tool = await toolOr404(req.params.id, next);
  if (!tool) return;
  const row = await prisma.toolPricing.update({
    where: { toolId: tool.id },
    data: {
      verificationStatus: "unavailable",
      confidenceScore: 0,
      pendingReview: false,
      startingPrice: null,
      lastVerifiedAt: null,
      overrideNote: (req.body?.note || "Rejected as incorrect.").slice(0, 300),
      overriddenBy: (req.body?.by || "editor").slice(0, 60),
      isManualOverride: true,
    },
  });
  res.json({ pricing: row });
}));

const PERIODS = ["month", "year", "one-time", "usage"];
const MODELS = ["free", "freemium", "subscription", "usage", "per-seat", "custom", "one-time"];

// PUT /api/admin/pricing/:id/override — type the correct figures in by hand
r.put("/:id/override", ah(async (req, res, next) => {
  const tool = await toolOr404(req.params.id, next);
  if (!tool) return;
  const b = req.body || {};

  const price = b.startingPrice === "" || b.startingPrice === null || b.startingPrice === undefined
    ? null : Number(b.startingPrice);
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 1_000_000)) {
    const e = new Error("That starting price is not a number we can use."); e.status = 400; return next(e);
  }
  if (b.billingPeriod && !PERIODS.includes(b.billingPeriod)) {
    const e = new Error("Billing period must be one of: " + PERIODS.join(", ")); e.status = 400; return next(e);
  }
  if (b.pricingModel && !MODELS.includes(b.pricingModel)) {
    const e = new Error("Pricing model must be one of: " + MODELS.join(", ")); e.status = 400; return next(e);
  }
  const currency = String(b.currency || "USD").toUpperCase().slice(0, 3);
  if (!/^[A-Z]{3}$/.test(currency)) {
    const e = new Error("Currency must be a three-letter code, like USD or NGN."); e.status = 400; return next(e);
  }
  // A price a reader can go and check is the whole point; an override without a
  // source is just a number typed into a box.
  const url = b.pricingUrl ? String(b.pricingUrl).trim() : null;
  if (url && !/^https?:\/\//i.test(url)) {
    const e = new Error("The pricing link needs to start with http:// or https://"); e.status = 400; return next(e);
  }

  const plans = Array.isArray(b.plans) ? b.plans.filter((p) => p && String(p.name || "").trim()) : null;

  const data = {
    currency,
    startingPrice: price,
    billingPeriod: b.billingPeriod || null,
    billingType: b.billingType || null,
    pricingModel: b.pricingModel || null,
    freePlan: !!b.freePlan,
    freeTrial: !!b.freeTrial,
    pricingUrl: url,
    sourceUrl: url,
    sourceType: "official-pricing-page",
    extractionMethod: "manual",
    verificationStatus: price === null && b.pricingModel !== "custom" ? "unavailable"
      : b.pricingModel === "custom" ? "custom_pricing" : "verified",
    confidenceScore: 1,
    confidenceReasons: ["Entered by an editor from the vendor's own pricing page"],
    isManualOverride: true,
    pendingReview: false,
    overrideNote: (b.note || "").slice(0, 300) || null,
    overriddenBy: (b.by || "editor").slice(0, 60),
    lastVerifiedAt: new Date(),
    lastAttemptedAt: new Date(),
    consecutiveFailures: 0,
  };

  const saved = await prisma.$transaction(async (tx) => {
    const row = await tx.toolPricing.upsert({
      where: { toolId: tool.id }, update: data, create: { toolId: tool.id, ...data },
    });
    if (plans) {
      await tx.toolPricingPlan.deleteMany({ where: { pricingId: row.id } });
      if (plans.length) {
        await tx.toolPricingPlan.createMany({
          data: plans.slice(0, 12).map((p, i) => ({
            pricingId: row.id,
            name: String(p.name).trim().slice(0, 60),
            price: p.isCustom ? null : (p.price === "" || p.price === null || p.price === undefined ? null : Number(p.price)),
            currency,
            billingPeriod: PERIODS.includes(p.billingPeriod) ? p.billingPeriod : (b.billingPeriod || "month"),
            isFree: !!p.isFree || Number(p.price) === 0,
            isCustom: !!p.isCustom,
            isPopular: !!p.isPopular,
            perUnit: p.perUnit ? String(p.perUnit).slice(0, 40) : null,
            rawText: "Entered by an editor",
            orderIndex: i,
          })),
        });
      }
    }
    return tx.toolPricing.findUnique({ where: { id: row.id }, include: { plans: { orderBy: { orderIndex: "asc" } } } });
  });
  res.json({ pricing: saved });
}));

// DELETE /api/admin/pricing/:id/override — hand this tool back to the crawler
r.delete("/:id/override", ah(async (req, res, next) => {
  const tool = await toolOr404(req.params.id, next);
  if (!tool) return;
  const row = await prisma.toolPricing.update({
    where: { toolId: tool.id },
    data: { isManualOverride: false, overrideNote: null, overriddenBy: null, nextVerificationAt: new Date() },
  });
  res.json({ pricing: row });
}));

export default r;
