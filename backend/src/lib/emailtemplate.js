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
 */

const PAPER = "#F1EADD";
const PAPER_2 = "#E8DFCF";
const INK = "#1C1714";
const INK_2 = "#6A5F52";
const ACCENT = "#E8431F";

const SITE = (process.env.SITE_URL || "https://www.toolhaven.net").replace(/\/+$/, "");
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
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER_2};">
  <!-- preview text, hidden in the body but read by the inbox list -->
  <div style="display:none;font-size:1px;color:${PAPER_2};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
    ${esc(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:${PAPER_2};padding:28px 12px;">
    <tr><td align="center">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="width:600px;max-width:100%;background:${PAPER};border:2px solid ${INK};border-radius:8px;">

        <!-- masthead -->
        <tr><td style="padding:22px 28px 18px;border-bottom:2px solid ${INK};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="padding-right:12px;vertical-align:middle;">
              <img src="${MARK}" width="34" height="34" alt=""
                style="display:block;width:34px;height:34px;border:0;border-radius:6px;">
            </td>
            <td style="vertical-align:middle;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:700;
                letter-spacing:.18em;color:${INK};text-transform:uppercase;">TOOLHAVEN</span>
              <span style="color:${ACCENT};font-size:15px;">&#10022;</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- body -->
        <tr><td style="padding:26px 28px 8px;">
          ${kicker ? `<p style="margin:0 0 10px;font-family:'Courier New',Courier,monospace;font-size:11px;
            letter-spacing:.18em;text-transform:uppercase;color:${ACCENT};">${esc(kicker)}</p>` : ""}
          ${heading ? `<h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:27px;
            line-height:1.15;font-weight:700;color:${INK};">${esc(heading)}</h1>` : ""}
          ${body}
        </td></tr>

        ${footnote ? `<tr><td style="padding:6px 28px 24px;">
          <div style="border-top:1px solid rgba(28,23,20,.18);padding-top:14px;">
            <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:11px;
              letter-spacing:.1em;color:${INK_2};">${footnote}</p>
          </div>
        </td></tr>` : `<tr><td style="height:14px;"></td></tr>`}
      </table>

      <p style="margin:16px 0 0;font-family:'Courier New',Courier,monospace;font-size:11px;
        letter-spacing:.14em;text-transform:uppercase;color:${INK_2};">
        <a href="${SITE}" style="color:${INK_2};text-decoration:none;">toolhaven.net</a>
        &nbsp;&middot;&nbsp; Honest reviews, downsides included
      </p>

    </td></tr>
  </table>
</body></html>`;
}

/** A paragraph in the body voice. */
export const p = (html, muted = false) =>
  `<p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    font-size:15px;line-height:1.6;color:${muted ? INK_2 : INK};">${html}</p>`;

/** The one action a message is asking for. A table so Outlook renders the fill. */
export const button = (href, text) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;">
    <tr><td style="background:${INK};border-radius:4px;">
      <a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-family:'Courier New',Courier,monospace;
        font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${PAPER};
        text-decoration:none;">${esc(text)}</a>
    </td></tr>
  </table>`;

/** A labelled fact table — the submission details, and anything like them. */
export const facts = (rows) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="width:100%;margin:2px 0 16px;border-collapse:collapse;">
    ${rows.filter(([, v]) => v != null && String(v).trim() !== "").map(([k, v, href]) => `
      <tr>
        <td style="padding:9px 14px 9px 0;vertical-align:top;white-space:nowrap;
          font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:.12em;
          text-transform:uppercase;color:${INK_2};border-bottom:1px solid rgba(28,23,20,.12);">${esc(k)}</td>
        <td style="padding:9px 0;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',
          Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:${INK};
          border-bottom:1px solid rgba(28,23,20,.12);">
          ${href ? `<a href="${esc(href)}" style="color:${ACCENT};">${esc(v)}</a>` : esc(v)}
        </td>
      </tr>`).join("")}
  </table>`;

export const COLOURS = { PAPER, PAPER_2, INK, INK_2, ACCENT, SITE, MARK };
