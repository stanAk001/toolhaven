/**
 * The promotions desk.
 *
 * Everything an editor needs to run the commercial side without touching the
 * editorial one. Nothing in this file can change a tool's score, rating,
 * review or organic position — approving a campaign decides where an advert
 * appears and for how long, and that is the whole of its power.
 *
 * Every state change writes an audit row and, where a vendor is affected,
 * sends them the reason in their own words.
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";
import { STATUS, canMove, refusal, LIVE_STATUSES, OPEN_STATUSES } from "../lib/promotion/lifecycle.js";
import { analyticsFor, analyticsForMany, audit, plain, LIMITS, windowFor, manualDelivery } from "../lib/promotion/campaigns.js";
import { availability, PLACEMENT_KEYS } from "../lib/promotion/inventory.js";
import { formatMinor } from "../lib/promotion/money.js";
import { PAYMENT_STATUS } from "../lib/promotion/payments.js";
import {
  sendApproved, sendRejected, sendChangesRequested, sendRefunded,
} from "../lib/promotion/campaignmail.js";

const router = Router();
router.use(requireAdmin);

const detail = {
  id: true, slug: true, status: true, ownerEmail: true,
  headline: true, message: true, ctaText: true, targetAudience: true,
  destinationUrl: true, placements: true, imageId: true,
  startDate: true, endDate: true, reviewNote: true, createdAt: true, updatedAt: true,
  tool: { select: { id: true, slug: true, name: true, logoUrl: true, logoMono: true, websiteUrl: true, category: { select: { slug: true, name: true } } } },
  plan: { select: { slug: true, name: true, durationDays: true, quoteOnly: true } },
  payments: {
    select: { id: true, provider: true, reference: true, status: true, amountMinor: true, currency: true, paidAt: true, providerStatus: true },
    orderBy: { createdAt: "desc" },
  },
};

const shape = (c, stats) => ({
  ...c,
  image: c.imageId ? `/api/uploads/${c.imageId}` : null,
  payments: (c.payments || []).map((p) => ({ ...p, display: formatMinor(p.amountMinor, p.currency) })),
  stats,
});

/**
 * GET /api/admin/promotions/overview
 *
 * Revenue is summed from payments actually marked PAID — that is, ones this
 * server verified with the provider. A pending charge is not money.
 */
router.get("/overview", ah(async (_req, res) => {
  const now = new Date();
  const [counts, paid, events, placements] = await Promise.all([
    prisma.promotionCampaign.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.promotionPayment.groupBy({
      by: ["currency"],
      where: { status: PAYMENT_STATUS.PAID },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
    prisma.promotionEvent.groupBy({ by: ["type"], _count: { _all: true } }),
    availability(),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const totals = Object.fromEntries(events.map((e) => [e.type, e._count._all]));

  res.json({
    counts: {
      ...byStatus,
      live: await prisma.promotionCampaign.count({
        where: { status: STATUS.ACTIVE, startDate: { lte: now }, endDate: { gt: now } },
      }),
      needsReview: byStatus[STATUS.PENDING_REVIEW] || 0,
      open: OPEN_STATUSES.reduce((n, s) => n + (byStatus[s] || 0), 0),
    },
    revenue: paid.map((r) => ({
      currency: r.currency,
      minor: r._sum.amountMinor || 0,
      display: formatMinor(r._sum.amountMinor || 0, r.currency),
      payments: r._count._all,
    })),
    events: {
      impressions: totals.impression || 0,
      toolPageViews: totals.tool_view || 0,
      ctaClicks: totals.cta_click || 0,
      websiteClicks: totals.outbound_click || 0,
    },
    placements,
  });
}));

/** GET /api/admin/promotions/campaigns?status=&q= */
router.get("/campaigns", ah(async (req, res) => {
  const status = String(req.query.status || "").toUpperCase();
  const q = String(req.query.q || "").trim();

  const rows = await prisma.promotionCampaign.findMany({
    where: {
      ...(status === "LIVE" ? { status: { in: LIVE_STATUSES } } : status ? { status } : {}),
      ...(q
        ? {
          OR: [
            { ownerEmail: { contains: q, mode: "insensitive" } },
            { headline: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { tool: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
        : {}),
    },
    select: detail,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  const stats = await analyticsForMany(rows.map((r) => r.id));
  res.json({ items: rows.map((c) => shape(c, stats.get(c.id))) });
}));

/** GET /api/admin/promotions/campaigns/:slug — everything, for the review screen. */
router.get("/campaigns/:slug", ah(async (req, res, next) => {
  const c = await prisma.promotionCampaign.findUnique({ where: { slug: String(req.params.slug) }, select: detail });
  if (!c) { const e = new Error("Campaign not found"); e.status = 404; return next(e); }
  const [stats, trail, manual] = await Promise.all([
    analyticsFor(c.id),
    prisma.promotionAudit.findMany({ where: { campaignId: c.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    manualDelivery([c]),
  ]);
  res.json({ campaign: { ...shape(c, stats), manual: manual.get(c.id) || [] }, audit: trail });
}));

/** Move a campaign, refusing anything the lifecycle doesn't allow. */
async function move(slug, to, { note = null, actor = "admin", data = {} } = {}) {
  const c = await prisma.promotionCampaign.findUnique({
    where: { slug },
    include: { tool: { select: { name: true } }, plan: { select: { name: true } } },
  });
  if (!c) { const e = new Error("Campaign not found"); e.status = 404; throw e; }
  if (!canMove(c.status, to)) { const e = new Error(refusal(c.status, to)); e.status = 409; throw e; }

  const updated = await prisma.promotionCampaign.update({
    where: { id: c.id },
    data: { status: to, ...(note !== undefined ? { reviewNote: note } : {}), ...data },
    include: { tool: { select: { name: true } }, plan: { select: { name: true } } },
  });
  await audit(`campaign.${to.toLowerCase()}`, { campaignId: c.id, actor, detail: note });
  return { before: c, after: updated };
}

/**
 * POST .../approve
 *
 * Approving schedules it. A campaign whose start has already arrived goes live
 * on the next scheduler tick rather than here, so there is exactly one place
 * that decides a campaign is running.
 */
router.post("/campaigns/:slug/approve", ah(async (req, res, next) => {
  try {
    const { after } = await move(String(req.params.slug), STATUS.APPROVED, { note: null });
    const scheduled = await prisma.promotionCampaign.update({
      where: { id: after.id },
      data: canMove(STATUS.APPROVED, STATUS.SCHEDULED) ? { status: STATUS.SCHEDULED } : {},
      include: { tool: { select: { name: true } }, plan: { select: { name: true } } },
    });
    await audit("campaign.scheduled", { campaignId: after.id, actor: "admin" });
    await sendApproved({ ...scheduled, ownerEmail: after.ownerEmail, submissionId: after.submissionId, slug: after.slug });
    res.json({ campaign: scheduled });
  } catch (err) { next(err); }
}));

/** POST .../request-changes { reason } — back to the vendor, editable again. */
router.post("/campaigns/:slug/request-changes", ah(async (req, res, next) => {
  const reason = plain(req.body?.reason, 400);
  if (!reason) { const e = new Error("Say what needs changing — it goes to the vendor verbatim."); e.status = 400; return next(e); }
  try {
    const { after } = await move(String(req.params.slug), STATUS.DRAFT, { note: reason });
    await sendChangesRequested({ ...after, reviewNote: reason });
    res.json({ campaign: after });
  } catch (err) { next(err); }
}));

/** POST .../reject { reason } */
router.post("/campaigns/:slug/reject", ah(async (req, res, next) => {
  const reason = plain(req.body?.reason, 400);
  if (!reason) { const e = new Error("A rejection needs a reason — the vendor is told exactly this."); e.status = 400; return next(e); }
  try {
    const { after } = await move(String(req.params.slug), STATUS.REJECTED, {
      note: reason, data: { rejectedAt: new Date() },
    });
    await sendRejected({ ...after, reviewNote: reason });
    res.json({ campaign: after });
  } catch (err) { next(err); }
}));

router.post("/campaigns/:slug/pause", ah(async (req, res, next) => {
  try { res.json({ campaign: (await move(String(req.params.slug), STATUS.PAUSED)).after }); }
  catch (err) { next(err); }
}));

router.post("/campaigns/:slug/resume", ah(async (req, res, next) => {
  try { res.json({ campaign: (await move(String(req.params.slug), STATUS.ACTIVE)).after }); }
  catch (err) { next(err); }
}));

router.post("/campaigns/:slug/cancel", ah(async (req, res, next) => {
  try { res.json({ campaign: (await move(String(req.params.slug), STATUS.CANCELLED)).after }); }
  catch (err) { next(err); }
}));

/**
 * Refunds, in two steps on purpose.
 *
 * REFUND_PENDING is us having asked. REFUNDED is the provider having confirmed.
 * Telling a vendor their money is back before it is would be a lie with their
 * bank statement as the evidence.
 */
router.post("/campaigns/:slug/refund-requested", ah(async (req, res, next) => {
  try { res.json({ campaign: (await move(String(req.params.slug), STATUS.REFUND_PENDING)).after }); }
  catch (err) { next(err); }
}));

router.post("/campaigns/:slug/refund-confirmed", ah(async (req, res, next) => {
  try {
    const { after } = await move(String(req.params.slug), STATUS.REFUNDED);
    const payment = await prisma.promotionPayment.findFirst({
      where: { campaignId: after.id, status: PAYMENT_STATUS.PAID },
      orderBy: { createdAt: "desc" },
    });
    if (payment) {
      await prisma.promotionPayment.update({ where: { id: payment.id }, data: { status: PAYMENT_STATUS.REFUNDED } });
      await sendRefunded(after, payment);
    }
    res.json({ campaign: after });
  } catch (err) { next(err); }
}));

/** PATCH .../dates { startDate, endDate } — with the plan's length respected. */
router.patch("/campaigns/:slug/dates", ah(async (req, res, next) => {
  const c = await prisma.promotionCampaign.findUnique({
    where: { slug: String(req.params.slug) }, include: { plan: true },
  });
  if (!c) { const e = new Error("Campaign not found"); e.status = 404; return next(e); }

  const start = req.body?.startDate ? new Date(req.body.startDate) : c.startDate;
  if (!start || Number.isNaN(start.getTime())) { const e = new Error("That start date isn't valid."); e.status = 400; return next(e); }

  // An editor may set an explicit end, but the default is the plan's length —
  // a campaign silently running longer than it was sold is a gift nobody
  // decided to give.
  let end = req.body?.endDate ? new Date(req.body.endDate) : new Date(start.getTime() + c.plan.durationDays * 86400000);
  if (Number.isNaN(end.getTime()) || end <= start) { const e = new Error("The end date has to be after the start."); e.status = 400; return next(e); }

  const updated = await prisma.promotionCampaign.update({
    where: { id: c.id }, data: { startDate: start, endDate: end }, select: detail,
  });
  await audit("campaign.dates", {
    campaignId: c.id, actor: "admin",
    detail: `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`,
  });
  res.json({ campaign: shape(updated, null) });
}));

/** POST .../fulfilled { placement } — for the slots an editor does by hand. */
router.post("/campaigns/:slug/fulfilled", ah(async (req, res, next) => {
  const c = await prisma.promotionCampaign.findUnique({ where: { slug: String(req.params.slug) }, select: { id: true } });
  if (!c) { const e = new Error("Campaign not found"); e.status = 404; return next(e); }
  const placement = String(req.body?.placement || "");
  if (!PLACEMENT_KEYS.includes(placement)) { const e = new Error("Unknown placement."); e.status = 400; return next(e); }
  await audit("campaign.fulfilled", { campaignId: c.id, actor: "admin", detail: placement });
  res.json({ ok: true });
}));

/* ────────────────────────────── packages ───────────────────────────── */

router.get("/plans", ah(async (_req, res) => {
  const plans = await prisma.promotionPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  res.json({
    items: plans.map((p) => ({
      ...p,
      usd: formatMinor(p.priceUsdCents, "USD"),
      ngn: formatMinor(p.priceNgnKobo, "NGN"),
    })),
    placementKeys: PLACEMENT_KEYS,
  });
}));

const planBody = (b) => {
  const out = {};
  if (b.name !== undefined) out.name = plain(b.name, 80);
  if (b.description !== undefined) out.description = plain(b.description, 300);
  if (b.durationDays !== undefined) out.durationDays = Math.max(1, Math.min(365, Number(b.durationDays) || 1));
  if (b.active !== undefined) out.active = Boolean(b.active);
  if (b.quoteOnly !== undefined) out.quoteOnly = Boolean(b.quoteOnly);
  if (b.sortOrder !== undefined) out.sortOrder = Number(b.sortOrder) || 0;
  // Prices arrive in major units from the form and are stored in minor units.
  // A blank field means "not sold in this currency", which is null and not zero.
  if (b.priceUsd !== undefined) {
    const n = Number(b.priceUsd);
    out.priceUsdCents = b.priceUsd === "" || b.priceUsd === null || !Number.isFinite(n) ? null : Math.round(n * 100);
  }
  if (b.priceNgn !== undefined) {
    const n = Number(b.priceNgn);
    out.priceNgnKobo = b.priceNgn === "" || b.priceNgn === null || !Number.isFinite(n) ? null : Math.round(n * 100);
  }
  if (Array.isArray(b.placements)) out.placements = b.placements.filter((k) => PLACEMENT_KEYS.includes(k));
  if (Array.isArray(b.features)) out.features = b.features.map((f) => plain(f, 120)).filter(Boolean).slice(0, 12);
  return out;
};

router.post("/plans", ah(async (req, res, next) => {
  const slug = String(req.body?.slug || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) { const e = new Error("Give the package a slug."); e.status = 400; return next(e); }
  if (await prisma.promotionPlan.count({ where: { slug } })) { const e = new Error(`"${slug}" is already taken.`); e.status = 400; return next(e); }
  const plan = await prisma.promotionPlan.create({
    data: { slug, name: plain(req.body?.name, 80) || slug, durationDays: 30, placements: [], features: [], ...planBody(req.body || {}) },
  });
  await audit("plan.created", { planId: plan.id, actor: "admin", detail: slug });
  res.status(201).json({ plan });
}));

router.patch("/plans/:slug", ah(async (req, res, next) => {
  const existing = await prisma.promotionPlan.findUnique({ where: { slug: String(req.params.slug) } });
  if (!existing) { const e = new Error("Package not found"); e.status = 404; return next(e); }

  const data = planBody(req.body || {});
  const plan = await prisma.promotionPlan.update({ where: { id: existing.id }, data });

  // Price changes are the ones worth being able to point at later.
  const changed = [];
  if (data.priceUsdCents !== undefined && data.priceUsdCents !== existing.priceUsdCents) {
    changed.push(`USD ${formatMinor(existing.priceUsdCents, "USD") || "—"} → ${formatMinor(plan.priceUsdCents, "USD") || "—"}`);
  }
  if (data.priceNgnKobo !== undefined && data.priceNgnKobo !== existing.priceNgnKobo) {
    changed.push(`NGN ${formatMinor(existing.priceNgnKobo, "NGN") || "—"} → ${formatMinor(plan.priceNgnKobo, "NGN") || "—"}`);
  }
  if (data.active !== undefined && data.active !== existing.active) changed.push(plan.active ? "activated" : "deactivated");

  await audit(changed.length ? "plan.price" : "plan.updated", {
    planId: plan.id, actor: "admin", detail: changed.join("; ") || Object.keys(data).join(", "),
  });
  res.json({ plan });
}));

/* ───────────────────────────── placements ──────────────────────────── */

router.get("/placements", ah(async (_req, res) => {
  const [rows, avail] = await Promise.all([
    prisma.promotionPlacement.findMany({ orderBy: { sortOrder: "asc" } }),
    availability(),
  ]);
  const byKey = new Map(avail.map((a) => [a.key, a]));
  res.json({ items: rows.map((r) => ({ ...r, ...(byKey.get(r.key) || {}) })) });
}));

router.patch("/placements/:key", ah(async (req, res, next) => {
  const key = String(req.params.key);
  if (!PLACEMENT_KEYS.includes(key)) { const e = new Error("Unknown placement."); e.status = 400; return next(e); }
  const b = req.body || {};
  const data = {};
  if (b.label !== undefined) data.label = plain(b.label, 60);
  if (b.description !== undefined) data.description = plain(b.description, 300);
  if (b.maxActive !== undefined) data.maxActive = Math.max(0, Math.min(50, Number(b.maxActive) || 0));
  if (b.active !== undefined) data.active = Boolean(b.active);
  if (b.manual !== undefined) data.manual = Boolean(b.manual);

  const placement = await prisma.promotionPlacement.update({ where: { key }, data });
  await audit("placement.updated", { actor: "admin", detail: `${key}: ${Object.keys(data).join(", ")}` });
  res.json({ placement });
}));

/* ─────────────────────────────── audit ─────────────────────────────── */

router.get("/audit", ah(async (req, res) => {
  const items = await prisma.promotionAudit.findMany({
    where: req.query.action ? { action: String(req.query.action) } : {},
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(req.query.limit) || 100, 300),
  });
  res.json({ items });
}));

export default router;
