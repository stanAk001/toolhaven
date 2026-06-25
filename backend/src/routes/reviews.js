import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/reviews/tool/:toolId — public: approved reviews, most-helpful first
router.get("/tool/:toolId", ah(async (req, res) => {
  const reviews = await prisma.toolReview.findMany({
    where: { toolId: Number(req.params.toolId), status: "approved" },
    orderBy: [{ isFeatured: "desc" }, { helpful: "desc" }, { createdAt: "desc" }],
  });
  res.json(reviews);
}));

// POST /api/reviews  { toolId, authorName, title, content, rating, useCase }
// Reader-submitted reviews land as `pending` and only appear once approved.
router.post("/", ah(async (req, res) => {
  const { toolId, authorName, title, content, rating, useCase, website } = req.body;
  if (website) return res.status(201).json({ ok: true }); // honeypot
  if (!toolId || !content) return res.status(400).json({ error: "toolId and content are required" });
  if (String(content).trim().length < 12) return res.status(400).json({ error: "Please write a little more — at least a sentence." });

  await prisma.toolReview.create({
    data: {
      toolId: Number(toolId),
      authorName: authorName ? String(authorName).slice(0, 80) : null,
      title: (title && String(title).slice(0, 120)) || "Reader review",
      content: String(content).slice(0, 2000),
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
      useCase: useCase ? String(useCase).slice(0, 120) : null,
      status: "pending",
    },
  });
  res.status(201).json({ ok: true, pending: true });
}));

// POST /api/reviews/:id/helpful — public: bump the helpful tally by one
router.post("/:id/helpful", ah(async (req, res) => {
  const updated = await prisma.toolReview.update({
    where: { id: Number(req.params.id) },
    data: { helpful: { increment: 1 } },
    select: { id: true, helpful: true },
  });
  res.json(updated);
}));

// ---- editor-only moderation ----

// GET /api/reviews/pending — reviews awaiting moderation, with their tool name
router.get("/pending", requireAdmin, ah(async (req, res) => {
  const items = await prisma.toolReview.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    include: { tool: { select: { name: true, slug: true } } },
  });
  res.json({ items });
}));

// PATCH /api/reviews/:id  { status } — approve (or send back to pending)
router.patch("/:id", requireAdmin, ah(async (req, res) => {
  const { status } = req.body;
  if (!["approved", "pending"].includes(status)) {
    return res.status(400).json({ error: "Status must be 'approved' or 'pending'." });
  }
  const updated = await prisma.toolReview.update({ where: { id: Number(req.params.id) }, data: { status } });
  res.json(updated);
}));

// DELETE /api/reviews/:id — reject/remove
router.delete("/:id", requireAdmin, ah(async (req, res) => {
  await prisma.toolReview.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}));

export default router;
