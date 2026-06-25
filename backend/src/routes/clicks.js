import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";

const router = Router();

// POST /api/affiliate-clicks  { toolId, referrerPage }
// Logs the click and returns the tool's affiliate link so the client can redirect.
router.post("/", ah(async (req, res) => {
  const { toolId, referrerPage } = req.body;
  if (!toolId) return res.status(400).json({ error: "toolId is required" });

  const tool = await prisma.tool.findUnique({
    where: { id: Number(toolId) },
    select: { id: true, categoryId: true, affiliateLink: true, websiteUrl: true },
  });
  if (!tool) return res.status(404).json({ error: "Tool not found" });

  await prisma.affiliateClick.create({
    data: {
      toolId: tool.id,
      categoryId: tool.categoryId,
      userIp: req.ip,
      userAgent: req.get("user-agent") || null,
      referrerPage: referrerPage || null,
    },
  });

  res.status(201).json({ ok: true, redirect: tool.affiliateLink || tool.websiteUrl });
}));

// GET /api/affiliate-clicks/stats — simple admin dashboard numbers, grouped by category + tool
router.get("/stats", ah(async (req, res) => {
  const [byCategory, byTool, total] = await Promise.all([
    prisma.affiliateClick.groupBy({ by: ["categoryId"], _count: { _all: true } }),
    prisma.affiliateClick.groupBy({ by: ["toolId"], _count: { _all: true } }),
    prisma.affiliateClick.count(),
  ]);
  res.json({ total, byCategory, byTool });
}));

export default router;
