import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { cached } from "../lib/cache.js";

const router = Router();

// GET /api/testimonials — site-level testimonials (readers praising Toolhaven
// itself, not tied to a specific tool). Tool-specific testimonials live on the
// tool detail payload instead.
router.get("/", cached(300), ah(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 9, 30);
  const testimonials = await prisma.testimonial.findMany({
    where: { toolId: null },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json(testimonials);
}));

export default router;
