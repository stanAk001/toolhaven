/**
 * Finding the page that actually states the price.
 *
 * The source hierarchy matters more than the extraction does. A perfect parse
 * of a comparison blog is worse than no parse at all, because it launders
 * somebody's stale guess into a figure published under Toolhaven's name. So
 * this only ever looks at the vendor's own domain, and the ranking below is
 * about which page *of theirs* to trust, not which website to trust.
 *
 * Search-engine discovery (brief §2, priority 4) is wired as an optional step
 * that needs a configured key. Without one it is skipped rather than faked —
 * scraping a search page from a server is both unreliable and against most
 * engines' terms, and the guessed paths below find the pricing page for the
 * overwhelming majority of SaaS sites anyway.
 */
import { fetchPage } from "./fetcher.js";
import { links, toText } from "./html.js";

// In the order a person would try them.
const CANDIDATE_PATHS = [
  "/pricing", "/plans", "/pricing/", "/plans/", "/price", "/prices",
  "/pricing-plans", "/en/pricing", "/us/pricing", "/subscribe", "/upgrade",
];

const LINK_LABEL = /^\s*(pricing|plans|pricing\s*&?\s*plans|plans\s*&?\s*pricing|price|prices|see\s+pricing|view\s+plans)\s*$/i;

/** Does this page actually look like a pricing page, or just answer 200? */
export function looksLikePricingPage(html) {
  const text = toText(html);
  // Enough to rule out an empty JavaScript shell, low enough not to rule out a
  // genuinely spare pricing page. The signal count below does the real work.
  if (text.length < 100) return false;
  const signals = [
    /\bper\s+(month|year|user|seat)\b/i,
    /\/\s*(mo|month|yr|year)\b/i,
    /\b(billed\s+(annually|monthly)|most\s+popular|choose\s+(a\s+)?plan|compare\s+plans)\b/i,
    /\b(free\s+(plan|tier|forever)|start\s+free|contact\s+sales)\b/i,
  ].filter((re) => re.test(text)).length;
  const hasMoney = /[$\u20ac\u00a3\u20a6\u20b9]\s?\d/.test(text) || /\b\d+\s?(USD|EUR|GBP)\b/.test(text);
  if (signals >= 2 || (hasMoney && signals >= 1)) return true;

  // A page that only sells through a sales call is still the pricing page, and
  // reaching that conclusion is a real answer worth recording. Without this it
  // fell through to "no pricing found", which reads as a failure when it is
  // actually the vendor's published position.
  const salesLed = /contact\s+(us|sales)|request\s+(a\s+)?(demo|quote)|get\s+a\s+quote|custom\s+(pricing|quote)|talk\s+to\s+sales/i.test(text);
  const aboutPricing = /(pricing|plans|quote|cost)/i.test(text.slice(0, 500));
  return salesLed && aboutPricing;
}

/**
 * Resolve the best available source for a tool's pricing.
 * @returns {{url, sourceType, html} | {failed: true, outcome, detail, attempts}}
 */
export async function findPricingSource(officialUrl, { onAttempt } = {}) {
  const attempts = [];
  let base;
  try { base = new URL(officialUrl); }
  catch { return { failed: true, outcome: "error", detail: "tool has no usable website URL", attempts }; }

  const record = (url, res) => {
    attempts.push({ url, outcome: res.outcome, status: res.status, durationMs: res.durationMs, detail: res.detail });
    onAttempt?.({ url, ...res });
  };

  // Priority 1 — a dedicated pricing page at a conventional address.
  for (const path of CANDIDATE_PATHS) {
    const url = new URL(path, base.origin).href;
    const res = await fetchPage(url);
    record(url, res);
    if (res.ok && looksLikePricingPage(res.html)) {
      return { url: res.finalUrl || url, sourceType: "official-pricing-page", html: res.html, attempts };
    }
    // A host that blocks us will block every path; stop rather than hammer it.
    if (res.outcome === "blocked") break;
  }

  // Priority 2 — the homepage, both for its own pricing and for a link to it.
  const home = await fetchPage(base.origin);
  record(base.origin, home);
  if (home.ok) {
    const link = links(home.html, base.origin)
      .filter((l) => LINK_LABEL.test(l.label) || /\/(pricing|plans)(\/|$|\?)/i.test(l.href))
      .find((l) => { try { return new URL(l.href).hostname.endsWith(base.hostname.replace(/^www\./, "")); } catch { return false; } });

    if (link) {
      const res = await fetchPage(link.href);
      record(link.href, res);
      if (res.ok && looksLikePricingPage(res.html)) {
        return { url: res.finalUrl || link.href, sourceType: "official-pricing-page", html: res.html, attempts };
      }
    }
    if (looksLikePricingPage(home.html)) {
      return { url: home.finalUrl || base.origin, sourceType: "official-website", html: home.html, attempts };
    }
  }

  const blocked = attempts.some((a) => a.outcome === "blocked");
  const timedOut = attempts.every((a) => a.outcome === "timeout");
  return {
    failed: true,
    outcome: blocked ? "blocked" : timedOut ? "timeout" : "no-pricing-found",
    detail: blocked
      ? "the vendor's site refused automated requests"
      : "no page on the vendor's domain stated pricing in a readable form",
    attempts,
  };
}
