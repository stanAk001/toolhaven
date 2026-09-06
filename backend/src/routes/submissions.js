import { Router } from "express";
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { refId, existingRefId } from "../lib/refid.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";
import { sendMail } from "../lib/mailer.js";
import { sendSubmissionReceived, sendAdminAlert, sendForStatus } from "../lib/submissionmail.js";
import { STATUSES, canMove, refusal, stampFor, isEditable } from "../lib/submissionflow.js";

const router = Router();

// Same rule the tools desk uses, so a submission published here lands on the
// address it would have had if it were added by hand.
const slugify = (s) => String(s || "").toLowerCase().trim()
  .replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// POST /api/submissions — a vendor submits their tool to be considered for review
router.post("/", ah(async (req, res) => {
  const {
    toolName, websiteUrl, category, pricing, affiliateProgram,
    contactName, email, pitch, details, website, // `website` is a honeypot
    description, logoUrl, features, useCases, targetAudience,
    companyName, socialLinks, screenshots,
  } = req.body;

  // The list fields arrive as a textarea — one item per line. Split, trim, drop
  // blanks, and cap both the count and each entry so a paste-bomb can't land a
  // thousand-item array in the database.
  const lines = (v, max = 12, len = 200) =>
    (typeof v === "string" ? v.split("\n") : Array.isArray(v) ? v : [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, max)
      .map((s) => s.slice(0, len));

  // silently accept-and-drop obvious bots (hidden honeypot field filled in)
  if (website) return res.status(201).json({ ok: true });

  if (!toolName || !websiteUrl || !contactName || !email || !pitch) {
    return res.status(400).json({ error: "Tool name, website, your name, email and a one-line pitch are required." });
  }
  if (!/^\S+@\S+\.\S+$/.test(String(email))) {
    return res.status(400).json({ error: "Please give a valid email so we can reply." });
  }

  // The handle their status page is reached by. Toolhaven has no accounts, so
  // this link is the only way a submitter can check on their own submission —
  // it comes from a CSPRNG rather than anything derived from the id or email,
  // because guessing one would mean reading someone else's.
  const publicToken = randomBytes(16).toString("hex");

  const submission = await prisma.toolSubmission.create({
    data: {
      publicToken,
      logoUploadId: await existingRefId(req.body?.logoUploadId, prisma.upload),
      toolName: String(toolName).slice(0, 120),
      websiteUrl: String(websiteUrl).slice(0, 300),
      category: category ? String(category).slice(0, 60) : null,
      pricing: pricing ? String(pricing).slice(0, 40) : null,
      affiliateProgram: affiliateProgram ? String(affiliateProgram).slice(0, 60) : null,
      contactName: String(contactName).slice(0, 120),
      email: String(email).slice(0, 200),
      pitch: String(pitch).slice(0, 280),
      details: details ? String(details).slice(0, 2000) : null,

      description: description ? String(description).slice(0, 400) : null,
      logoUrl: logoUrl ? String(logoUrl).slice(0, 500) : null,
      targetAudience: targetAudience ? String(targetAudience).slice(0, 300) : null,
      companyName: companyName ? String(companyName).slice(0, 160) : null,
      features: lines(features),
      useCases: lines(useCases),
      socialLinks: lines(socialLinks, 6, 300),
      screenshots: lines(screenshots, 6, 500),
    },
  });

  await prisma.submissionEvent.create({
    data: { submissionId: submission.id, type: "created", toStatus: "pending", actor: "submitter" },
  });

  // Non-blocking: a mail outage must not make a submission look like it failed
  // when the row is safely in the database.
  sendAdminAlert(submission);
  sendSubmissionReceived(submission);

  // The token goes back so the success screen can show the tracking link
  // straight away, rather than making them wait for the email to arrive.
  res.status(201).json({ ok: true, id: submission.id, token: submission.publicToken });
}));

/**
 * GET /api/submissions/track/:token — the submitter's own view.
 *
 * Deliberately not behind requireAdmin: the token *is* the credential. It
 * therefore returns only what the person who submitted already knows, plus the
 * status and any message written for them. The reviewer's internal notes are
 * not in this response and must never be — they are written on the assumption
 * that the submitter cannot read them.
 */
router.get("/track/:token", ah(async (req, res, next) => {
  const token = String(req.params.token || "");
  if (!/^[a-f0-9]{32}$/.test(token)) { const e = new Error("That link isn't valid."); e.status = 404; return next(e); }

  const s = await prisma.toolSubmission.findUnique({
    where: { publicToken: token },
    include: {
      logoUpload: { select: { id: true, mimeType: true } },
      events: { orderBy: { createdAt: "asc" }, select: { type: true, fromStatus: true, toStatus: true, createdAt: true } },
    },
  });
  if (!s) { const e = new Error("We can't find that submission."); e.status = 404; return next(e); }

  let toolSlug = null;
  if (s.publishedToolId) {
    const t = await prisma.tool.findUnique({ where: { id: s.publishedToolId }, select: { slug: true } });
    toolSlug = t?.slug || null;
  }

  res.json({
    submission: {
      toolName: s.toolName, websiteUrl: s.websiteUrl, category: s.category,
      contactName: s.contactName, description: s.description, pitch: s.pitch,
      status: s.status,
      submittedAt: s.submittedAt, lastStatusChange: s.lastStatusChange,
      reviewStartedAt: s.reviewStartedAt, approvedAt: s.approvedAt,
      publishedAt: s.publishedAt, declinedAt: s.declinedAt,
      changesRequestedAt: s.changesRequestedAt,
      // The message written *for* them. Never reviewerNote.
      message: s.submitterMessage || null,
      resubmitCount: s.resubmitCount,
      editable: isEditable(s.status),
      logoUrl: s.logoUpload ? `/api/uploads/${s.logoUpload.id}` : s.logoUrl || null,
      toolSlug,
    },
    timeline: s.events.map((e) => ({ type: e.type, from: e.fromStatus, to: e.toStatus, at: e.createdAt })),
  });
}));

/**
 * PATCH /api/submissions/track/:token — the submitter updates and resubmits.
 *
 * Updates the existing row rather than creating a second submission, so the
 * history stays in one place and a reviewer sees a revision rather than a
 * duplicate. Only fields the submitter owns can be touched — status is not
 * among them; it is set by the server, back to pending, which is the only move
 * a resubmission is allowed to make.
 */
router.patch("/track/:token", ah(async (req, res, next) => {
  const token = String(req.params.token || "");
  if (!/^[a-f0-9]{32}$/.test(token)) { const e = new Error("That link isn't valid."); e.status = 404; return next(e); }

  const s = await prisma.toolSubmission.findUnique({ where: { publicToken: token } });
  if (!s) { const e = new Error("We can't find that submission."); e.status = 404; return next(e); }
  if (!isEditable(s.status)) {
    const e = new Error(s.status === "published"
      ? "This one is already live. Reply to the email if something needs correcting."
      : "This submission isn't open for changes right now.");
    e.status = 409; return next(e);
  }

  const b = req.body || {};
  const text = (v, len) => (v === undefined ? undefined : String(v).slice(0, len) || null);
  const lines = (v, max = 12, len = 200) => (v === undefined ? undefined
    : (typeof v === "string" ? v.split("\n") : Array.isArray(v) ? v : [])
      .map((x) => String(x).trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, len)));

  const data = {
    toolName: text(b.toolName, 120), websiteUrl: text(b.websiteUrl, 300),
    category: text(b.category, 60), pricing: text(b.pricing, 40),
    contactName: text(b.contactName, 120),
    pitch: text(b.pitch, 280), details: text(b.details, 2000),
    description: text(b.description, 400), targetAudience: text(b.targetAudience, 300),
    companyName: text(b.companyName, 160),
    features: lines(b.features), useCases: lines(b.useCases),
    socialLinks: lines(b.socialLinks, 6, 300), screenshots: lines(b.screenshots, 6, 500),
    ...(refId(b.logoUploadId) ? { logoUploadId: refId(b.logoUploadId) } : {}),
  };
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.toolSubmission.update({
      where: { id: s.id },
      data: {
        ...data,
        status: "pending",
        lastStatusChange: new Date(),
        resubmitCount: { increment: 1 },
        // The reviewer's ask has been answered; leaving it on screen would make
        // the next reviewer think it is still outstanding.
        submitterMessage: null,
      },
    });
    await tx.submissionEvent.create({
      data: {
        submissionId: s.id, type: "resubmitted", actor: "submitter",
        fromStatus: s.status, toStatus: "pending",
        detail: `Revision ${row.resubmitCount}`,
      },
    });
    return row;
  });

  // The desk needs to know it is back in the queue.
  sendAdminAlert({ ...updated, toolName: `${updated.toolName} (revision ${updated.resubmitCount})` });

  res.json({ ok: true, status: updated.status, resubmitCount: updated.resubmitCount });
}));

// GET /api/submissions — editor-only list, newest first
router.get("/", requireAdmin, ah(async (req, res) => {
  const items = await prisma.toolSubmission.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      logoUpload: { select: { id: true, mimeType: true, width: true, height: true } },
      emailEvents: { select: { eventType: true, status: true, sentAt: true } },
      _count: { select: { events: true } },
    },
  });
  const counts = items.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});
  res.json({ items, counts, total: items.length });
}));

// GET /api/submissions/:id — the full record plus its history, for the review panel
router.get("/:id", requireAdmin, ah(async (req, res, next) => {
  const submission = await prisma.toolSubmission.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      logoUpload: true,
      events: { orderBy: { createdAt: "desc" } },
      emailEvents: { orderBy: { sentAt: "desc" } },
    },
  });
  if (!submission) { const e = new Error("Submission not found"); e.status = 404; return next(e); }
  res.json({ submission });
}));

/**
 * PATCH /api/submissions/:id — move a submission through the workflow.
 *
 * The order here is the whole point. The status is written first and the email
 * is sent only after that write has committed, so a database failure can never
 * result in someone being told their tool is live when it is not. The audit row
 * goes in the same transaction as the status for the same reason.
 */
router.patch("/:id", requireAdmin, ah(async (req, res, next) => {
  const id = Number(req.params.id);
  const { status, reviewerNote, submitterMessage } = req.body || {};

  const current = await prisma.toolSubmission.findUnique({ where: { id } });
  if (!current) { const e = new Error("Submission not found"); e.status = 404; return next(e); }

  // A note on its own is a legitimate edit — an editor jotting something down
  // without moving the submission anywhere.
  if (!status || status === current.status) {
    if (reviewerNote === undefined && submitterMessage === undefined) {
      const e = new Error("Nothing to change."); e.status = 400; return next(e);
    }
    const updated = await prisma.toolSubmission.update({
      where: { id },
      data: {
        ...(reviewerNote !== undefined ? { reviewerNote: String(reviewerNote).slice(0, 4000) || null } : {}),
        ...(submitterMessage !== undefined ? { submitterMessage: String(submitterMessage).slice(0, 4000) || null } : {}),
      },
    });
    await prisma.submissionEvent.create({
      data: { submissionId: id, type: "note-added", toStatus: current.status, detail: "Reviewer notes updated." },
    });
    return res.json({ submission: updated, email: { skipped: "no status change" } });
  }

  if (!STATUSES.includes(status)) {
    const e = new Error(`Status must be one of: ${STATUSES.join(", ")}`); e.status = 400; return next(e);
  }
  if (!canMove(current.status, status)) {
    const e = new Error(refusal(current.status, status)); e.status = 409; return next(e);
  }
  // A message the submitter will actually read has to exist before we ask them
  // to act on it. An empty "changes requested" is a dead end for them.
  const message = submitterMessage === undefined ? current.submitterMessage : String(submitterMessage).trim();
  if ((status === "changes_requested" || status === "declined") && !message) {
    const e = new Error(status === "changes_requested"
      ? "Say what needs changing — the note is the whole message they receive."
      : "Give a reason. It goes to them verbatim, and a decision with no reason is worse than none.");
    e.status = 400; return next(e);
  }

  // Publishing has to produce the thing it claims to have produced. Before
  // this, it set a status and sent an email saying "view your listing" that
  // pointed at the homepage, because no listing was ever created — the exact
  // failure the commit-before-email rule exists to prevent, arriving by a
  // different door.
  //
  // A category is required and is not guessed. Filing a tool under the wrong
  // heading to avoid an error message is worse than refusing.
  let category = null;
  if (status === "published" && !current.publishedToolId) {
    const wanted = String(current.category || "").trim();
    if (wanted) {
      category = await prisma.category.findFirst({
        where: { OR: [{ name: { equals: wanted, mode: "insensitive" } }, { slug: slugify(wanted) }] },
      });
    }
    if (!category) {
      const e = new Error(wanted
        ? `No category called "${wanted}". Set the tool's category in the Tools desk first, or add that category.`
        : "This submission has no category, so there is nowhere to file it. Add one before publishing.");
      e.status = 400; return next(e);
    }
  }

  const stamp = stampFor(status);
  const now = new Date();

  const { updated, tool } = await prisma.$transaction(async (tx) => {
    let listing = null;

    if (status === "published" && !current.publishedToolId) {
      const base = slugify(current.toolName);
      // A slug collision means the tool is already in the index under that
      // name, so the submission is linked to it rather than a near-duplicate
      // being created alongside it.
      const clash = await tx.tool.findUnique({ where: { slug: base } });
      listing = clash || await tx.tool.create({
        data: {
          slug: base,
          name: current.toolName,
          description: (current.description || current.pitch || "").slice(0, 400),
          fullDescription: current.details || null,
          bestFor: current.targetAudience || null,
          websiteUrl: current.websiteUrl,
          logoMono: current.toolName.slice(0, 2),
          logoUrl: current.logoUploadId ? `/api/uploads/${current.logoUploadId}` : current.logoUrl || null,
          logoAlt: `${current.toolName} logo`,
          priceType: (current.pricing || "freemium").toLowerCase(),
          // Nothing is invented. No rating, no reviews, no score — a published
          // submission starts exactly where every other tool starts.
          priceMin: 0, priceMax: 0, rating: 0, reviewCount: 0, popularity: 0,
          isFeatured: false, isActive: true,
          categoryId: category.id,
        },
      });
    } else if (current.publishedToolId) {
      listing = await tx.tool.findUnique({ where: { id: current.publishedToolId } });
    }

    const row = await tx.toolSubmission.update({
      where: { id },
      data: {
        status,
        lastStatusChange: now,
        ...(stamp ? { [stamp]: now } : {}),
        ...(listing ? { publishedToolId: listing.id } : {}),
        ...(reviewerNote !== undefined ? { reviewerNote: String(reviewerNote).slice(0, 4000) || null } : {}),
        ...(submitterMessage !== undefined ? { submitterMessage: String(submitterMessage).slice(0, 4000) || null } : {}),
      },
    });
    await tx.submissionEvent.create({
      data: {
        submissionId: id, type: "status-changed",
        fromStatus: current.status, toStatus: status,
        detail: listing && status === "published"
          ? `Listed at /tools/${listing.slug}`
          : (message ? `Message to submitter: ${String(message).slice(0, 400)}` : null),
      },
    });
    return { updated: row, tool: listing };
  });

  // Committed — the status and, where relevant, the listing itself. Only now
  // is anybody told, and the link in the email points at something real.
  const email = await sendForStatus(updated, status, tool?.slug);

  res.json({ submission: updated, email, tool: tool ? { id: tool.id, slug: tool.slug } : null });
}));

// DELETE /api/submissions/:id — editor-only, for clearing spam/test rows
router.delete("/:id", requireAdmin, ah(async (req, res) => {
  await prisma.toolSubmission.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}));

export default router;
