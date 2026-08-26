import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";
import { presentScore, parseScoreInput, SCORE_DIMENSIONS } from "../lib/score.js";
import { presentExternal, trustScore, headlineRating } from "../lib/evidence.js";
import { publicShape } from "./pricing.js";
import { cached } from "../lib/cache.js";

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

/* GET /api/tools/rails — the homepage rails.
 *
 * Every rail is computed from something that actually happened, and any rail
 * without enough behind it is returned empty so the homepage can omit it
 * rather than pad it out:
 *
 *   trending      outbound clicks in the last 30 days — real engagement, not a
 *                 hand-set flag
 *   editorsPicks  tools carrying a Toolhaven Score, i.e. ones we actually sat
 *                 down and assessed
 *   mostReviewed  reader review volume
 *   recentlyAdded newest profiles
 *
 * Affiliate status is not an input to any of them. A partner appears here only
 * by earning it on the same measure as everything else.
 */
router.get("/rails", cached(120), ah(async (_req, res) => {
  const CARD = {
    id: true, slug: true, name: true, description: true, logoMono: true,
    logoUrl: true, logoAlt: true, rating: true, reviewCount: true,
    priceType: true, priceMin: true, priceMax: true, freeTier: true,
    createdAt: true,
    category: { select: { slug: true, name: true, colorPrimary: true } },
    score: true,
    externalRatings: { orderBy: { reviewCount: "desc" }, take: 1 },
  };
  const since = new Date(Date.now() - 30 * 86400000);

  const [clickRows, editors, mostReviewed, recentlyAdded] = await Promise.all([
    prisma.affiliateClick.groupBy({
      by: ["toolId"], _count: { _all: true },
      where: { createdAt: { gte: since } },
      orderBy: { _count: { toolId: "desc" } },
      take: 8,
    }),
    prisma.tool.findMany({
      where: { isActive: true, score: { isNot: null } },
      select: CARD, take: 8,
    }),
    prisma.tool.findMany({
      where: { isActive: true, reviewCount: { gt: 0 } },
      orderBy: [{ reviewCount: "desc" }, { rating: "desc" }],
      select: CARD, take: 8,
    }),
    prisma.tool.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: CARD, take: 8,
    }),
  ]);

  // Resolve trending ids to tools, preserving the click ranking.
  const ids = clickRows.map((r) => r.toolId);
  const trendingTools = ids.length
    ? await prisma.tool.findMany({ where: { id: { in: ids }, isActive: true }, select: CARD })
    : [];
  const byId = Object.fromEntries(trendingTools.map((t) => [t.id, t]));
  const trending = ids.map((id) => byId[id]).filter(Boolean);

  const present = (list) => list.map((t) => ({
    ...t,
    score: presentScore(t.score),
    topRating: headlineRating(t.externalRatings),
    externalRatings: undefined,
  }));

  res.json({
    trending: present(trending),
    editorsPicks: present(editors).sort((a, b) => (b.score?.overall || 0) - (a.score?.overall || 0)),
    mostReviewed: present(mostReviewed),
    recentlyAdded: present(recentlyAdded),
  });
}));

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
      facts: { orderBy: { orderIndex: "asc" } },
      externalRatings: { orderBy: { orderIndex: "asc" } },
      verdict: true,
      alternatives: { orderBy: { orderIndex: "asc" }, include: { alternative: { select: { id: true, name: true, slug: true } } } },
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

/* PUT /api/tools/manage/:id/facts — replace a tool's verified facts.
 *
 * Wholesale replacement rather than per-row CRUD, for the same reason the
 * best-of picks work this way: the editor edits an ordered list and saves it.
 *
 * Two rules are enforced here rather than trusted to the form:
 *
 *   1. An `official` or `external` claim MUST carry a source. A vendor
 *      statistic with nowhere to check it is the exact thing this table exists
 *      to prevent, so it is rejected, not silently saved.
 *   2. Source URLs must be http(s). A javascript: or data: URL in a field that
 *      renders as a link is an XSS vector.
 */
const FACT_KINDS = new Set(["official", "external", "community", "editorial"]);

router.put("/manage/:id/facts", requireAdmin, ah(async (req, res, next) => {
  const toolId = Number(req.params.id);
  const rows = Array.isArray(req.body?.facts) ? req.body.facts : null;
  if (!rows) { const e = new Error("Expected a `facts` array."); e.status = 400; return next(e); }

  const clean = [];
  for (const [i, f] of rows.entries()) {
    const label = f.label?.trim();
    const value = f.value?.trim();
    if (!label || !value) continue; // half-filled rows are dropped, not saved

    const kind = FACT_KINDS.has(f.kind) ? f.kind : "official";
    const sourceUrl = f.sourceUrl?.trim() || null;

    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      const e = new Error(`"${label}": the source URL must start with http:// or https://`);
      e.status = 400;
      return next(e);
    }
    if ((kind === "official" || kind === "external") && !sourceUrl) {
      const article = kind === "official" || kind === "external" ? (kind === "official" ? "an" : "a") : "a";
      const e = new Error(`"${label}" is ${article} ${kind} claim, so it needs a source URL where it can be checked.`);
      e.status = 400;
      return next(e);
    }

    clean.push({
      toolId, kind, label, value,
      sourceName: f.sourceName?.trim() || null,
      sourceUrl,
      verifiedAt: f.verifiedAt ? new Date(f.verifiedAt) : new Date(),
      orderIndex: i,
    });
  }

  await prisma.$transaction([
    prisma.toolFact.deleteMany({ where: { toolId } }),
    ...(clean.length ? [prisma.toolFact.createMany({ data: clean })] : []),
  ]);

  res.json({ ok: true, count: clean.length });
}));

/* PUT /api/tools/manage/:id/external — replace a tool's external ratings.
 *
 * Every row needs a source URL, without exception. An external rating is a
 * claim about somebody else's data; if a reader can't go and check it, it
 * should not be on the page. The rating must also fall inside the scale it
 * claims to use, because "6 out of 5" is how a typo becomes a lie.
 */
router.put("/manage/:id/external", requireAdmin, ah(async (req, res, next) => {
  const toolId = Number(req.params.id);
  const rows = Array.isArray(req.body?.ratings) ? req.body.ratings : null;
  if (!rows) { const e = new Error("Expected a `ratings` array."); e.status = 400; return next(e); }

  const clean = [];
  const seen = new Set();
  for (const [i, r] of rows.entries()) {
    const sourceName = r.sourceName?.trim();
    if (!sourceName) continue;

    const sourceUrl = r.sourceUrl?.trim();
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
      const e = new Error(`${sourceName}: a source URL starting with http(s):// is required — a rating nobody can check does not go on the page.`);
      e.status = 400; return next(e);
    }
    if (seen.has(sourceName.toLowerCase())) {
      const e = new Error(`${sourceName} appears twice.`); e.status = 400; return next(e);
    }
    seen.add(sourceName.toLowerCase());

    const rating = Number(r.rating);
    const maxRating = Number(r.maxRating) || 5;
    const reviewCount = Math.max(0, Math.floor(Number(r.reviewCount) || 0));
    if (Number.isNaN(rating) || rating < 0 || rating > maxRating) {
      const e = new Error(`${sourceName}: the rating must be between 0 and ${maxRating}.`);
      e.status = 400; return next(e);
    }

    clean.push({
      toolId, sourceName, sourceUrl, rating, maxRating, reviewCount,
      ratingDate: r.ratingDate ? new Date(r.ratingDate) : null,
      retrievedAt: r.retrievedAt ? new Date(r.retrievedAt) : new Date(),
      summary: r.summary?.trim() || null,
      orderIndex: i,
    });
  }

  await prisma.$transaction([
    prisma.externalRating.deleteMany({ where: { toolId } }),
    ...(clean.length ? [prisma.externalRating.createMany({ data: clean })] : []),
  ]);

  res.json({ ok: true, count: clean.length });
}));

const SWITCHING = new Set(["low", "medium", "high"]);
const CLAIM_VERDICTS = new Set(["supported", "partly-supported", "unsupported", "untested"]);

// Trim a list field, drop blanks, cap it so a verdict stays a verdict.
const cleanList = (v, max = 8) =>
  (Array.isArray(v) ? v : []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, max);

// PUT /api/tools/manage/:id/verdict — the editorial assessment (brief 12-16, 23, 24)
router.put("/manage/:id/verdict", requireAdmin, ah(async (req, res, next) => {
  const toolId = Number(req.params.id);
  const b = req.body || {};

  if (b.switchingCost && !SWITCHING.has(b.switchingCost)) {
    const e = new Error("Switching cost must be low, medium or high."); e.status = 400; return next(e);
  }
  if (b.claimVerdict && !CLAIM_VERDICTS.has(b.claimVerdict)) {
    const e = new Error("Claim verdict must be supported, partly-supported, unsupported or untested.");
    e.status = 400; return next(e);
  }
  // Judging a claim without recording the claim is an unattributed opinion.
  if (b.claimVerdict && !b.companyClaim?.trim()) {
    const e = new Error("Record the company's claim before judging it."); e.status = 400; return next(e);
  }

  const data = {
    bestFor: cleanList(b.bestFor), notIdealFor: cleanList(b.notIdealFor),
    loveIf: cleanList(b.loveIf), regretIf: cleanList(b.regretIf),
    costNotes: cleanList(b.costNotes, 6),
    switchingCost: b.switchingCost || null,
    switchingNote: b.switchingNote?.trim() || null,
    companyClaim: b.companyClaim?.trim() || null,
    claimEvidence: b.claimEvidence?.trim() || null,
    claimVerdict: b.claimVerdict || null,
    biggestStrength: b.biggestStrength?.trim() || null,
    biggestTradeoff: b.biggestTradeoff?.trim() || null,
    valueAssessment: b.valueAssessment?.trim() || null,
    finalVerdict: b.finalVerdict?.trim() || null,
    reviewedBy: b.reviewedBy?.trim() || null,
  };

  const verdict = await prisma.toolVerdict.upsert({ where: { toolId }, update: data, create: { toolId, ...data } });
  res.json(verdict);
}));

// PUT /api/tools/manage/:id/alternatives — hand-picked, each with its reason
router.put("/manage/:id/alternatives", requireAdmin, ah(async (req, res, next) => {
  const toolId = Number(req.params.id);
  const rows = Array.isArray(req.body?.alternatives) ? req.body.alternatives : null;
  if (!rows) { const e = new Error("Expected an `alternatives` array."); e.status = 400; return next(e); }

  const seen = new Set();
  const clean = [];
  for (const a of rows) {
    const alternativeId = Number(a.alternativeId);
    const reason = a.reason?.trim();
    if (!alternativeId || seen.has(alternativeId)) continue;
    if (alternativeId === toolId) {
      const e = new Error("A tool can't be its own alternative."); e.status = 400; return next(e);
    }
    if (!reason) {
      const e = new Error("Every alternative needs a reason — otherwise it's just another link.");
      e.status = 400; return next(e);
    }
    seen.add(alternativeId);
    clean.push({ toolId, alternativeId, reason, orderIndex: clean.length });
  }

  await prisma.$transaction([
    prisma.toolAlternative.deleteMany({ where: { toolId } }),
    ...(clean.length ? [prisma.toolAlternative.createMany({ data: clean })] : []),
  ]);
  res.json({ ok: true, count: clean.length });
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
router.get("/", cached(60), ah(async (req, res) => {
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
      include: {
        category: { select: { slug: true, name: true, colorPrimary: true, colorAccent: true } },
        externalRatings: { orderBy: { reviewCount: "desc" }, take: 1 },
      },
      take, skip,
    }),
    prisma.tool.count({ where }),
  ]);

  // Cards carry one real, sourced figure or none at all.
  const cards = items.map((t) => ({
    ...t,
    topRating: headlineRating(t.externalRatings),
    externalRatings: undefined,
  }));

  res.json({ items: cards, total, page: Number(page), pageSize: take, pages: Math.ceil(total / take) });
}));

// GET /api/tools/compare?slugs=claude,chatgpt,figma
router.get("/compare", cached(120), ah(async (req, res) => {
  const slugs = String(req.query.slugs || "").split(",").filter(Boolean).slice(0, 3);
  if (!slugs.length) return res.json({ items: [] });
  const items = await prisma.tool.findMany({
    where: { slug: { in: slugs } },
    include: {
      category: true,
      // The comparison needs the sourced rating for the same reason a card
      // does: without it, two tools nobody has reviewed here sit side by side
      // reading "not rated", when both have thousands of ratings elsewhere.
      externalRatings: { orderBy: { reviewCount: "desc" }, take: 1 },
    },
  });
  // preserve requested order
  items.sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));
  res.json({
    items: items.map((t) => ({
      ...t,
      topRating: headlineRating(t.externalRatings),
      externalRatings: undefined,
    })),
  });
}));

// GET /api/tools/:slug — full detail page payload
router.get("/:slug", cached(120), ah(async (req, res) => {
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
      facts: { orderBy: { orderIndex: "asc" } },
        externalRatings: { orderBy: { orderIndex: "asc" } },
        verdict: true,
        pricing: { include: { plans: { orderBy: { orderIndex: "asc" } } } },
        alternatives: {
          orderBy: { orderIndex: "asc" },
          include: {
            alternative: {
              select: {
                slug: true, name: true, description: true, logoMono: true, logoUrl: true,
                logoAlt: true, rating: true, reviewCount: true, priceType: true,
                priceMin: true, priceMax: true, freeTier: true,
                category: { select: { slug: true, name: true, colorPrimary: true } },
              },
            },
          },
        },
      partner: { select: { slug: true, name: true, status: true, disclosure: true } },
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
  // Evidence is assembled here rather than in the component so the page can't
  // accidentally present a rating without its confidence attached.
  const external = presentExternal(tool.externalRatings || []);
  const trust = trustScore({
    ratings: tool.externalRatings || [],
    facts: tool.facts || [],
    reviewCount: tool.reviewCount || 0,
    hasScore: Boolean(tool.score),
  });

  res.json({
    ...tool,
    score: presentScore(tool.score),
    // Only ever the verified, stored figure. The page never waits on a
    // vendor's website, and an unverified reading collapses to "unavailable".
    pricing: publicShape(tool.pricing),
    alternatives: (tool.alternatives || []).map((a) => ({ ...a.alternative, reason: a.reason })),
    hasEditorialAlternatives: (tool.alternatives || []).length > 0,
    external,
    trust,
    externalRatings: undefined, // superseded by `external`
    related,
  });
}));

export default router;
