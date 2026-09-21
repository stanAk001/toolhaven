/**
 * The campaign emails.
 *
 * Built on the same kit as the submission emails — `shell`, `p`, `facts`,
 * `button` — so a promotion email looks like it came from the same publication
 * as the "your tool is live" one, because it did.
 *
 * Every send is wrapped in `once()`, which claims a row before composing. A
 * double-clicked approve button, a retried webhook or a scheduler running twice
 * therefore sends one email, not two. That guard is copied deliberately from
 * submissionmail.js rather than reinvented.
 *
 * Nothing here quotes a figure that is not counted from real events, and no
 * email predicts a result.
 */
import { prisma } from "../prisma.js";
import { sendMail } from "../mailer.js";
import { shell, p, facts, button, esc } from "../emailtemplate.js";
import { formatMinor } from "./money.js";

const SITE = () => (process.env.SITE_URL || "https://www.toolhaven.net").replace(/\/+$/, "");
const dash = (slug) => `${SITE()}/promote/dashboard${slug ? `?campaign=${encodeURIComponent(slug)}` : ""}`;
const when = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

/**
 * Send once, ever, per campaign per event.
 *
 * The EmailEvent row is written first and inside a transaction. If two
 * requests arrive together the unique constraint means one of them loses the
 * race and simply returns — the vendor's inbox is not where retry logic should
 * become visible.
 */
async function once(campaign, eventType, build) {
  // The same three columns the submission emails use. `status` here is the
  // *email's* outcome, not the campaign's — the unique key is
  // (submissionId, eventType, status), so keying it on the campaign status
  // would let the same message send again every time the campaign moved.
  const key = {
    submissionId: campaign.submissionId,
    eventType: `promo:${eventType}`,
    status: "sent",
  };
  try {
    await prisma.emailEvent.create({ data: { ...key, recipient: campaign.ownerEmail } });
  } catch {
    // Unique constraint: this message has already gone, or is in flight.
    return { sent: false, reason: "already sent" };
  }

  const mail = build();
  try {
    await sendMail({ to: campaign.ownerEmail, subject: mail.subject, html: mail.html, text: mail.text });
    return { sent: true };
  } catch (err) {
    // Release the claim so a later attempt can try again, and leave a failed
    // row behind so a silent non-delivery is still visible.
    await prisma.emailEvent.deleteMany({ where: key }).catch(() => {});
    await prisma.emailEvent.create({
      data: { ...key, status: "failed", recipient: campaign.ownerEmail, error: String(err.message).slice(0, 300) },
    }).catch(() => {});
    return { sent: false, reason: err.message };
  }
}

const toolName = (c) => esc(c.tool?.name || c.headline || "your tool");
const planName = (c) => esc(c.plan?.name || "Promotion");

const priceLine = (payment) =>
  (payment && Number.isInteger(payment.amountMinor)
    ? formatMinor(payment.amountMinor, payment.currency)
    : null);

/* ─────────────────────────────── vendor ─────────────────────────────── */

export function sendPaymentReceived(campaign, payment) {
  return once(campaign, "payment-received", () => ({
    subject: `Payment received for ${campaign.tool?.name || "your campaign"}`,
    text: `We've received your payment. Your campaign is now waiting for review.`,
    html: shell({
      preheader: "Payment received — your campaign is queued for review.",
      kicker: "Toolhaven Promote",
      heading: "Payment received",
      body:
        p(`Thanks — we've received your payment for <strong>${toolName(campaign)}</strong>.`)
        + facts([
          ["Campaign", planName(campaign)],
          ["Amount", esc(priceLine(payment) || "—")],
          ["Reference", esc(payment?.reference || "—")],
        ])
        + p("An editor reviews every campaign before it goes live. We'll email you as soon as that's done — usually within a working day.", true)
        + button(dash(campaign.slug), "View your campaign"),
      footnote: "Review is about the campaign copy and placement only. It never changes your tool's Toolhaven score, rating or position in organic results.",
    }),
  }));
}

export function sendSubmitted(campaign) {
  return once(campaign, "submitted", () => ({
    subject: `Your campaign for ${campaign.tool?.name || "your tool"} is with us`,
    text: "Your campaign has been submitted for review.",
    html: shell({
      preheader: "We have your campaign and it's queued for review.",
      kicker: "Toolhaven Promote",
      heading: "Campaign submitted",
      body:
        p(`Your campaign for <strong>${toolName(campaign)}</strong> is queued for review.`)
        + facts([
          ["Campaign", planName(campaign)],
          ["Requested start", esc(when(campaign.startDate))],
        ])
        + button(dash(campaign.slug), "View your campaign"),
    }),
  }));
}

export function sendApproved(campaign) {
  return once(campaign, "approved", () => ({
    subject: `Your Toolhaven promotion is approved`,
    text: "Your campaign has been approved and is scheduled.",
    html: shell({
      preheader: "Approved — here's when it runs.",
      kicker: "Toolhaven Promote",
      heading: "Campaign approved",
      body:
        p(`Your campaign for <strong>${toolName(campaign)}</strong> has been approved.`)
        + facts([
          ["Campaign", planName(campaign)],
          ["Starts", esc(when(campaign.startDate))],
          ["Ends", esc(when(campaign.endDate))],
        ])
        + p("You'll get another note the day it goes live.", true)
        + button(dash(campaign.slug), "View your campaign"),
    }),
  }));
}

export function sendLive(campaign) {
  return once(campaign, "live", () => ({
    subject: "Your Toolhaven promotion is live",
    text: "Your promotion is now live.",
    html: shell({
      preheader: "It's live — you can watch the numbers from your dashboard.",
      kicker: "Toolhaven Promote",
      heading: "Your promotion is live",
      body:
        p(`Your promotion for <strong>${toolName(campaign)}</strong> is now live.`)
        + facts([
          ["Campaign", planName(campaign)],
          ["Running until", esc(when(campaign.endDate))],
        ])
        + p("You can monitor impressions, page views and outbound clicks from your dashboard as they're recorded.", true)
        + button(dash(campaign.slug), "View campaign performance"),
    }),
  }));
}

export function sendChangesRequested(campaign) {
  return once(campaign, "changes-requested", () => ({
    subject: "A change is needed on your Toolhaven campaign",
    text: campaign.reviewNote || "We've asked for a change to your campaign.",
    html: shell({
      preheader: "One change and we can get this running.",
      kicker: "Toolhaven Promote",
      heading: "A change is needed",
      body:
        p(`Before your campaign for <strong>${toolName(campaign)}</strong> can run, we need one thing changed:`)
        + p(`<em>${esc(campaign.reviewNote || "")}</em>`)
        + p("Your payment is unaffected and your slot is held while you make the change.", true)
        + button(dash(campaign.slug), "Edit your campaign"),
    }),
  }));
}

export function sendRejected(campaign) {
  return once(campaign, "rejected", () => ({
    subject: "About your Toolhaven campaign",
    text: campaign.reviewNote || "We're not able to run this campaign.",
    html: shell({
      preheader: "We can't run this one — here's why, and what happens to your payment.",
      kicker: "Toolhaven Promote",
      heading: "We can't run this campaign",
      body:
        p(`We're not able to run the campaign for <strong>${toolName(campaign)}</strong>.`)
        + p(`<em>${esc(campaign.reviewNote || "")}</em>`)
        + p("Your payment will be refunded. We'll email you again when the refund is confirmed by the payment provider — not before.", true)
        + button(dash(campaign.slug), "View your campaign"),
      footnote: "Your tool's listing, score and rating are unaffected. Declining a campaign is a decision about promotional copy, not about your product.",
    }),
  }));
}

export function sendEndingSoon(campaign, daysLeft) {
  return once(campaign, `ending-${daysLeft}`, () => ({
    subject: `Your Toolhaven promotion ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    text: `Your campaign ends on ${when(campaign.endDate)}.`,
    html: shell({
      preheader: "A heads-up before it finishes.",
      kicker: "Toolhaven Promote",
      heading: `Ending in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      body:
        p(`Your promotion for <strong>${toolName(campaign)}</strong> ends on <strong>${esc(when(campaign.endDate))}</strong>.`)
        + p("Your full report will be available from your dashboard when it finishes.", true)
        + button(dash(campaign.slug), "View campaign performance"),
    }),
  }));
}

export function sendCompleted(campaign, stats) {
  const rows = [
    ["Campaign", planName(campaign)],
    ["Ran", `${esc(when(campaign.startDate))} – ${esc(when(campaign.endDate))}`],
    ["Impressions", String(stats?.impressions ?? 0)],
    ["Tool page views", String(stats?.toolPageViews ?? 0)],
    ["Website clicks", String(stats?.websiteClicks ?? 0)],
  ];
  if (stats?.ctr !== null && stats?.ctr !== undefined) rows.push(["Click-through rate", `${stats.ctr}%`]);

  return once(campaign, "completed", () => ({
    subject: "Your Toolhaven campaign report",
    text: "Your campaign has finished. Your report is ready.",
    html: shell({
      preheader: "Your campaign has finished — here are the numbers.",
      kicker: "Toolhaven Promote",
      heading: "Campaign complete",
      body:
        p(`Your promotion for <strong>${toolName(campaign)}</strong> has finished. Here's what Toolhaven recorded:`)
        + facts(rows)
        + p("These metrics represent activity recorded by Toolhaven and do not necessarily represent conversions on your website.", true)
        + button(dash(campaign.slug), "View the full report"),
    }),
  }));
}

export function sendRefunded(campaign, payment) {
  return once(campaign, "refunded", () => ({
    subject: "Your Toolhaven refund is confirmed",
    text: "Your refund has been confirmed by the payment provider.",
    html: shell({
      preheader: "The provider has confirmed your refund.",
      kicker: "Toolhaven Promote",
      heading: "Refund confirmed",
      body:
        p(`Your payment for <strong>${toolName(campaign)}</strong> has been refunded.`)
        + facts([
          ["Amount", esc(priceLine(payment) || "—")],
          ["Reference", esc(payment?.reference || "—")],
        ])
        + p("Depending on your bank it can take a few working days to appear.", true),
    }),
  }));
}

/* ─────────────────────────────── editor ─────────────────────────────── */

/** Tell the desk a campaign is waiting. Not deduplicated — it is a work queue. */
export async function notifyEditorPending(campaign) {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) return { sent: false, reason: "NOTIFY_EMAIL not set" };
  try {
    await sendMail({
      to,
      subject: `Campaign to review: ${campaign.tool?.name || campaign.slug}`,
      text: `A paid campaign is waiting for review: ${SITE()}/admin`,
      html: shell({
        kicker: "Toolhaven Promote",
        heading: "A campaign is waiting for review",
        body:
          facts([
            ["Tool", toolName(campaign)],
            ["Plan", planName(campaign)],
            ["Owner", esc(campaign.ownerEmail)],
            ["Requested start", esc(when(campaign.startDate))],
          ])
          + button(`${SITE()}/admin`, "Open the desk"),
      }),
    });
    return { sent: true };
  } catch (err) { return { sent: false, reason: err.message }; }
}
