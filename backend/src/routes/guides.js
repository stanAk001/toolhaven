/**
 * Buying guides — public reads.
 *
 * Only published guides leave this file. A draft is invisible to readers and to
 * crawlers, which is the whole point of having a draft state rather than an
 * editor working live on a page people can find.
 *
 * Two things are deliberately absent from every response: a price and a star
 * rating. Amazon's prices move hourly, so any number printed here would be
 * wrong within the day; and repeating Amazon's rating without their sample is
 * borrowed authority, not evidence. What a reader gets instead is our verdict,
 * the trade-offs, and a link that says "check current price" and means it.
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { cached } from "../lib/cache.js";

const router = Router();

/** Normalise the stored spec blob into ordered label/value pairs. */
const specPairs = (specs) => {
  if (!Array.isArray(specs)) return [];
  return specs
    .filter((s) => s && (s.label || s.value))
    .map((s) => ({ label: String(s.label || "").slice(0, 60), value: String(s.value || "").slice(0, 160) }))
    .slice(0, 14);
};

const publicPick = (p) => ({
  id: p.id,
  award: p.award || null,
  name: p.name,
  brand: p.brand || null,
  model: p.model || null,
  imageUrl: p.imageId ? `/api/uploads/${p.imageId}` : null,
  imageAlt: p.imageAlt || `${p.name}${p.brand ? ` by ${p.brand}` : ""}`,
  // The gallery, in order. Falls back to the single image so a pick saved
  // before galleries existed still shows its photograph.
  photos: (p.photos || []).length
    ? p.photos
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((ph) => ({ id: ph.uploadId, url: `/api/uploads/${ph.uploadId}`, alt: ph.alt || "" }))
    : (p.imageId ? [{ id: p.imageId, url: `/api/uploads/${p.imageId}`, alt: p.imageAlt || "" }] : []),
  verdict: p.verdict || null,
  bestFor: p.bestFor || null,
  considerElseIf: p.considerElseIf || null,
  specs: specPairs(p.specs),
  pros: p.pros || [],
  cons: p.cons || [],
  amazonUrl: p.amazonUrl || null,
  asin: p.asin || null,
  reviewedAt: p.reviewedAt || null,
});

// GET /api/guides — the index
router.get("/", cached(300), ah(async (_req, res) => {
  const items = await prisma.buyingGuide.findMany({
    where: { status: "published" },
    orderBy: [{ publishedAt: "desc" }],
    select: {
      slug: true, title: true, standfirst: true,
      publishedAt: true, updatedAt: true, productsConsidered: true,
      category: { select: { slug: true, name: true, colorPrimary: true } },
      _count: { select: { picks: true } },
    },
  });
  res.json({
    items: items.map((g) => ({
      slug: g.slug, title: g.title, standfirst: g.standfirst,
      publishedAt: g.publishedAt, updatedAt: g.updatedAt,
      productsConsidered: g.productsConsidered,
      pickCount: g._count.picks,
      category: g.category,
    })),
    total: items.length,
  });
}));

// GET /api/guides/:slug — one guide, everything a reader needs
router.get("/:slug", cached(300), ah(async (req, res, next) => {
  const g = await prisma.buyingGuide.findFirst({
    where: { slug: String(req.params.slug), status: "published" },
    include: {
      picks: {
        orderBy: { orderIndex: "asc" },
        // The gallery travels with the pick; without this the photos array
        // silently comes back empty and every pick loses its pictures.
        include: { photos: { orderBy: { position: "asc" } } },
      },
      faqs: { orderBy: { orderIndex: "asc" } },
      category: { select: { slug: true, name: true, colorPrimary: true } },
      ogImage: { select: { id: true } },
    },
  });
  if (!g) { const e = new Error("Guide not found"); e.status = 404; return next(e); }

  res.json({
    slug: g.slug,
    title: g.title,
    standfirst: g.standfirst,
    intro: g.intro,
    methodology: g.methodology,
    productsConsidered: g.productsConsidered,
    finalWord: g.finalWord,
    publishedAt: g.publishedAt,
    updatedAt: g.updatedAt,
    category: g.category,
    seo: {
      title: g.seoTitle || g.title,
      description: g.metaDescription || g.standfirst || null,
      canonicalUrl: g.canonicalUrl || null,
      ogTitle: g.ogTitle || g.seoTitle || g.title,
      ogDescription: g.ogDescription || g.metaDescription || g.standfirst || null,
      ogImageUrl: g.ogImage ? `/api/uploads/${g.ogImage.id}` : null,
    },
    picks: g.picks.map(publicPick),
    faqs: g.faqs.map((f) => ({ question: f.question, answer: f.answer })),
  });
}));

export default router;
