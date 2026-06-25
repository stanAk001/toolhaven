import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";

const router = Router();

// GET /api/categories  — all categories with a tool count and a few preview
// tools (top by feature/popularity) so cards can show the real logos inside.
router.get("/", ah(async (req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { orderDisplay: "asc" },
    include: {
      _count: { select: { tools: true } },
      tools: {
        where: { isActive: true },
        orderBy: [{ isFeatured: "desc" }, { popularity: "desc" }],
        take: 5,
        select: { slug: true, name: true, logoMono: true },
      },
    },
  });
  res.json(categories.map(({ _count, tools, ...c }) => ({
    ...c,
    toolCount: _count.tools,
    preview: tools,
  })));
}));

// GET /api/categories/:slug — category + its active tools + related posts
router.get("/:slug", ah(async (req, res) => {
  const category = await prisma.category.findUnique({
    where: { slug: req.params.slug },
    include: {
      subcategories: true,
      tools: {
        where: { isActive: true },
        orderBy: [{ isFeatured: "desc" }, { popularity: "desc" }],
      },
      blogPosts: { where: { isPublished: true }, take: 4, orderBy: { publishedAt: "desc" } },
    },
  });
  if (!category) return res.status(404).json({ error: "Category not found" });
  res.json(category);
}));

export default router;
