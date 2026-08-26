/**
 * Just enough HTML handling to read a pricing page, and no more.
 *
 * Deliberately not a DOM. Nothing here evaluates, executes or resolves
 * anything from the fetched document — scripts and styles are removed before
 * any other step, and what remains is treated as text. That rules out a whole
 * class of problems in exchange for a parser that only has to be good at one
 * job: turning a pricing page into lines that keep their reading order.
 */

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  euro: "\u20ac", pound: "\u00a3", yen: "\u00a5", cent: "\u00a2",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", middot: "\u00b7",
  rsquo: "\u2019", lsquo: "\u2018", ldquo: "\u201c", rdquo: "\u201d",
};

export function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+\d?);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

const safeChar = (code) => (Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "");

/** Everything that is not content, gone before anything else looks at the page. */
export function stripNonContent(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi, " ")
    .replace(/<(nav|footer|header)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
}

// Tags that end a line of reading. Keeping these boundaries is the whole point:
// a plan name and its price are adjacent in the document even when they are
// nowhere near each other on screen.
const BLOCK = /<\/?(div|p|section|article|li|ul|ol|tr|td|th|h[1-6]|header|footer|main|aside|table|thead|tbody|br|span|dt|dd|button|a|label|strong|em|small)\b[^>]*>/gi;

/**
 * The page as lines, in document order, with the heading level of each line
 * where the markup declared one. Heading level is the strongest clue available
 * for "this text names a plan".
 */
export function toLines(html) {
  const cleaned = stripNonContent(html);
  const marked = cleaned
    .replace(/<h([1-6])\b[^>]*>/gi, (_, n) => "\n\u0001H" + n + "\u0001")
    .replace(/<\/h[1-6]\s*>/gi, "\n")
    .replace(BLOCK, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(marked)
    .split("\n")
    .map((raw) => {
      const m = raw.match(/^\u0001H(\d)\u0001([\s\S]*)$/);
      const text = (m ? m[2] : raw).replace(/[\s\u00a0]+/g, " ").trim();
      return { text, heading: m ? Number(m[1]) : 0 };
    })
    .filter((l) => l.text.length > 0);
}

/** Flat text, for the checks that only care what words are on the page. */
export const toText = (html) => toLines(html).map((l) => l.text).join("\n");

/** Every <a href>, absolute, for finding the pricing page from a homepage. */
export function links(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]{0,200}?)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (!href || href.startsWith("#") || /^(javascript|mailto|tel):/i.test(href)) continue;
    let abs;
    try { abs = new URL(href, baseUrl).href; } catch { continue; }
    const label = decodeEntities(m[5].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    out.push({ href: abs, label });
  }
  return out;
}
