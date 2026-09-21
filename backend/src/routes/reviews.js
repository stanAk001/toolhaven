import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";
// The same one-way address hash the promotion events use: enough to recognise
// a repeat, never enough to identify anyone.
import { hashIp } from "../lib/promotion/owner.js";

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

/**
 * POST /api/reviews/:id/helpful — one vote per reader, counted once.
 *
 * This used to be an unconditional increment on a public endpoint. The browser
 * remembered whether you had already voted, which stops an honest reader
 * clicking twice and stops nobody else: a loop against this URL could put any
 * number under any review, and that number is shown to readers as a reason to
 * believe the review.
 *
 * A tally anyone can invent is worth less than no tally, and this site does not
 * print figures it cannot stand behind. The vote is now recorded against a
 * salted hash of the address, with a unique constraint doing the real work —
 * two requests racing produce one row and one increment, which a read-then-write
 * check would not guarantee.
 *
 * Voting twice is not an error. It answers with the current count and changes
 * nothing, because a reader who clicks again has not done anything wrong.
 */
router.post("/:id/helpful", ah(async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { const e = new Error("Not found"); e.status = 404; return next(e); }

  const review = await prisma.toolReview.findUnique({ where: { id }, select: { id: true, helpful: true } });
  if (!review) { const e = new Error("Not found"); e.status = 404; return next(e); }

  const ipHash = hashIp(req.ip);
  if (!ipHash) return res.json({ id: review.id, helpful: review.helpful, counted: false });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Throws on the unique constraint if this reader has already voted.
      await tx.reviewHelpfulVote.create({ data: { reviewId: id, ipHash } });
      return tx.toolReview.update({
        where: { id },
        data: { helpful: { increment: 1 } },
        select: { id: true, helpful: true },
      });
    });
    res.json({ ...updated, counted: true });
  } catch (err) {
    if (err?.code === "P2002") {
      return res.json({ id: review.id, helpful: review.helpful, counted: false });
    }
    throw err;
  }
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
