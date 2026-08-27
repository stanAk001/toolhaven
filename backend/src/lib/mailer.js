/**
 * Sending mail, with a provider you can change without touching this file.
 *
 * Two transports, chosen by which environment variables are present:
 *
 *   RESEND_API_KEY   → Resend's HTTP API, over plain fetch. No dependency, and
 *                      HTTP survives the outbound-SMTP blocking that some hosts
 *                      apply. Preferred when set.
 *   SMTP_*           → any SMTP provider via nodemailer. Resend, Brevo,
 *                      Postmark and SendGrid all offer an SMTP endpoint, so
 *                      moving between them is four environment variables.
 *
 * Neither configured means mail is skipped with one warning, never an exception
 * — a mail outage must not take a submission down with it.
 *
 * Why this stopped being "just Gmail": sending from a personal Gmail account
 * means the From domain is gmail.com rather than toolhaven.net, so nothing is
 * DKIM-aligned with the brand and vendor confirmations risk the spam folder.
 * Gmail also caps at roughly 500 sends a day, and — the reason this came up at
 * all — it suppresses the inbox copy of anything you send to your own address,
 * which is why submission alerts appeared to vanish.
 */
import nodemailer from "nodemailer";

let cachedSmtp;
let warned = false;

function smtpTransport() {
  if (cachedSmtp !== undefined) return cachedSmtp;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) { cachedSmtp = null; return null; }
  const port = Number(SMTP_PORT) || 587;
  cachedSmtp = nodemailer.createTransport({
    host: SMTP_HOST, port,
    secure: port === 465,            // 465 = implicit TLS, 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cachedSmtp;
}

/** Which transport is live, for the health endpoint and the boot log. */
export function mailProvider() {
  if (process.env.RESEND_API_KEY) return "resend";
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) return `smtp:${SMTP_HOST}`;
  return null;
}

async function viaResend({ from, to, subject, text, html, replyTo }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from, to: [to], subject, text, html,
      ...(replyTo ? { reply_to: [replyTo] } : {}),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `Resend returned ${res.status}`);
  return body?.id;
}

/**
 * Send one message. Never throws into the caller.
 *
 * @param {object} o  { to, subject, text, html, replyTo }
 * @returns {Promise<{ok?:boolean, skipped?:boolean, id?:string, error?:string}>}
 */
export async function sendMail({ to, subject, text, html, replyTo }) {
  const provider = mailProvider();
  if (!provider) {
    if (!warned) {
      console.warn("[mailer] no provider configured (RESEND_API_KEY or SMTP_*) — skipping email.");
      warned = true;
    }
    return { skipped: true };
  }

  const recipient = to || process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  if (!recipient) {
    console.warn("[mailer] no recipient and no NOTIFY_EMAIL set — skipping email.");
    return { skipped: true };
  }
  const from = process.env.MAIL_FROM || `Toolhaven <${process.env.SMTP_USER}>`;

  try {
    const id = provider === "resend"
      ? await viaResend({ from, to: recipient, subject, text, html, replyTo })
      : (await smtpTransport().sendMail({ from, to: recipient, subject, text, html, replyTo })).messageId;

    // Logged on success as well as failure: "did the alert actually go out" was
    // unanswerable before, which is exactly how a silent delivery problem
    // survives for weeks.
    console.log(`[mailer] sent "${subject}" to ${recipient} via ${provider}`);
    return { ok: true, id };
  } catch (err) {
    console.error(`[mailer] FAILED "${subject}" to ${recipient} via ${provider}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}
