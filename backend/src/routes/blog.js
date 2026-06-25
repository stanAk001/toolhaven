import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";

const router = Router();

// GET /api/blog?category=ai&page=1&limit=9
router.get("/", ah(async (req, res) => {
  const { category, page = "1", limit = "9" } = req.query;
  const where = { isPublished: true };
  if (category && category !== "all") where.category = { slug: String(category) };

  const take = Math.min(Number(limit) || 9, 50);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      include: { category: { select: { slug: true, name: true, colorPrimary: true } } },
      take, skip,
    }),
    prisma.blogPost.count({ where }),
  ]);

  res.json({ items, total, page: Number(page), pages: Math.ceil(total / take) });
}));

// GET /api/blog/:slug
router.get("/:slug", ah(async (req, res) => {
  const post = await prisma.blogPost.findUnique({
    where: { slug: req.params.slug },
    include: {
      category: true,
      toolLinks: {
        orderBy: { mentionOrder: "asc" },
        include: { tool: { include: { category: { select: { slug: true, name: true, colorPrimary: true } } } } },
      },
    },
  });
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(post);
}));

export default router;
