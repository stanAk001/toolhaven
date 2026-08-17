import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";
import { presentScore, parseScoreInput, SCORE_DIMENSIONS } from "../lib/score.js";

const router = Router();

/* ── Editor's desk: the commercial fields ─────────────────────────────────
   Registered before "/:slug", which would otherwise read "manage" as a tool
   slug. This deliberately edits the operational surface — the affiliate link,
   pricing, the catch, featured and active — rather than the whole record.
   Features and pros are ordered child tables and belong in their own editor;
   putting them behind the same Save button would make a one-field pricing fix
   risk rewriting a tool's entire content. */

// The only fields this endpoint will write. Anything else in the body is
// ignored rather than trusted — an allowlist, not a spread.
const EDITABLE = {
  affiliateLink: (v) => (v?.trim() ? v.trim() : null),
  affiliateNetwork: (v) => (v?.trim() ? v.trim() : null),
  websiteUrl: (v) => (v?.trim() ? v.trim() : null),
  bestFor: (v) => (v?.trim() ? v.trim() : null),
  caveat: (v) => (v?.trim() ? v.trim() : null),
  priceType: (v) => (v?.trim() ? v.trim() : null),
  priceMin: (v) => (v === "" || v == null ? null : Number(v)),
  priceMax: (v) => (v === "" || v == null ? null : Number(v)),
  rating: (v) => (v === "" || v == null ? null : Number(v)),
  freeTrial: (v) => Boolean(v),
  freeTier: (v) => Boolean(v),
  isFeatured: (v) => Boolean(v),
  isActive: (v) => Boolean(v),
};

// GET /api/tools/manage — every tool, including inactive, with its money fields
router.get("/manage", requireAdmin, ah(async (_req, res) => {
  const items = await prisma.tool.findMany({
    orderBy: [{ isFeatured: "desc" }, { popularity: "desc" }],
    select: {
      id: true, slug: true, name: true, logoMono: true,
      affiliateLink: true, affiliateNetwork: true, websiteUrl: true,
      priceType: true, priceMin: true, priceMax: true,
      freeTrial: true, freeTier: true, rating: true,
      isFeatured: true, isActive: true, bestFor: true, caveat: true,
      category: { select: { id: true, name: true, colorPrimary: true } },
      // the raw row, not presentScore() — the editor form needs the individual
      // dimension values to prefill, not the computed overall
      score: true,
      _count: { select: { clicks: true } },
    },
  });
  res.json({
    items: items.map((t) => ({ ...t, clicks: t._count.clicks, _count: undefined })),
  });
}));

// GET /api/tools/manage/score-dimensions — what the editor form renders
router.get("/manage/score-dimensions", requireAdmin, ah(async (_req, res) => {
  res.json({ dimensions: SCORE_DIMENSIONS });
}));

// PUT /api/tools/manage/:id/score — set or update the editorial assessment.
// Upsert: a tool either has one score row or none, and this is the only way to
// create it, so scores can never be entered anywhere but here.
router.put("/manage/:id/score", requireAdmin, ah(async (req, res, next) => {
  const toolId = Number(req.params.id);
  const { data, error } = parseScoreInput(req.body);
  if (error) { const e = new Error(error); e.status = 400; return next(e); }

  const score = await prisma.toolScore.upsert({
    where: { toolId },
    update: data,
    create: { toolId, ...data },
  });
  res.json(presentScore(score));
}));

// DELETE /api/tools/manage/:id/score — withdraw an assessment entirely, so the
// tool shows no score rather than a stale one.
router.delete("/manage/:id/score", requireAdmin, ah(async (req, res) => {
  await prisma.toolScore.deleteMany({ where: { toolId: Number(req.params.id) } });
  res.json({ ok: true });
}));

// PATCH /api/tools/manage/:id — update only the allowlisted fields
router.patch("/manage/:id", requireAdmin, ah(async (req, res, next) => {
  const id = Number(req.params.id);
  const data = {};

  for (const [key, coerce] of Object.entries(EDITABLE)) {
    if (req.body?.[key] !== undefined) data[key] = coerce(req.body[key]);
  }
  if (Object.keys(data).length === 0) {
    const e = new Error("Nothing to update.");
    e.status = 400;
    return next(e);
  }

  // A price range that reads backwards would render as "$40–$10/mo".
  if (data.priceMin != null && data.priceMax != null && data.priceMin > data.priceMax) {
    const e = new Error("Minimum price can't be higher than the maximum.");
    e.status = 400;
    return next(e);
  }
  if (data.rating != null && (data.rating < 0 || data.rating > 5)) {
    const e = new Error("Rating must be between 0 and 5.");
    e.status = 400;
    return next(e);
  }

  const tool = await prisma.tool.update({ where: { id }, data });
  res.json(tool);
}));

const SORT_MAP = {
  popular: [{ popularity: "desc" }],
  rating: [{ rating: "desc" }],
  az: [{ name: "asc" }],
  "price-lo": [{ priceMin: "asc" }],
  "price-hi": [{ priceMin: "desc" }],
  newest: [{ createdAt: "desc" }],
};

// GET /api/tools?category=ai&search=chart&minRating=4&maxPrice=50&priceType=freemium&sort=popular&page=1&limit=12
router.get("/", ah(async (req, res) => {
  const {
    category, search, minRating, maxPrice, priceType, featured,
    sort = "popular", page = "1", limit = "24",
  } = req.query;

  const where = { isActive: true };
  if (category && category !== "all") where.category = { slug: String(category) };
  if (featured === "true") where.isFeatured = true;
  if (minRating) where.rating = { gte: Number(minRating) };
  if (maxPrice) where.priceMin = { lte: Number(maxPrice) };
  if (priceType) where.priceType = { in: String(priceType).split(",") };
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: "insensitive" } },
      { description: { contains: String(search), mode: "insensitive" } },
    ];
  }

  const take = Math.min(Number(limit) || 24, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.tool.findMany({
      where,
      orderBy: SORT_MAP[sort] || SORT_MAP.popular,
      include: { category: { select: { slug: true, name: true, colorPrimary: true, colorAccent: true } } },
      take, skip,
    }),
    prisma.tool.count({ where }),
  ]);

  res.json({ items, total, page: Number(page), pageSize: take, pages: Math.ceil(total / take) });
}));

// GET /api/tools/compare?slugs=claude,chatgpt,figma
router.get("/compare", ah(async (req, res) => {
  const slugs = String(req.query.slugs || "").split(",").filter(Boolean).slice(0, 3);
  if (!slugs.length) return res.json({ items: [] });
  const items = await prisma.tool.findMany({
    where: { slug: { in: slugs } },
    include: { category: true },
  });
  // preserve requested order
  items.sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));
  res.json({ items });
}));

// GET /api/tools/:slug — full detail page payload
router.get("/:slug", ah(async (req, res) => {
  const tool = await prisma.tool.findUnique({
    where: { slug: req.params.slug },
    include: {
      category: true,
      subcategory: true,
      features: true,
      pros: true,
      reviews: { where: { status: "approved" }, orderBy: [{ isFeatured: "desc" }, { helpful: "desc" }, { createdAt: "desc" }] },
      testimonials: true,
      score: true,
    },
  });
  if (!tool) return res.status(404).json({ error: "Tool not found" });

  const related = await prisma.tool.findMany({
    where: { categoryId: tool.categoryId, id: { not: tool.id }, isActive: true },
    take: 4,
    orderBy: { popularity: "desc" },
    include: { category: { select: { slug: true, name: true, colorPrimary: true } } },
  });

  // `score` is replaced by its presented form: the dimensions plus the computed
  // overall. Null when nothing has been assessed, so the page renders no score
  // at all rather than a zero.
  res.json({ ...tool, score: presentScore(tool.score), related });
}));

export default router;
