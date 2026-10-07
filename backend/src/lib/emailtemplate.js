/**
 * The house style for everything Toolhaven sends.
 *
 * Email is not the web. Three constraints shape every decision here:
 *
 *  - Outlook renders through Word. No flexbox, no grid, no `<style>` block that
 *    can be relied on. Layout is tables and every rule is inline. This is the
 *    one place where 2004 markup is the correct answer rather than a relic.
 *  - Remote images are blocked by default in most clients until the reader asks
 *    for them. So the mark is an enhancement and the typographic masthead is
 *    what actually carries the brand — which suits Toolhaven, whose identity was
 *    always the type rather than a symbol.
 *  - SVG does not render at all in Gmail, Outlook or Apple Mail, so the mark is
 *    a PNG rendered from the site's own favicon.
 *
 * Every message also ships a plain-text alternative. It is what a screen reader
 * and a spam filter read first, and a message without one scores worse.
 *
 * On the palette: this used to be cream paper, a terracotta accent and Georgia
 * — the site's first identity. The site has since moved to near-white, ink and
 * a deep blue, and the mail did not follow, so a vendor who clicked through
 * from an email arrived at what looked like a different company. The colours
 * below are the site's own tokens, transcribed. When one changes there, change
 * it here; there is no way to share them across a server-rendered email and a
 * CSS custom property.
 */

const PAPER = "#FFFFFF";      // the card
const PAPER_2 = "#F1F4F7";    // the ground behind it, and sunken panels
const INK = "#0E1116";        // near-black, faintly blue
const INK_2 = "#626B79";      // secondary text
const RULE = "#E4E7EC";       // every border
const ACCENT = "#1D4EB2";     // the one signal

// The body face. Archivo is the site's display type and is not available in
// mail, so this is the system stack every client already has — which renders
// closer to the site than a webfont that silently falls back to Times.
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";

/**
 * The origin every link and image in an email is built from.
 *
 * This is deliberately NOT simply SITE_URL. That variable answers a different
 * question — where to send a buyer back to after paying — and on a development
 * machine its correct value is http://localhost:5173. An email built from it
 * embeds the masthead as
 *
 *     http://localhost:5173/logos/toolhaven-mark.png
 *
 * which is a broken image in every inbox on earth except the one on the
 * machine that sent it, and every link in the message — status page, listing,
 * promotion — is dead in the same way. Mail leaves the building; it can only
 * ever point at the public site.
 *
 * So a localhost value is refused rather than used. PUBLIC_SITE_URL exists for
 * the one case where that is wrong: a staging deployment whose mail should
 * point at staging.
 */
function publicSite() {
  const configured = String(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "")
    .trim().replace(/\/+$/, "");
  if (!configured) return "https://www.toolhaven.net";
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|$)/i.test(configured)) {
    return "https://www.toolhaven.net";
  }
  return configured;
}

const SITE = publicSite();
const MARK = `${SITE}/logos/toolhaven-mark.png`;

export const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Wrap content in the Toolhaven shell.
 *
 * @param {object} o
 * @param {string} o.preheader  the grey line a client previews next to the subject —
 *                              left unset it shows whatever the first text is, which
 *                              is usually the masthead and tells the reader nothing
 * @param {string} o.kicker     small mono line above the heading
 * @param {string} o.heading    the one sentence the message is about
 * @param {string} o.body       inner HTML, already escaped by the caller
 * @param {string} [o.footnote] quiet line under the rule
 */
export function shell({ preheader = "", kicker = "", heading = "", body = "", footnote = "" }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER_2};-webkit-font-smoothing:antialiased;">
  <!-- preview text, hidden in the body but read by the inbox list -->
  <div style="display:none;font-size:1px;color:${PAPER_2};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
    ${esc(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:${PAPER_2};padding:32px 12px;">
    <tr><td align="center">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="width:600px;max-width:100%;background:${PAPER};border:1px solid ${RULE};border-radius:10px;">

        <!-- masthead -->
        <tr><td style="padding:20px 32px;border-bottom:1px solid ${RULE};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="padding-right:10px;vertical-align:middle;">
              <img src="${MARK}" width="26" height="26" alt=""
                style="display:block;width:26px;height:26px;border:0;border-radius:5px;">
            </td>
            <td style="vertical-align:middle;">
              <span style="font-family:${SANS};font-size:15px;font-weight:700;
                letter-spacing:.2em;color:${INK};text-transform:uppercase;">TOOLHAVEN</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- body -->
        <tr><td style="padding:30px 32px 10px;">
          ${kicker ? `<p style="margin:0 0 12px;font-family:${MONO};font-size:11px;
            letter-spacing:.16em;text-transform:uppercase;color:${ACCENT};">${esc(kicker)}</p>` : ""}
          ${heading ? `<h1 style="margin:0 0 16px;font-family:${SANS};font-size:28px;
            line-height:1.2;font-weight:700;letter-spacing:-.02em;color:${INK};">${esc(heading)}</h1>` : ""}
          ${body}
        </td></tr>

        ${footnote ? `<tr><td style="padding:8px 32px 26px;">
          <div style="border-top:1px solid ${RULE};padding-top:16px;">
            <p style="margin:0;font-family:${MONO};font-size:11px;
              letter-spacing:.08em;color:${INK_2};">${footnote}</p>
          </div>
        </td></tr>` : `<tr><td style="height:18px;"></td></tr>`}
      </table>

      <p style="margin:18px 0 0;font-family:${MONO};font-size:11px;
        letter-spacing:.12em;text-transform:uppercase;color:${INK_2};">
        <a href="${SITE}" style="color:${INK_2};text-decoration:none;">toolhaven.net</a>
        &nbsp;&middot;&nbsp; Honest reviews, downsides included
      </p>

    </td></tr>
  </table>
</body></html>`;
}

/** A paragraph in the body voice. */
export const p = (html, muted = false) =>
  `<p style="margin:0 0 16px;font-family:${SANS};
    font-size:15px;line-height:1.65;color:${muted ? INK_2 : INK};">${html}</p>`;

/** The one action a message is asking for. A table so Outlook renders the fill. */
export const button = (href, text) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
    <tr><td style="background:${INK};border-radius:6px;">
      <a href="${esc(href)}" style="display:inline-block;padding:13px 24px;font-family:${MONO};
        font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#FFFFFF;
        text-decoration:none;">${esc(text)}</a>
    </td></tr>
  </table>`;

/**
 * A second action, offered rather than asked for.
 *
 * A message with two filled buttons has no primary action at all, so this is
 * outlined: clearly clickable, clearly the lesser of the two.
 */
export const buttonGhost = (href, text) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
    <tr><td style="background:${PAPER};border:1px solid ${INK};border-radius:6px;">
      <a href="${esc(href)}" style="display:inline-block;padding:12px 23px;font-family:${MONO};
        font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${INK};
        text-decoration:none;">${esc(text)}</a>
    </td></tr>
  </table>`;

/**
 * A sunken panel for a secondary offer, set apart from the message's own point.
 *
 * @param {object} o
 * @param {string} o.kicker
 * @param {string} o.heading
 * @param {string} o.body   inner HTML
 */
export const panel = ({ kicker = "", heading = "", body = "" }) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="width:100%;margin:6px 0 18px;background:${PAPER_2};border-radius:8px;">
    <tr><td style="padding:20px 22px 6px;">
      ${kicker ? `<p style="margin:0 0 8px;font-family:${MONO};font-size:11px;letter-spacing:.16em;
        text-transform:uppercase;color:${ACCENT};">${esc(kicker)}</p>` : ""}
      ${heading ? `<p style="margin:0 0 10px;font-family:${SANS};font-size:18px;line-height:1.3;
        font-weight:700;letter-spacing:-.01em;color:${INK};">${esc(heading)}</p>` : ""}
      ${body}
    </td></tr>
  </table>`;

/** A labelled fact table — the submission details, and anything like them. */
export const facts = (rows) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="width:100%;margin:2px 0 18px;border-collapse:collapse;">
    ${rows.filter(([, v]) => v != null && String(v).trim() !== "").map(([k, v, href]) => `
      <tr>
        <td style="padding:10px 16px 10px 0;vertical-align:top;white-space:nowrap;
          font-family:${MONO};font-size:11px;letter-spacing:.1em;
          text-transform:uppercase;color:${INK_2};border-bottom:1px solid ${RULE};">${esc(k)}</td>
        <td style="padding:10px 0;vertical-align:top;font-family:${SANS};font-size:14px;line-height:1.5;color:${INK};
          border-bottom:1px solid ${RULE};">
          ${href ? `<a href="${esc(href)}" style="color:${ACCENT};">${esc(v)}</a>` : esc(v)}
        </td>
      </tr>`).join("")}
  </table>`;

export const COLOURS = { PAPER, PAPER_2, INK, INK_2, RULE, ACCENT, SITE, MARK, SANS, MONO };
