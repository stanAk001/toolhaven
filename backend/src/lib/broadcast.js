/**
 * Writing to the people who have submitted a tool.
 *
 * Two things made this worth building rather than doing by hand. Promotion now
 * exists and every vendor already listed should be told once. And more
 * generally there was no way to tell vendors anything at all without opening a
 * mail client and pasting addresses, which is how people end up bcc'ing three
 * hundred strangers into one thread.
 *
 * The rules it enforces, because none of them survive being left to care:
 *
 *   One copy per person. A vendor who submitted four tools is one human with
 *   one inbox. Recipients are collapsed by address, not by submission.
 *
 *   One copy per message, ever. Each send is recorded against a key, and the
 *   database's unique constraint — not a check in this file — is what stops a
 *   second attempt going out. Clicking send twice is a thing people do.
 *
 *   Nothing is addressed to a crowd. Every message is a separate send, so no
 *   recipient ever sees another's address.
 *
 *   A failure is recorded and retryable. Only a success occupies the slot, so
 *   a run that dies halfway can be run again and picks up where it stopped.
 */
import { prisma } from "./prisma.js";
import { sendMail } from "./mailer.js";
import { shell, p, button, esc, COLOURS } from "./emailtemplate.js";

/** Who a message can go to. */
export const AUDIENCES = {
  all: {
    label: "Everyone who has submitted a tool",
    where: {},
  },
  published: {
    label: "Vendors with a tool live on the site",
    where: { status: "published", publishedToolId: { not: null } },
  },
  pending: {
    label: "Submissions still waiting on a decision",
    where: { status: { in: ["pending", "under_review"] } },
  },
};

const firstName = (full) => String(full || "").trim().split(/\s+/)[0] || "there";

/** A stable key for one message, so the same one cannot go out twice. */
export const broadcastKey = (raw) =>
  "broadcast:" + String(raw || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/**
 * The people a message would reach, one row per person.
 *
 * `alreadySent` is what makes a second send safe to offer: the screen can show
 * who has had this message before anyone presses anything.
 *
 * @param {object} o
 * @param {keyof AUDIENCES} o.audience
 * @param {string} [o.key]  when given, each row says whether it has had it
 */
export async function recipients({ audience = "all", key = null } = {}) {
  const spec = AUDIENCES[audience] || AUDIENCES.all;

  const rows = await prisma.toolSubmission.findMany({
    where: { ...spec.where, email: { not: "" } },
    select: { id: true, email: true, contactName: true, toolName: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Collapse to one person per address, keeping their most recent submission
  // as the row the send is recorded against.
  const byEmail = new Map();
  for (const r of rows) {
    const email = String(r.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    const seen = byEmail.get(email);
    if (seen) { seen.tools.push(r.toolName); continue; }
    byEmail.set(email, {
      email,
      name: r.contactName || "",
      submissionId: r.id,
      status: r.status,
      tools: [r.toolName],
    });
  }

  const people = [...byEmail.values()];
  if (!key) return people.map((x) => ({ ...x, alreadySent: false }));

  const sent = await prisma.emailEvent.findMany({
    where: { eventType: key, status: "sent" },
    select: { recipient: true },
  });
  const done = new Set(sent.map((s) => String(s.recipient || "").toLowerCase()));
  return people.map((x) => ({ ...x, alreadySent: done.has(x.email) }));
}

/**
 * Render one message. The reader's name is the only thing that varies.
 */
function compose({ subject, message, linkUrl, linkLabel, person }) {
  const paragraphs = String(message || "")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  const label = String(linkLabel || "").trim() || "Open";
  const hasLink = Boolean(String(linkUrl || "").trim());

  return {
    to: person.email,
    subject,
    text: [
      `Hi ${firstName(person.name)},`,
      "",
      ...paragraphs,
      ...(hasLink ? ["", `${label}: ${linkUrl}`] : []),
      "",
      "— The Toolhaven desk",
      `${COLOURS.SITE}`,
    ].join("\n"),
    html: shell({
      preheader: paragraphs[0]?.slice(0, 140) || subject,
      kicker: "From the desk",
      heading: subject,
      body: [
        p(`Hi ${esc(firstName(person.name))},`),
        ...paragraphs.map((t) => p(esc(t))),
        hasLink ? button(linkUrl, label) : "",
      ].join(""),
      footnote: "You're getting this because you submitted a tool to Toolhaven.",
    }),
  };
}

/**
 * Send a message to an audience.
 *
 * @param {object} o
 * @param {string} o.key        the message's identity; sending twice is refused per person
 * @param {string} o.subject
 * @param {string} o.message    plain text; blank lines separate paragraphs
 * @param {string} [o.linkUrl]  optional call to action
 * @param {string} [o.linkLabel]
 * @param {keyof AUDIENCES} [o.audience]
 * @param {boolean} [o.dryRun]  work out who would receive it and send nothing
 */
export async function sendBroadcast({
  key, subject, message, linkUrl = "", linkLabel = "", audience = "all", dryRun = false,
}) {
  if (!subject?.trim()) return { ok: false, reason: "A subject is required." };
  if (!message?.trim()) return { ok: false, reason: "The message is empty." };

  if (linkUrl) {
    let u;
    try { u = new URL(String(linkUrl)); } catch { return { ok: false, reason: "That link isn't a valid URL." }; }
    if (!/^https?:$/.test(u.protocol)) return { ok: false, reason: "The link must be an http or https address." };
  }

  const people = await recipients({ audience, key });
  const pending = people.filter((x) => !x.alreadySent);

  if (dryRun) {
    return {
      ok: true, dryRun: true,
      total: people.length, wouldSend: pending.length,
      alreadySent: people.length - pending.length,
      sample: pending.slice(0, 5).map((x) => x.email),
    };
  }

  let sent = 0;
  const failed = [];
  for (const person of pending) {
    // Claim the slot first. If the insert loses a race, another run is already
    // sending to this person and this one stands down.
    let claim;
    try {
      claim = await prisma.emailEvent.create({
        data: { submissionId: person.submissionId, eventType: key, recipient: person.email, status: "sent" },
      });
    } catch {
      continue;
    }

    try {
      const result = await sendMail(compose({ subject, message, linkUrl, linkLabel, person }));
      if (result?.messageId) {
        await prisma.emailEvent.update({ where: { id: claim.id }, data: { messageId: result.messageId } });
      }
      sent++;
    } catch (err) {
      // Release the slot so the run can be repeated for this person.
      await prisma.emailEvent.update({
        where: { id: claim.id },
        data: { status: "failed", error: String(err?.message || err).slice(0, 300) },
      }).catch(() => {});
      failed.push({ email: person.email, error: String(err?.message || err).slice(0, 140) });
    }

    // Gentle on the mailbox. Gmail's own limits are the binding constraint,
    // and a burst is also what makes a sender look like a spammer.
    await new Promise((r) => setTimeout(r, 400));
  }

  return { ok: true, sent, failed, attempted: pending.length, skipped: people.length - pending.length };
}
