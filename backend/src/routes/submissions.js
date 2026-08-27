import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";
import { sendMail } from "../lib/mailer.js";
import { shell, p, facts, button, esc, COLOURS } from "../lib/emailtemplate.js";

const router = Router();

/**
 * The alert to the desk.
 *
 * Written to be actionable from the notification alone: everything needed to
 * judge the submission is in the mail, with a link straight to the queue and a
 * Reply-To pointing at the person, so answering does not mean opening the admin
 * first. That was the whole complaint — the site knew about a submission long
 * before its editor did.
 */
function notify(s) {
  const rows = [
    ["Tool", s.toolName],
    ["Website", s.websiteUrl, s.websiteUrl],
    ["Category", s.category],
    ["Pricing", s.pricing],
    ["Affiliate", s.affiliateProgram],
    ["From", `${s.contactName} <${s.email}>`, `mailto:${s.email}`],
  ];
  const body = [
    p(`<strong>${esc(s.contactName)}</strong> submitted <strong>${esc(s.toolName)}</strong> for review.`),
    facts(rows),
    s.pitch ? p(`<em>&ldquo;${esc(s.pitch)}&rdquo;</em>`) : "",
    s.details ? p(esc(s.details), true) : "",
    button(`${COLOURS.SITE}/admin`, "Open the queue"),
  ].join("");

  const text = rows.map(([k, v]) => `${k}: ${v ?? "—"}`).join("\n")
    + (s.pitch ? `\n\nPitch: ${s.pitch}` : "")
    + (s.details ? `\n\nDetails: ${s.details}` : "")
    + `\n\nQueue: ${COLOURS.SITE}/admin`;

  return sendMail({
    subject: `New submission: ${s.toolName}`,
    text,
    html: shell({
      preheader: `${s.contactName} submitted ${s.toolName}${s.category ? ` — ${s.category}` : ""}`,
      kicker: "Editor's desk",
      heading: "A new tool has come in",
      body,
      footnote: "Reply to this message and it goes straight to them.",
    }),
    replyTo: s.email,
  });
}

/**
 * The receipt to whoever submitted.
 *
 * For most people this is their only contact with Toolhaven, so it does the
 * work a receipt should: confirms what was received, says plainly what happens
 * next, and states the no-pay-to-play position — which is the thing that makes
 * a listing here worth having and the thing they are most likely to doubt.
 */
function confirmToVendor(s) {
  const body = [
    p(`Hi ${esc(s.contactName)} — thanks for sending <strong>${esc(s.toolName)}</strong> over.`),
    p("Here's what happens now. A person reads every submission. If it looks like a fit for the index we'll try it properly, and if we write it up you'll hear from us before it goes live."),
    p(`We don't take payment for a listing, a ranking, or a good word, so if ${esc(s.toolName)} does get reviewed the write-up will be an honest one: what it's genuinely good at, and the catch. Every tool on the site has both.`),
    p("If you don't hear back, it means it wasn't the right fit for what we cover — no reflection on the product.", true),
    button(`${COLOURS.SITE}/how-we-review`, "How we review"),
  ].join("");

  return sendMail({
    to: s.email,
    subject: `We've got ${s.toolName} — Toolhaven`,
    text: [
      `Hi ${s.contactName} — thanks for sending ${s.toolName} over.`,
      "",
      "A person reads every submission. If it looks like a fit we'll try it properly, and if we write it up you'll hear from us before it goes live.",
      "",
      `We don't take payment for a listing, a ranking, or a good word, so if ${s.toolName} does get reviewed the write-up will be an honest one: what it's good at, and the catch.`,
      "",
      `How we review: ${COLOURS.SITE}/how-we-review`,
      "",
      "— The Toolhaven desk",
    ].join("\n"),
    html: shell({
      preheader: `Your submission of ${s.toolName} reached the Toolhaven desk.`,
      kicker: "Submission received",
      heading: "Thanks — we've got it",
      body,
      footnote: "The Toolhaven desk &middot; no pay-to-play, ever",
    }),
  });
}

const STATUSES = ["pending", "reviewing", "listed", "declined"];

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

  const submission = await prisma.toolSubmission.create({
    data: {
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

  // emails — non-blocking, never fail the request
  notify(submission);        // alert the editor
  confirmToVendor(submission); // reassure the vendor

  res.status(201).json({ ok: true, id: submission.id });
}));

// GET /api/submissions — editor-only list, newest first
router.get("/", requireAdmin, ah(async (req, res) => {
  const items = await prisma.toolSubmission.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ items });
}));

// PATCH /api/submissions/:id — editor-only status update
router.patch("/:id", requireAdmin, ah(async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${STATUSES.join(", ")}` });
  }
  const updated = await prisma.toolSubmission.update({
    where: { id: Number(req.params.id) },
    data: { status },
  });
  res.json(updated);
}));

// DELETE /api/submissions/:id — editor-only, for clearing spam/test rows
router.delete("/:id", requireAdmin, ah(async (req, res) => {
  await prisma.toolSubmission.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}));

export default router;
