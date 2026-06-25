import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";

const router = Router();

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
    },
  });
  if (!tool) return res.status(404).json({ error: "Tool not found" });

  const related = await prisma.tool.findMany({
    where: { categoryId: tool.categoryId, id: { not: tool.id }, isActive: true },
    take: 4,
    orderBy: { popularity: "desc" },
    include: { category: { select: { slug: true, name: true, colorPrimary: true } } },
  });

  res.json({ ...tool, related });
}));

export default router;
