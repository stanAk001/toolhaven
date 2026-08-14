import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { requireAdmin } from "../middleware/auth.js";
import { sendMail } from "../lib/mailer.js";

const router = Router();

const esc = (s) => String(s ?? "—").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

// Compose and send the "new submission" notification. Fire-and-forget.
function notify(s) {
  const rows = [
    ["Tool", s.toolName],
    ["Website", s.websiteUrl],
    ["Category", s.category],
    ["Pricing", s.pricing],
    ["Affiliate program", s.affiliateProgram],
    ["Pitch", s.pitch],
    ["Details", s.details],
    ["From", `${s.contactName} <${s.email}>`],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v ?? "—"}`).join("\n");
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">New tool submission</h2>
      <p style="color:#6A5F52;margin:0 0 16px">Someone submitted a tool to Toolhaven for review.</p>
      <table style="border-collapse:collapse;width:100%">
        ${rows.map(([k, v]) => `<tr>
          <td style="padding:6px 12px 6px 0;color:#6A5F52;vertical-align:top;white-space:nowrap"><strong>${esc(k)}</strong></td>
          <td style="padding:6px 0;border-bottom:1px solid #eee">${k === "Website" ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v)}</td>
        </tr>`).join("")}
      </table>
      <p style="color:#6A5F52;margin:16px 0 0;font-size:13px">Reply to this email to reach ${esc(s.contactName)} directly.</p>
    </div>`;
  sendMail({ subject: `New tool submission: ${s.toolName}`, text, html, replyTo: s.email });
}

// Confirmation back to the vendor so they know it landed.
function confirmToVendor(s) {
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">Thanks — we've got it ✦</h2>
      <p>Hi ${esc(s.contactName)}, thanks for submitting <strong>${esc(s.toolName)}</strong> to Toolhaven.</p>
      <p>We read every submission and try the promising ones properly. If it's a fit, we'll be in touch. We don't do pay-to-play, so the review will be genuinely honest — the strengths and the catch.</p>
      <p style="color:#6A5F52;font-size:13px;margin-top:16px">— The Toolhaven desk</p>
    </div>`;
  sendMail({
    to: s.email,
    subject: `Thanks for submitting ${s.toolName} to Toolhaven`,
    text: `Hi ${s.contactName}, thanks for submitting ${s.toolName} to Toolhaven. We read every submission and will be in touch if it's a fit. No pay-to-play — the review will be honest. — The Toolhaven desk`,
    html,
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
