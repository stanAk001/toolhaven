/**
 * Buying guides — the editor's side.
 *
 * Product information is entered here by a person. There is deliberately no
 * scraper: Amazon's terms forbid it, their page structure changes constantly,
 * and a guide assembled by a script is exactly the thin affiliate page this
 * section is supposed not to be. The Product Advertising API is the sanctioned
 * route if you ever qualify for it, and this shape is what it would fill in.
 *
 * Picks and FAQs save as whole ordered arrays rather than one row at a time,
 * which makes reordering a matter of sending them in the order you want.
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { refId, existingRefId } from "../lib/refid.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAdmin);

const slugify = (s) => String(s || "").toLowerCase().trim()
  .replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const text = (v, len) => (v === undefined ? undefined : String(v ?? "").trim().slice(0, len) || null);
const lines = (v, max = 10, len = 200) => (v === undefined ? undefined
  : (typeof v === "string" ? v.split("\n") : Array.isArray(v) ? v : [])
    .map((x) => String(x).trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, len)));

/**
 * Amazon links are checked rather than trusted.
 *
 * A mistyped or foreign URL in this field would send readers somewhere we did
 * not intend under a heading that says we recommend it, so only real Amazon
 * hosts are accepted.
 */
const AMAZON_HOST = /(^|\.)(amazon\.[a-z.]{2,6}|amzn\.to|amzn\.eu)$/i;
function amazonUrl(v) {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim();
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch { throw Object.assign(new Error("That Amazon link isn't a valid URL."), { status: 400 }); }
  if (u.protocol !== "https:") throw Object.assign(new Error("Amazon links have to be https."), { status: 400 });
  if (!AMAZON_HOST.test(u.hostname)) {
    throw Object.assign(new Error(`"${u.hostname}" isn't an Amazon domain. Paste the affiliate link from Associates.`), { status: 400 });
  }
  return s.slice(0, 600);
}

// GET /api/admin/guides — the desk list
router.get("/", ah(async (_req, res) => {
  const items = await prisma.buyingGuide.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: {
      category: { select: { slug: true, name: true } },
      _count: { select: { picks: true, faqs: true } },
    },
  });
  res.json({
    items: items.map((g) => ({
      id: g.id, slug: g.slug, title: g.title, standfirst: g.standfirst,
      status: g.status, publishedAt: g.publishedAt, updatedAt: g.updatedAt,
      productsConsidered: g.productsConsidered,
      category: g.category,
      pickCount: g._count.picks, faqCount: g._count.faqs,
      // A guide with no picks is not publishable, and saying so in the list
      // saves opening it to find out.
      ready: g._count.picks > 0,
    })),
    counts: {
      draft: items.filter((g) => g.status === "draft").length,
      published: items.filter((g) => g.status === "published").length,
    },
  });
}));

// GET /api/admin/guides/:id — everything, drafts included
router.get("/:id", ah(async (req, res, next) => {
  const g = await prisma.buyingGuide.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      picks: {
        orderBy: { orderIndex: "asc" },
        // The gallery travels with the pick; without this the photos array
        // silently comes back empty and every pick loses its pictures.
        include: { photos: { orderBy: { position: "asc" } } },
      },
      faqs: { orderBy: { orderIndex: "asc" } },
      category: { select: { id: true, slug: true, name: true } },
    },
  });
  if (!g) { const e = new Error("Guide not found"); e.status = 404; return next(e); }
  res.json({ guide: g });
}));

// POST /api/admin/guides — start a guide
router.post("/", ah(async (req, res, next) => {
  const b = req.body || {};
  const title = String(b.title || "").trim();
  if (!title) { const e = new Error("Give the guide a title."); e.status = 400; return next(e); }

  const slug = slugify(b.slug || title);
  if (!slug) { const e = new Error("That title doesn't make a usable web address — set a slug by hand."); e.status = 400; return next(e); }
  if (await prisma.buyingGuide.findUnique({ where: { slug } })) {
    const e = new Error(`"${slug}" is taken. Edit that guide, or give this one a different slug.`);
    e.status = 400; return next(e);
  }

  const guide = await prisma.buyingGuide.create({
    data: {
      slug, title,
      standfirst: text(b.standfirst, 300),
      intro: text(b.intro, 8000),
      methodology: text(b.methodology, 8000),
      productsConsidered: Number.isInteger(Number(b.productsConsidered)) && Number(b.productsConsidered) > 0
        ? Number(b.productsConsidered) : null,
      categoryId: await existingRefId(b.categoryId, prisma.category),
      status: "draft",
    },
  });
  res.status(201).json({ guide });
}));

// PATCH /api/admin/guides/:id — edit, and publish or withdraw
router.patch("/:id", ah(async (req, res, next) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const current = await prisma.buyingGuide.findUnique({
    where: { id }, include: { _count: { select: { picks: true } } },
  });
  if (!current) { const e = new Error("Guide not found"); e.status = 404; return next(e); }

  // A guide with nothing in it is a page that wastes a reader's click and, on
  // an affiliate section, looks exactly like the thin content it is.
  if (b.status === "published" && current._count.picks === 0) {
    const e = new Error("Add at least one pick before publishing — an empty guide is a thin page.");
    e.status = 400; return next(e);
  }

  const data = {
    title: text(b.title, 200),
    standfirst: text(b.standfirst, 300),
    intro: text(b.intro, 8000),
    methodology: text(b.methodology, 8000),
    finalWord: text(b.finalWord, 4000),
    seoTitle: text(b.seoTitle, 200),
    metaDescription: text(b.metaDescription, 320),
    canonicalUrl: text(b.canonicalUrl, 400),
    ogTitle: text(b.ogTitle, 200),
    ogDescription: text(b.ogDescription, 320),
  };
  if (b.slug !== undefined) {
    const next_ = slugify(b.slug);
    if (!next_) { const e = new Error("That slug isn't usable."); e.status = 400; return next(e); }
    const clash = await prisma.buyingGuide.findUnique({ where: { slug: next_ } });
    if (clash && clash.id !== id) { const e = new Error(`"${next_}" is already taken.`); e.status = 400; return next(e); }
    data.slug = next_;
  }
  if (b.productsConsidered !== undefined) {
    const n = Number(b.productsConsidered);
    data.productsConsidered = Number.isInteger(n) && n > 0 ? n : null;
  }
  if (b.categoryId !== undefined) {
    data.categoryId = await existingRefId(b.categoryId, prisma.category);
  }
  if (b.ogImageId !== undefined) {
    data.ogImageId = await existingRefId(b.ogImageId, prisma.upload);
  }
  if (b.status === "published" || b.status === "draft") {
    data.status = b.status;
    // Stamped once, on first publication. Re-publishing after a withdrawal
    // keeps the original date, because that is when the guide appeared.
    if (b.status === "published" && !current.publishedAt) data.publishedAt = new Date();
  }
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];

  const guide = await prisma.buyingGuide.update({ where: { id }, data });
  res.json({ guide });
}));

// DELETE /api/admin/guides/:id
router.delete("/:id", ah(async (req, res) => {
  await prisma.buyingGuide.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}));

/**
 * PUT /api/admin/guides/:id/picks — the whole ordered list at once.
 *
 * Replacing wholesale makes reordering trivial: send them in the order you
 * want. The alternative — per-row updates plus an index column to keep in
 * step — is the shape that drifts.
 */
router.put("/:id/picks", ah(async (req, res, next) => {
  const guideId = Number(req.params.id);
  const rows = Array.isArray(req.body?.picks) ? req.body.picks : null;
  if (!rows) { const e = new Error("Expected a `picks` array."); e.status = 400; return next(e); }

  const clean = [];
  for (const [i, r] of rows.entries()) {
    const name = String(r?.name || "").trim();
    if (!name) { const e = new Error(`Pick ${i + 1} has no product name.`); e.status = 400; return next(e); }

    let link;
    try { link = amazonUrl(r.amazonUrl); }
    catch (err) { err.message = `Pick ${i + 1} (${name}): ${err.message}`; return next(err); }

    const specs = Array.isArray(r.specs)
      ? r.specs.filter((s) => s && (s.label || s.value))
        .slice(0, 14)
        .map((s) => ({ label: String(s.label || "").slice(0, 60), value: String(s.value || "").slice(0, 160) }))
      : [];

    // Up to eight photos, each an upload id we have actually stored. An id
    // that is not a positive integer is dropped rather than trusted — this is
    // an admin route, but a typo should not write a dangling foreign key.
    const photos = (Array.isArray(r.photos) ? r.photos : [])
      .map((ph) => ({
        uploadId: Number(ph?.id ?? ph?.uploadId),
        alt: text(ph?.alt, 200) ?? null,
      }))
      .filter((ph) => Number.isInteger(ph.uploadId) && ph.uploadId > 0)
      .slice(0, 8)
      .map((ph, n) => ({ ...ph, position: n }));

    clean.push({
      photos,
      guideId,
      award: text(r.award, 60) ?? null,
      name: name.slice(0, 160),
      brand: text(r.brand, 80) ?? null,
      model: text(r.model, 80) ?? null,
      // The gallery is the source of truth; imageId mirrors its first entry
      // so the single-image column stays correct for anything still reading it.
      imageId: photos[0]?.uploadId ?? refId(r.imageId),
      imageAlt: photos[0]?.alt ?? (text(r.imageAlt, 200) ?? null),
      verdict: text(r.verdict, 2000) ?? null,
      bestFor: text(r.bestFor, 300) ?? null,
      considerElseIf: text(r.considerElseIf, 300) ?? null,
      specs,
      pros: lines(r.pros, 8, 160) || [],
      cons: lines(r.cons, 8, 160) || [],
      amazonUrl: link ?? null,
      asin: text(r.asin, 20) ?? null,
      reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : null,
      orderIndex: clean.length,
    });
  }

  // Which of the requested photo ids name an upload that actually exists.
  //
  // Deliberately outside the transaction. It is a read, it does not need to be
  // atomic with the write, and against a remote database every statement held
  // inside a transaction is a second of its budget — putting this in there took
  // the whole save past Prisma's 5s interactive limit and rolled back a legitimate
  // edit. Ids that do not resolve are dropped rather than allowed to violate the
  // foreign key, because one stale id should not fail an editor's whole guide.
  const requested = [...new Set(clean.flatMap((c) => c.photos.map((ph) => ph.uploadId)))];
  const real = requested.length
    ? new Set((await prisma.upload.findMany({
      where: { id: { in: requested } }, select: { id: true },
    })).map((u) => u.id))
    : new Set();

  for (const c of clean) {
    c.photos = c.photos.filter((ph) => real.has(ph.uploadId)).map((ph, n) => ({ ...ph, position: n }));
    // imageId mirrors the lead photo, so it has to follow the filtered list.
    if (c.photos.length) { c.imageId = c.photos[0].uploadId; c.imageAlt = c.photos[0].alt; }
    else if (!real.has(c.imageId)) { c.imageId = null; }
  }

  // Three statements, whatever the guide's size. A create per pick meant one
  // network round-trip each: a twenty-pick guide was twenty round-trips held
  // open against a database in Ohio, and on a constrained connection pool a
  // transaction that could not even start.
  await prisma.$transaction(async (tx) => {
    // Removing the picks takes their photos with them (onDelete: Cascade). The
    // Upload rows are left alone: those bytes are de-duplicated by hash and may
    // still belong to another guide.
    await tx.guidePick.deleteMany({ where: { guideId } });
    if (!clean.length) return;

    const rows = await tx.guidePick.createManyAndReturn({
      data: clean.map(({ photos, ...pick }) => pick),
      select: { id: true, orderIndex: true },
    });

    // Match each returned id back to the pick it came from by orderIndex, which
    // is unique within a guide — never by array position, which the database is
    // under no obligation to preserve.
    const byOrder = new Map(rows.map((r) => [r.orderIndex, r.id]));
    const photoRows = clean.flatMap((pick, n) => {
      const pickId = byOrder.get(n);
      return pickId ? pick.photos.map((ph) => ({ ...ph, pickId })) : [];
    });
    if (photoRows.length) await tx.guidePickPhoto.createMany({ data: photoRows });
  }, {
    // The default 5s is tuned for a database on the same machine. This one is a
    // network away, and a guide with twenty picks and a hundred photos is three
    // statements but not three fast ones.
    timeout: 20000,
    maxWait: 10000,
  });

  res.json({ ok: true, count: clean.length });
}));

// PUT /api/admin/guides/:id/faqs — same wholesale pattern
router.put("/:id/faqs", ah(async (req, res, next) => {
  const guideId = Number(req.params.id);
  const rows = Array.isArray(req.body?.faqs) ? req.body.faqs : null;
  if (!rows) { const e = new Error("Expected a `faqs` array."); e.status = 400; return next(e); }

  const clean = rows
    .map((f) => ({
      guideId,
      question: String(f?.question || "").trim().slice(0, 300),
      answer: String(f?.answer || "").trim().slice(0, 4000),
    }))
    .filter((f) => f.question && f.answer)
    .slice(0, 20)
    .map((f, i) => ({ ...f, orderIndex: i }));

  await prisma.$transaction([
    prisma.guideFaq.deleteMany({ where: { guideId } }),
    ...(clean.length ? [prisma.guideFaq.createMany({ data: clean })] : []),
  ]);
  res.json({ ok: true, count: clean.length });
}));

export default router;
