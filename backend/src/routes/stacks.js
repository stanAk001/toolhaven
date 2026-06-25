import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";
import { sendMail } from "../lib/mailer.js";

const router = Router();

// resolve a list of slugs into display-ready tool objects, preserving order
async function resolveTools(stacks) {
  const slugs = [...new Set(stacks.flatMap((s) => s.toolSlugs))];
  if (!slugs.length) return stacks.map((s) => ({ ...s, tools: [] }));
  const tools = await prisma.tool.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, name: true, logoMono: true, category: { select: { colorPrimary: true } } },
  });
  const map = Object.fromEntries(tools.map((t) => [t.slug, t]));
  return stacks.map((s) => ({ ...s, tools: s.toolSlugs.map((sl) => map[sl]).filter(Boolean) }));
}

// GET /api/stacks — public: approved stacks, newest first, tools resolved
router.get("/", ah(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 24, 60);
  const stacks = await prisma.stack.findMany({ where: { status: "approved" }, orderBy: { createdAt: "desc" }, take: limit });
  res.json({ items: await resolveTools(stacks) });
}));

// POST /api/stacks — a reader shares their stack; lands pending
router.post("/", ah(async (req, res) => {
  const { authorName, authorRole, note, toolSlugs, website } = req.body;
  if (website) return res.status(201).json({ ok: true }); // honeypot

  const slugs = Array.isArray(toolSlugs) ? [...new Set(toolSlugs.filter(Boolean))].slice(0, 12) : [];
  if (slugs.length < 2) return res.status(400).json({ error: "Pick at least two tools you actually use." });

  const valid = await prisma.tool.findMany({ where: { slug: { in: slugs } }, select: { slug: true } });
  const validSlugs = slugs.filter((s) => valid.some((v) => v.slug === s)); // keep order
  if (validSlugs.length < 2) return res.status(400).json({ error: "Those tools weren't recognised." });

  await prisma.stack.create({
    data: {
      authorName: authorName ? String(authorName).slice(0, 80) : null,
      authorRole: authorRole ? String(authorRole).slice(0, 80) : null,
      note: note ? String(note).slice(0, 500) : null,
      toolSlugs: validSlugs,
      status: "pending",
    },
  });

  sendMail({
    subject: `New community stack (${validSlugs.length} tools)`,
    text: `${authorName || "Someone"}${authorRole ? ` (${authorRole})` : ""} shared a stack:\n${validSlugs.join(", ")}\n\nNote: ${note || "—"}`,
  });

  res.status(201).json({ ok: true, pending: true });
}));

// ---- editor-only moderation ----

router.get("/pending", requireAdmin, ah(async (req, res) => {
  const stacks = await prisma.stack.findMany({ where: { status: "pending" }, orderBy: { createdAt: "desc" } });
  res.json({ items: await resolveTools(stacks) });
}));

router.patch("/:id", requireAdmin, ah(async (req, res) => {
  const { status } = req.body;
  if (!["approved", "pending"].includes(status)) return res.status(400).json({ error: "Status must be 'approved' or 'pending'." });
  const updated = await prisma.stack.update({ where: { id: Number(req.params.id) }, data: { status } });
  res.json(updated);
}));

router.delete("/:id", requireAdmin, ah(async (req, res) => {
  await prisma.stack.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}));

export default router;
