/**
 * The desk's own mailing list.
 *
 * Mounted under /api/admin, so it inherits the editor's gate and the strict
 * attempt limit that sits in front of everything there.
 */
import { Router } from "express";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";
import { recipients, sendBroadcast, broadcastKey, AUDIENCES } from "../lib/broadcast.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
router.use(requireAdmin);

/** GET /api/admin/broadcast/audiences — who can be written to, and how many. */
router.get("/audiences", ah(async (_req, res) => {
  const out = [];
  for (const [key, spec] of Object.entries(AUDIENCES)) {
    out.push({ key, label: spec.label, count: (await recipients({ audience: key })).length });
  }
  res.json({ audiences: out });
}));

/**
 * GET /api/admin/broadcast/recipients?audience=&key=
 *
 * The list itself. With a key, each row says whether that person has already
 * had that message — which is what makes pressing send a second time safe.
 */
router.get("/recipients", ah(async (req, res) => {
  const audience = String(req.query.audience || "all");
  const key = req.query.subject ? broadcastKey(req.query.subject) : null;
  const people = await recipients({ audience, key });
  res.json({
    audience,
    total: people.length,
    pending: people.filter((p) => !p.alreadySent).length,
    items: people,
  });
}));

/** GET /api/admin/broadcast/history — what has been sent, newest first. */
router.get("/history", ah(async (_req, res) => {
  const rows = await prisma.emailEvent.groupBy({
    by: ["eventType"],
    where: { eventType: { startsWith: "broadcast:" } },
    _count: { _all: true },
    _max: { sentAt: true },
  });
  res.json({
    items: rows
      .map((r) => ({ key: r.eventType, sent: r._count._all, lastSentAt: r._max.sentAt }))
      .sort((a, b) => new Date(b.lastSentAt) - new Date(a.lastSentAt)),
  });
}));

/**
 * POST /api/admin/broadcast  { subject, message, linkUrl?, linkLabel?, audience?, dryRun? }
 *
 * `dryRun` answers "who would get this" without sending anything, which is the
 * only way to make a one-way action reviewable before it happens.
 */
router.post("/", ah(async (req, res, next) => {
  const b = req.body || {};
  const subject = String(b.subject || "").trim().slice(0, 140);
  const result = await sendBroadcast({
    key: broadcastKey(subject),
    subject,
    message: String(b.message || "").slice(0, 6000),
    linkUrl: String(b.linkUrl || "").trim().slice(0, 500),
    linkLabel: String(b.linkLabel || "").trim().slice(0, 40),
    audience: String(b.audience || "all"),
    dryRun: b.dryRun === true,
  });
  if (!result.ok) { const e = new Error(result.reason); e.status = 400; return next(e); }
  res.json(result);
}));

export default router;
