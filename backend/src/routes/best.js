import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";

const r = Router();

// "Best AI Tools in 2026" → "best-ai-tools-in-2026"
const slugify = (s = "") =>
  s.toLowerCase().trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

// Everything an entry needs to render a row and a comparison column. Read from
// the Tool itself rather than copied onto the entry, so a price change on the
// tool page is a price change here.
const ENTRY_TOOL = {
  select: {
    id: true, slug: true, name: true, description: true, bestFor: true, caveat: true,
    logoMono: true, priceMin: true, priceMax: true, priceType: true,
    freeTrial: true, freeTier: true, rating: true, reviewCount: true,
    category: { select: { slug: true, name: true, colorPrimary: true } },
    pros: { select: { id: true, text: true }, take: 3 },
  },
};

// GET /api/best — the index
r.get("/", ah(async (_req, res) => {
  const items = await prisma.bestList.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true, title: true, subtitle: true, audience: true, publishedAt: true, updatedAt: true,
      category: { select: { slug: true, name: true, colorPrimary: true } },
      _count: { select: { entries: true } },
      entries: {
        orderBy: { rank: "asc" }, take: 5,
        select: { tool: { select: { slug: true, name: true, logoMono: true, category: { select: { colorPrimary: true } } } } },
      },
    },
  });
  res.json({ items: items.map((l) => ({ ...l, toolCount: l._count.entries, _count: undefined })) });
}));

/* ── Editor's desk ────────────────────────────────────────────────────────
   Registered before the public "/:slug" handler on purpose: Express matches in
   order, and "/manage" would otherwise be read as a list whose slug is
   "manage". Entries and FAQs are replaced wholesale rather than patched one at
   a time — the editor edits an ordered array and saves it, so diffing
   individual rows would be work in aid of nothing. */

// GET /api/best/manage — every list, drafts included
r.get("/manage", requireAdmin, ah(async (_req, res) => {
  const items = await prisma.bestList.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, slug: true, title: true, subtitle: true, isPublished: true,
      publishedAt: true, updatedAt: true,
      category: { select: { id: true, name: true } },
      _count: { select: { entries: true, faqs: true } },
    },
  });
  res.json({
    items: items.map((l) => ({
      ...l, entryCount: l._count.entries, faqCount: l._count.faqs, _count: undefined,
    })),
  });
}));

// GET /api/best/manage/:id — one list in full, for the editor
r.get("/manage/:id", requireAdmin, ah(async (req, res, next) => {
  const list = await prisma.bestList.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      entries: {
        orderBy: { rank: "asc" },
        select: {
          id: true, rank: true, award: true, blurb: true,
          tool: { select: { id: true, slug: true, name: true, logoMono: true, category: { select: { name: true, colorPrimary: true } } } },
        },
      },
      faqs: { orderBy: { orderIndex: "asc" }, select: { id: true, question: true, answer: true } },
    },
  });
  if (!list) { const e = new Error("Best list not found"); e.status = 404; return next(e); }
  res.json(list);
}));

// POST /api/best/manage — create
r.post("/manage", requireAdmin, ah(async (req, res, next) => {
  const { title, subtitle, intro, audience, criteria, categoryId, isPublished } = req.body || {};
  if (!title?.trim()) { const e = new Error("A title is required."); e.status = 400; return next(e); }

  const slug = slugify(req.body?.slug || title);
  if (await prisma.bestList.findUnique({ where: { slug } })) {
    const e = new Error(`The slug "${slug}" is already taken.`);
    e.status = 409;
    return next(e);
  }

  const list = await prisma.bestList.create({
    data: {
      slug,
      title: title.trim(),
      subtitle: subtitle?.trim() || null,
      intro: intro?.trim() || "",
      audience: audience?.trim() || null,
      criteria: criteria?.trim() || null,
      categoryId: categoryId ? Number(categoryId) : null,
      isPublished: Boolean(isPublished),
    },
  });
  res.status(201).json(list);
}));

// PATCH /api/best/manage/:id — update the list's own fields
r.patch("/manage/:id", requireAdmin, ah(async (req, res, next) => {
  const id = Number(req.params.id);
  const { title, subtitle, intro, audience, criteria, categoryId, isPublished } = req.body || {};
  const data = {};

  if (title !== undefined) {
    if (!title.trim()) { const e = new Error("A title is required."); e.status = 400; return next(e); }
    data.title = title.trim();
  }
  if (req.body?.slug !== undefined) {
    const slug = slugify(req.body.slug);
    const clash = await prisma.bestList.findUnique({ where: { slug } });
    if (clash && clash.id !== id) {
      const e = new Error(`The slug "${slug}" is already taken.`);
      e.status = 409;
      return next(e);
    }
    data.slug = slug;
  }
  if (subtitle !== undefined) data.subtitle = subtitle?.trim() || null;
  if (intro !== undefined) data.intro = intro?.trim() || "";
  if (audience !== undefined) data.audience = audience?.trim() || null;
  if (criteria !== undefined) data.criteria = criteria?.trim() || null;
  if (categoryId !== undefined) data.categoryId = categoryId ? Number(categoryId) : null;
  if (isPublished !== undefined) data.isPublished = Boolean(isPublished);

  const list = await prisma.bestList.update({ where: { id }, data });
  res.json(list);
}));

// DELETE /api/best/manage/:id — entries and FAQs cascade
r.delete("/manage/:id", requireAdmin, ah(async (req, res) => {
  await prisma.bestList.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}));

// PUT /api/best/manage/:id/entries — replace the ranked picks
r.put("/manage/:id/entries", requireAdmin, ah(async (req, res, next) => {
  const bestListId = Number(req.params.id);
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : null;
  if (!entries) { const e = new Error("Expected an `entries` array."); e.status = 400; return next(e); }

  // De-duplicate: the same tool twice in one list breaks the unique constraint
  // and would be meaningless anyway.
  const seen = new Set();
  const clean = [];
  for (const e of entries) {
    const toolId = Number(e.toolId);
    if (!toolId || seen.has(toolId)) continue;
    seen.add(toolId);
    clean.push({
      bestListId, toolId,
      rank: clean.length + 1,
      award: e.award?.trim() || null,
      blurb: e.blurb?.trim() || null,
    });
  }

  // One transaction, so a failure can't leave the list with its old picks gone
  // and its new ones unwritten.
  await prisma.$transaction([
    prisma.bestListEntry.deleteMany({ where: { bestListId } }),
    ...(clean.length ? [prisma.bestListEntry.createMany({ data: clean })] : []),
    prisma.bestList.update({ where: { id: bestListId }, data: { updatedAt: new Date() } }),
  ]);

  res.json({ ok: true, count: clean.length });
}));

// PUT /api/best/manage/:id/faqs — replace the questions
r.put("/manage/:id/faqs", requireAdmin, ah(async (req, res, next) => {
  const bestListId = Number(req.params.id);
  const faqs = Array.isArray(req.body?.faqs) ? req.body.faqs : null;
  if (!faqs) { const e = new Error("Expected a `faqs` array."); e.status = 400; return next(e); }

  const clean = faqs
    .filter((f) => f.question?.trim() && f.answer?.trim())
    .map((f, i) => ({
      bestListId, orderIndex: i,
      question: f.question.trim(),
      answer: f.answer.trim(),
    }));

  await prisma.$transaction([
    prisma.bestListFaq.deleteMany({ where: { bestListId } }),
    ...(clean.length ? [prisma.bestListFaq.createMany({ data: clean })] : []),
  ]);

  res.json({ ok: true, count: clean.length });
}));

// GET /api/best/:slug — one list, with its ranked entries and FAQ
r.get("/:slug", ah(async (req, res, next) => {
  const list = await prisma.bestList.findUnique({
    where: { slug: req.params.slug },
    include: {
      category: { select: { slug: true, name: true, colorPrimary: true, colorAccent: true } },
      faqs: { orderBy: { orderIndex: "asc" }, select: { id: true, question: true, answer: true } },
      entries: { orderBy: { rank: "asc" }, select: { id: true, rank: true, award: true, blurb: true, tool: ENTRY_TOOL } },
    },
  });

  if (!list || !list.isPublished) {
    const err = new Error("Best list not found");
    err.status = 404;
    return next(err);
  }

  // Other lists in the same category, for the internal-link block at the foot
  const related = list.categoryId
    ? await prisma.bestList.findMany({
      where: { isPublished: true, categoryId: list.categoryId, NOT: { id: list.id } },
      take: 3,
      select: { slug: true, title: true, subtitle: true },
    })
    : [];

  res.json({ ...list, related });
}));

export default r;
