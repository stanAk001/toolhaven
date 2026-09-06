/**
 * The six emails a submission can trigger, and the guard that stops any of them
 * being sent twice.
 *
 * Every send goes through `once()`, which writes an EmailEvent row inside a
 * unique constraint on (submission, event, "sent"). A double-clicked Approve
 * button, a retried request or a redeploy mid-flight therefore cannot mail the
 * same person the same thing again — the second attempt loses the race for the
 * row and returns without sending. Failures are recorded separately and do not
 * occupy the slot, so a genuine retry still works.
 *
 * These are notifications, not marketing: no tracking pixel, no unsubscribe
 * dance for mail somebody asked for by submitting a form, and the reviewer's
 * own words passed through verbatim rather than paraphrased.
 */
import { prisma } from "./prisma.js";
import { sendMail } from "./mailer.js";
import { shell, p, facts, button, esc, COLOURS } from "./emailtemplate.js";

/** How each state is described to the person waiting on it. */
const STATE = {
  pending: { label: "Pending review", tone: COLOURS.INK_2 },
  under_review: { label: "Under review", tone: COLOURS.ACCENT },
  approved: { label: "Approved", tone: "#2F6F45" },
  published: { label: "Live", tone: "#2F6F45" },
  changes_requested: { label: "Changes needed", tone: COLOURS.ACCENT },
  declined: { label: "Not accepted", tone: COLOURS.INK_2 },
};

/** A status chip, built as a table so Outlook renders the fill. */
function chip(status) {
  const s = STATE[status] || STATE.pending;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
    <tr><td style="border:1px solid ${s.tone};border-radius:4px;padding:6px 12px;">
      <span style="font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:700;
        letter-spacing:.14em;text-transform:uppercase;color:${s.tone};">${esc(s.label)}</span>
    </td></tr></table>`;
}

const firstName = (full) => String(full || "").trim().split(/\s+/)[0] || "there";
const statusLink = (s) => `${COLOURS.SITE}/submission/${s.publicToken}`;

/**
 * Send `build()` once per submission per event.
 *
 * Claims the slot first and sends second: if the insert loses to a concurrent
 * one it means another request is already sending, and this one stands down.
 */
async function once(submission, eventType, build) {
  const existing = await prisma.emailEvent.findFirst({
    where: { submissionId: submission.id, eventType, status: "sent" },
  });
  if (existing) return { skipped: "already sent", at: existing.sentAt };

  let claim;
  try {
    claim = await prisma.emailEvent.create({
      data: { submissionId: submission.id, eventType, recipient: submission.email, status: "sent" },
    });
  } catch {
    // Unique constraint: another request got there first.
    return { skipped: "already in flight" };
  }

  const result = await sendMail(build());
  if (result?.ok) {
    await prisma.emailEvent.update({ where: { id: claim.id }, data: { messageId: result.id || null } });
    return { ok: true };
  }

  // No provider configured is not a failure to record — nothing was attempted,
  // and leaving a "failed" row behind would make an unconfigured environment
  // look like a broken one. Drop the claim so a real send can still happen.
  if (result?.skipped) {
    await prisma.emailEvent.delete({ where: { id: claim.id } }).catch(() => {});
    return { skipped: "no mail provider configured" };
  }

  // A genuine failure keeps its record and frees the slot, so a retry works.
  await prisma.emailEvent.update({
    where: { id: claim.id },
    data: { status: "failed", error: String(result?.error || "unknown").slice(0, 300) },
  });
  return { ok: false, error: result?.error };
}

/* ── 1. Received ─────────────────────────────────────────────────────────── */

export function sendSubmissionReceived(s) {
  return once(s, "received", () => ({
    to: s.email,
    subject: `We've received your Toolhaven submission`,
    text: [
      `Hi ${firstName(s.contactName)},`, "",
      `Thanks for submitting ${s.toolName} to Toolhaven. It's in the review queue.`,
      "", `Status: Pending review`,
      "", `Track it here: ${statusLink(s)}`,
      "", "— The Toolhaven desk",
    ].join("\n"),
    html: shell({
      preheader: `${s.toolName} is in the Toolhaven review queue.`,
      kicker: "Submission received",
      heading: "Thanks — we've got it",
      body: [
        p(`Hi ${esc(firstName(s.contactName))} — thanks for sending <strong>${esc(s.toolName)}</strong> over.`),
        chip("pending"),
        p("A person reads every submission. If it looks like a fit for the index we'll try it properly, and you'll hear from us at every step from here."),
        p("We don't take payment for a listing, a ranking, or a good word, so if it does get reviewed the write-up will be an honest one: what it's good at, and the catch."),
        button(statusLink(s), "Track your submission"),
        p("That link is yours — it stays current as the status changes, so there's nothing to log into.", true),
      ].join(""),
      footnote: "The Toolhaven desk &middot; no pay-to-play, ever",
    }),
  }));
}

/* ── 2. Under review ─────────────────────────────────────────────────────── */

export function sendUnderReview(s) {
  return once(s, "under-review", () => ({
    to: s.email,
    subject: `Your Toolhaven submission is now under review`,
    text: [
      `Hi ${firstName(s.contactName)},`, "",
      `We've started reviewing ${s.toolName}.`,
      "", "Status: Under review",
      "", `Track it here: ${statusLink(s)}`,
      "", "— The Toolhaven desk",
    ].join("\n"),
    html: shell({
      preheader: `We've started looking at ${s.toolName}.`,
      kicker: "Status update",
      heading: "We've started reviewing it",
      body: [
        p(`Hi ${esc(firstName(s.contactName))} — <strong>${esc(s.toolName)}</strong> is with a reviewer now.`),
        chip("under_review"),
        p("That means someone is actually using it rather than reading the marketing page, so this part takes a little while. We'll write again when there's a decision."),
        button(statusLink(s), "Track your submission"),
      ].join(""),
      footnote: "The Toolhaven desk",
    }),
  }));
}

/* ── 3. Approved ─────────────────────────────────────────────────────────── */

export function sendApproved(s) {
  return once(s, "approved", () => ({
    to: s.email,
    subject: `Your tool has been approved on Toolhaven`,
    text: [
      `Hi ${firstName(s.contactName)},`, "",
      `Good news — ${s.toolName} has been approved for listing on Toolhaven.`,
      "", "It'll appear on the site once the entry is written up. We'll email you when it goes live.",
      "", `Track it here: ${statusLink(s)}`,
      "", "— The Toolhaven desk",
    ].join("\n"),
    html: shell({
      preheader: `${s.toolName} has been approved for Toolhaven.`,
      kicker: "Decision",
      heading: "Approved",
      body: [
        p(`Good news, ${esc(firstName(s.contactName))} — <strong>${esc(s.toolName)}</strong> has been approved for the index.`),
        chip("approved"),
        p("Approved isn't live yet. The entry still has to be written — the honest rundown, the strengths and the catch — and we'll email you the moment it's published."),
        button(statusLink(s), "Track your submission"),
      ].join(""),
      footnote: "The Toolhaven desk",
    }),
  }));
}

/* ── 4. Published ────────────────────────────────────────────────────────── */

export function sendPublished(s, toolSlug) {
  const live = toolSlug ? `${COLOURS.SITE}/tools/${toolSlug}` : COLOURS.SITE;
  return once(s, "published", () => ({
    to: s.email,
    subject: `${s.toolName} is now live on Toolhaven`,
    text: [
      `Hi ${firstName(s.contactName)},`, "",
      `${s.toolName} is now live on Toolhaven.`,
      "", `View the listing: ${live}`,
      "", "If anything about the product changes — pricing, positioning, a feature we got wrong — tell us and we'll update it.",
      "", "— The Toolhaven desk",
    ].join("\n"),
    html: shell({
      preheader: `${s.toolName} is live on Toolhaven.`,
      kicker: "Published",
      heading: `${s.toolName} is live`,
      body: [
        p(`Hi ${esc(firstName(s.contactName))} — <strong>${esc(s.toolName)}</strong> is on the site.`),
        chip("published"),
        button(live, "View the listing"),
        p("The write-up names a catch, as every entry on Toolhaven does. That isn't a criticism of the product — a listing with nothing but praise is one nobody believes."),
        p("If anything changes — pricing, positioning, or something we got wrong — reply to this and we'll update it.", true),
      ].join(""),
      footnote: "The Toolhaven desk",
    }),
  }));
}

/* ── 5. Changes requested ────────────────────────────────────────────────── */

export function sendChangesRequested(s) {
  const note = String(s.submitterMessage || "").trim();
  return once(s, "changes-requested", () => ({
    to: s.email,
    subject: `Action needed: update your Toolhaven submission`,
    text: [
      `Hi ${firstName(s.contactName)},`, "",
      `We've looked at ${s.toolName} and need a few things changed before it can be approved.`,
      "", "Reviewer note:", note || "(none given)",
      "", `Update it here: ${statusLink(s)}`,
      "", "— The Toolhaven desk",
    ].join("\n"),
    html: shell({
      preheader: `A few changes needed before ${s.toolName} can be approved.`,
      kicker: "Action needed",
      heading: "A few changes first",
      body: [
        p(`Hi ${esc(firstName(s.contactName))} — we've read through <strong>${esc(s.toolName)}</strong> and there are a couple of things to sort out before it can go in.`),
        chip("changes_requested"),
        // The reviewer's own words, escaped and set apart so it is obvious
        // which part is a person talking and which is the system.
        note ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
          <tr><td style="border-left:3px solid ${COLOURS.ACCENT};padding:2px 0 2px 16px;">
            <p style="margin:0 0 6px;font-family:'Courier New',Courier,monospace;font-size:11px;
              letter-spacing:.14em;text-transform:uppercase;color:${COLOURS.INK_2};">From the reviewer</p>
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
              font-size:15px;line-height:1.6;color:${COLOURS.INK};white-space:pre-line;">${esc(note)}</p>
          </td></tr></table>` : "",
        button(statusLink(s), "Update your submission"),
        p("Your original submission is still there — updating it puts it back in the queue rather than starting again.", true),
      ].join(""),
      footnote: "The Toolhaven desk",
    }),
  }));
}

/* ── 6. Declined ─────────────────────────────────────────────────────────── */

export function sendDeclined(s) {
  const note = String(s.submitterMessage || "").trim();
  return once(s, "declined", () => ({
    to: s.email,
    subject: `Update regarding your Toolhaven submission`,
    text: [
      `Hi ${firstName(s.contactName)},`, "",
      `Thanks for submitting ${s.toolName} to Toolhaven.`,
      "", "After reviewing it we aren't able to list the tool at this time.",
      ...(note ? ["", "Reason:", note] : []),
      "", "We appreciate you taking the time, and this isn't a judgement on the product — it usually means it sits outside what we cover.",
      "", "— The Toolhaven desk",
    ].join("\n"),
    html: shell({
      preheader: `A decision on your ${s.toolName} submission.`,
      kicker: "Decision",
      heading: "Not this time",
      body: [
        p(`Hi ${esc(firstName(s.contactName))} — thanks for sending <strong>${esc(s.toolName)}</strong> to us.`),
        chip("declined"),
        p("After reviewing it we aren't able to list it at the moment."),
        note ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
          <tr><td style="border-left:3px solid ${COLOURS.INK_2};padding:2px 0 2px 16px;">
            <p style="margin:0 0 6px;font-family:'Courier New',Courier,monospace;font-size:11px;
              letter-spacing:.14em;text-transform:uppercase;color:${COLOURS.INK_2};">Why</p>
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
              font-size:15px;line-height:1.6;color:${COLOURS.INK};white-space:pre-line;">${esc(note)}</p>
          </td></tr></table>` : "",
        p("More often than not this means the tool sits outside what Toolhaven covers rather than anything being wrong with it. If that changes, or if we've misread what it does, reply and tell us.", true),
      ].join(""),
      footnote: "The Toolhaven desk",
    }),
  }));
}

/* ── The desk's own alert ────────────────────────────────────────────────── */

export function sendAdminAlert(s) {
  const rows = [
    ["Tool", s.toolName],
    ["Website", s.websiteUrl, s.websiteUrl],
    ["Category", s.category],
    ["Pricing", s.pricing],
    ["Affiliate", s.affiliateProgram],
    ["From", `${s.contactName} <${s.email}>`, `mailto:${s.email}`],
  ];
  return sendMail({
    subject: `New submission: ${s.toolName}`,
    replyTo: s.email,
    text: rows.map(([k, v]) => `${k}: ${v ?? "—"}`).join("\n")
      + (s.pitch ? `\n\nPitch: ${s.pitch}` : "")
      + `\n\nQueue: ${COLOURS.SITE}/admin`,
    html: shell({
      preheader: `${s.contactName} submitted ${s.toolName}${s.category ? ` — ${s.category}` : ""}`,
      kicker: "Editor's desk",
      heading: "A new tool has come in",
      body: [
        p(`<strong>${esc(s.contactName)}</strong> submitted <strong>${esc(s.toolName)}</strong> for review.`),
        facts(rows),
        s.pitch ? p(`<em>&ldquo;${esc(s.pitch)}&rdquo;</em>`) : "",
        s.details ? p(esc(s.details), true) : "",
        button(`${COLOURS.SITE}/admin`, "Open the queue"),
      ].join(""),
      footnote: "Reply to this message and it goes straight to them.",
    }),
  });
}

/** Dispatch the right message for a transition. Unknown states send nothing. */
export function sendForStatus(submission, status, toolSlug) {
  switch (status) {
    case "under_review": return sendUnderReview(submission);
    case "approved": return sendApproved(submission);
    case "published": return sendPublished(submission, toolSlug);
    case "changes_requested": return sendChangesRequested(submission);
    case "declined": return sendDeclined(submission);
    default: return Promise.resolve({ skipped: `no email for "${status}"` });
  }
}
