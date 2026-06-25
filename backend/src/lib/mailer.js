import nodemailer from "nodemailer";

// Build a transporter from env once. If SMTP isn't configured we return null and
// the app keeps working — emails are just skipped (with a one-time warning),
// never blocking a request.
let cached;
let warned = false;

function getTransport() {
  if (cached !== undefined) return cached;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    cached = null;
    return null;
  }
  const port = Number(SMTP_PORT) || 587;
  cached = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cached;
}

// Fire-and-forget notification. Never throws into the caller — logs and moves on,
// so a mail outage can't take down the submission endpoint.
export async function sendMail({ to, subject, text, html, replyTo }) {
  const transport = getTransport();
  if (!transport) {
    if (!warned) {
      console.warn("[mailer] SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS) — skipping email.");
      warned = true;
    }
    return { skipped: true };
  }
  const recipient = to || process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  const from = process.env.MAIL_FROM || `Toolhaven <${process.env.SMTP_USER}>`;
  try {
    const info = await transport.sendMail({ from, to: recipient, subject, text, html, replyTo });
    return { ok: true, id: info.messageId };
  } catch (err) {
    console.error("[mailer] send failed:", err.message);
    return { ok: false, error: err.message };
  }
}
