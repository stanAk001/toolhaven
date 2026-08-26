/**
 * Reading money out of prose.
 *
 * The rule this module exists to enforce is that a number is not a price and a
 * price is not a plan. "$0 $9 $16 $29" on a page tells you almost nothing until
 * you know which tier each belongs to and what period each is charged over, and
 * a system that grabs the first currency symbol it sees will confidently
 * publish "$0/month" for a product that costs $29.
 *
 * So every figure carries the text it was read from, and anything ambiguous is
 * returned as ambiguous rather than resolved by guessing.
 */

// Symbol first where a symbol is unambiguous, then ISO codes. Order matters:
// "CA$" must be tested before "$", or every Canadian price becomes USD.
const SYMBOLS = [
  ["CA$", "CAD"], ["A$", "AUD"], ["NZ$", "NZD"], ["HK$", "HKD"], ["R$", "BRL"],
  ["US$", "USD"], ["S$", "SGD"], ["NT$", "TWD"],
  ["\u20ac", "EUR"], ["\u00a3", "GBP"], ["\u00a5", "JPY"], ["\u20b9", "INR"],
  ["\u20a6", "NGN"], ["\u20bd", "RUB"], ["\u20a9", "KRW"], ["\u20aa", "ILS"],
  ["\u0e3f", "THB"], ["R", "ZAR"], ["$", "USD"],
];
const CODES = new Set([
  "USD", "EUR", "GBP", "NGN", "CAD", "AUD", "INR", "ZAR", "JPY", "CHF", "SEK",
  "NOK", "DKK", "PLN", "BRL", "MXN", "SGD", "NZD", "HKD", "AED", "KES", "GHS",
  "CNY", "KRW", "TRY", "ILS", "THB", "PHP", "IDR", "MYR", "CZK", "RON", "HUF",
]);

/** Currency for a fragment of text, or null when nothing says. */
export function detectCurrency(text) {
  if (!text) return null;
  const code = text.match(/\b([A-Z]{3})\s?[\d\u20ac\u00a3$]/);
  if (code && CODES.has(code[1])) return code[1];
  const plain = text.match(/\b([A-Z]{3})\b/);
  if (plain && CODES.has(plain[1]) && !/\b(THE|AND|FOR|ALL|PRO|NEW|API|GET|SEO|USE)\b/.test(plain[1])) return plain[1];
  // "R" alone is too weak a signal for rand; require "R" glued to digits.
  for (const [sym, cur] of SYMBOLS) {
    if (sym === "R" ? /\bR\s?\d/.test(text) : text.includes(sym)) return cur;
  }
  return null;
}

/**
 * The billing period a price is charged over, read from the words around it.
 * Returns the period plus whether the source framed it as an annual deal, since
 * "$9/month billed annually" and "$9/month" are different offers.
 */
export function detectPeriod(text) {
  const t = (text || "").toLowerCase();
  const perUnit =
    /per\s+(user|seat|member|editor|agent|host|contact|subscriber)|\/\s*(user|seat|member|editor|agent)|(user|seat|member|agent)\s*\/\s*(mo|month)/.test(t)
      ? (t.match(/per\s+(user|seat|member|editor|agent|host|contact|subscriber)/)?.[1]
        || t.match(/\/\s*(user|seat|member|editor|agent)/)?.[1]
        || t.match(/(user|seat|member|agent)\s*\/\s*(?:mo|month)/)?.[1])
      : null;

  const usage = /per\s+([\d,]+\s+)?(operation|credit|request|call|message|minute|token|lookup|record|task|run|execution|email|sms)/.test(t)
    ? (t.match(/per\s+(?:[\d,]+\s+)?(operation|credit|request|call|message|minute|token|lookup|record|task|run|execution|email|sms)/)?.[1] || null)
    : null;

  const annualDeal = /billed\s+(annually|yearly|per\s+year)|\bwhen\s+billed\s+(annually|yearly)|\/yr\s*billed/.test(t);
  const oneTime = /one[-\s]?time|lifetime|once\b|single\s+payment/.test(t);

  let period = null;
  if (/\/\s*(mo|month|monthly)\b|per\s+month|a\s+month|monthly/.test(t)) period = "month";
  else if (/\/\s*(yr|year|annually)\b|per\s+year|a\s+year|annually|yearly/.test(t)) period = "year";
  if (oneTime) period = "one-time";
  if (usage && !period) period = "usage";

  return { period, perUnit: perUnit || usage || null, annualDeal, oneTime, usage: !!usage };
}

/** "Contact sales", "Custom", "Let's talk" — a real answer, not a missing one. */
export const looksCustom = (text) => /contact\s+(us|sales|our\s+team)|custom\s+(pricing|quote|plan)?\b|talk\s+to\s+(us|sales)|get\s+a\s+quote|request\s+(a\s+)?(demo|quote|pricing)|enterprise\s+pricing|by\s+quotation/i.test(text || "");

// A free plan, specifically. "14-day free trial" is a different claim and must
// not be read as one, or every product offering a trial grows a $0 tier it does
// not have.
export const looksFreePlan = (text) => {
  const t = String(text || "");
  const trialOnly = /free\s+trial|trial\s+for\s+free|try\s+(it\s+)?free/i.test(t)
    && !/free\s+(plan|tier|forever)/i.test(t);
  if (trialOnly) return false;
  return /\b(free\s+forever|free\s+plan|free\s+tier|always\s+free|no\s+cost)\b/i.test(t)
    || /(^|\s)\$0(\.00)?(\s|$)/.test(t);
};

/**
 * Every money-looking figure in a fragment, with the slice of text it came
 * from. Rejects the shapes that look like prices and are not: years, version
 * numbers, percentages, counts of things.
 */
export function findAmounts(text, currencyHint = null) {
  if (!text) return [];
  const out = [];
  const re = /(CA\$|A\$|NZ\$|HK\$|US\$|R\$|S\$|NT\$|[$\u20ac\u00a3\u00a5\u20b9\u20a6\u20bd\u20a9\u20aa\u0e3f])\s?(\d[\d,]*(?:[.,]\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s?(USD|EUR|GBP|NGN|CAD|AUD|INR|ZAR|JPY|SGD|CHF)\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const symbol = m[1] || null;
    const digits = (m[2] || m[3] || "").replace(/[\s\u00a0]/g, "");
    const trailingCode = m[4] || null;
    if (!digits) continue;

    // "1,234.56" and "1.234,56" are the same number written two ways.
    let value;
    if (/,\d{2}$/.test(digits) && !/\.\d/.test(digits)) value = Number(digits.replace(/\./g, "").replace(",", "."));
    else value = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;

    const around = text.slice(Math.max(0, m.index - 90), Math.min(text.length, m.index + m[0].length + 90));

    // A bare four-digit number next to "©" or "since" is a year, not a price.
    if (!symbol && !trailingCode) continue;
    if (value > 100_000) continue;                        // no SaaS tier costs this
    if (/\b(19|20)\d{2}\b/.test(m[0]) && !symbol) continue;

    out.push({
      value,
      currency: trailingCode || (symbol ? symbolCurrency(symbol) : currencyHint) || currencyHint || null,
      raw: m[0].trim(),
      context: around.replace(/\s+/g, " ").trim(),
      index: m.index,
    });
  }
  return out;
}

function symbolCurrency(sym) {
  for (const [s, c] of SYMBOLS) if (s === sym) return c;
  return null;
}

export const _tables = { SYMBOLS, CODES };
