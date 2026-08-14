import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";

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

// GET /api/affiliate-clicks/stats — the outbound picture, for the editor's desk.
//
// Behind requireAdmin: how much traffic you send to which partner is
// commercially sensitive, and this used to be readable by anyone who guessed
// the URL. It also now resolves names rather than returning bare foreign keys,
// and reports which page each click came from — the number that says whether
// best-of pages or tool pages actually convert.
router.get("/stats", requireAdmin, ah(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  const since = new Date(Date.now() - days * 86400000);

  const [total, inRange, byToolRaw, byCategoryRaw, byReferrerRaw] = await Promise.all([
    prisma.affiliateClick.count(),
    prisma.affiliateClick.count({ where: { createdAt: { gte: since } } }),
    prisma.affiliateClick.groupBy({
      by: ["toolId"], _count: { _all: true },
      where: { createdAt: { gte: since } },
      orderBy: { _count: { toolId: "desc" } },
      take: 25,
    }),
    prisma.affiliateClick.groupBy({
      by: ["categoryId"], _count: { _all: true },
      where: { createdAt: { gte: since } },
    }),
    prisma.affiliateClick.groupBy({
      by: ["referrerPage"], _count: { _all: true },
      where: { createdAt: { gte: since } },
      orderBy: { _count: { referrerPage: "desc" } },
      take: 25,
    }),
  ]);

  // Resolve the ids in one round trip each rather than per row.
  const [tools, categories] = await Promise.all([
    prisma.tool.findMany({
      where: { id: { in: byToolRaw.map((t) => t.toolId) } },
      select: { id: true, slug: true, name: true, affiliateLink: true, affiliateNetwork: true },
    }),
    prisma.category.findMany({
      where: { id: { in: byCategoryRaw.map((c) => c.categoryId).filter(Boolean) } },
      select: { id: true, name: true, colorPrimary: true },
    }),
  ]);
  const toolById = Object.fromEntries(tools.map((t) => [t.id, t]));
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));

  res.json({
    days,
    total,
    inRange,
    byTool: byToolRaw.map((row) => {
      const t = toolById[row.toolId];
      return {
        toolId: row.toolId,
        clicks: row._count._all,
        name: t?.name || `Tool #${row.toolId}`,
        slug: t?.slug || null,
        // the flag that matters: clicks going out on a link that earns nothing
        monetised: Boolean(t?.affiliateLink),
        network: t?.affiliateNetwork || null,
      };
    }),
    byCategory: byCategoryRaw
      .map((row) => ({
        categoryId: row.categoryId,
        clicks: row._count._all,
        name: catById[row.categoryId]?.name || "Uncategorised",
        color: catById[row.categoryId]?.colorPrimary || null,
      }))
      .sort((a, b) => b.clicks - a.clicks),
    byReferrer: byReferrerRaw.map((row) => ({
      page: row.referrerPage || "(unknown)",
      clicks: row._count._all,
    })),
  });
}));

export default router;
