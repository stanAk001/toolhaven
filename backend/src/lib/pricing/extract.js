/**
 * Reading plans and prices out of a pricing page.
 *
 * Three sources in descending order of trust:
 *   json-ld        the vendor stated it in machine-readable form; believe it
 *   embedded-json  the page's own data island (Next.js and friends)
 *   html-text      inferred from reading order, and scored accordingly
 *
 * The one rule the HTML reader follows is that a price belongs to the nearest
 * plan name *above* it. That is how these pages are built and how people read
 * them, and it is why "$0 $9 $16 $29" resolves to four tiers rather than to a
 * starting price of zero.
 */
import { toLines, stripNonContent, decodeEntities } from "./html.js";
import { detectCurrency, detectPeriod, findAmounts, looksCustom, looksFreePlan } from "./money.js";

// The words SaaS uses for its tiers. Not exhaustive and not required — a
// heading is accepted as a plan name on its shape alone — but a strong signal.
const TIER_WORDS = /^(free|freemium|starter|basic|lite|personal|individual|solo|hobby|core|standard|plus|pro|professional|premium|team|teams|business|growth|scale|advanced|essential|essentials|enterprise|ultimate|unlimited|custom|trial|student|creator|studio|agency)\b/i;

// Page furniture that reads like a tier and is not one.
const NOT_A_PLAN = /\b(pricing|plans?|prices?|billing|compare|choose|features?|faq|questions?|save|discount|includes?|everything|limits?|support)\b/i;

const isPlanName = (line) => {
  const t = line.text.trim();
  if (!t || t.length > 42) return false;
  // An h1 is the page's title — "Simple annual pricing" is not a plan.
  if (line.heading === 1) return false;
  if (NOT_A_PLAN.test(t)) return false;

  // In a heading, a short label is a plan name.
  if (line.heading >= 2 && line.heading <= 4) {
    return t.split(/\s+/).length <= 4 && !/[.!?:]$/.test(t);
  }
  // Outside a heading the bar is much higher, or every feature bullet starting
  // with "Custom" or "Pro" becomes a tier of its own.
  return /^(free|freemium|starter|basic|lite|personal|individual|solo|hobby|core|standard|plus|pro|professional|premium|team|teams|business|growth|scale|advanced|essential|essentials|enterprise|ultimate|unlimited|custom)(\s+(plan|tier))?$/i.test(t);
};

/* ── 1. JSON-LD ─────────────────────────────────────────────────────────── */

export function extractJsonLd(html) {
  const plans = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let parsed;
    try { parsed = JSON.parse(decodeEntities(m[1].trim())); } catch { continue; }
    walkJsonLd(parsed, plans);
  }
  return plans;
}

function walkJsonLd(node, out, depth = 0) {
  if (!node || depth > 6) return;
  if (Array.isArray(node)) { node.forEach((n) => walkJsonLd(n, out, depth + 1)); return; }
  if (typeof node !== "object") return;

  const type = String(node["@type"] || "");
  if (/Offer|AggregateOffer/i.test(type)) {
    const price = node.price ?? node.lowPrice ?? node.priceSpecification?.price;
    const currency = node.priceCurrency || node.priceSpecification?.priceCurrency || null;
    const value = price === undefined || price === null || price === "" ? null : Number(String(price).replace(/[^\d.]/g, ""));
    if (value !== null && Number.isFinite(value)) {
      const spec = node.priceSpecification || {};
      const unit = String(spec.unitText || spec.billingDuration || node.billingDuration || "").toLowerCase();
      out.push({
        name: String(node.name || node.itemOffered?.name || "Plan").slice(0, 60),
        price: value,
        currency: currency || "USD",
        billingPeriod: /year|annual|P1Y/i.test(unit) ? "year" : /month|P1M/i.test(unit) ? "month" : null,
        isFree: value === 0,
        isCustom: false,
        rawText: JSON.stringify(node).slice(0, 200),
      });
    }
  }
  for (const key of ["offers", "hasOfferCatalog", "itemListElement", "makesOffer", "@graph"]) {
    if (node[key]) walkJsonLd(node[key], out, depth + 1);
  }
}

/* ── 2. The page's own data island ──────────────────────────────────────── */

export function extractEmbeddedJson(html) {
  const plans = [];
  const blocks = [];
  const next = html.match(/<script\b[^>]*id\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script\s*>/i);
  if (next) blocks.push(next[1]);
  const nuxt = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]{0,400000}?\});?\s*<\/script>/i);
  if (nuxt) blocks.push(nuxt[1]);

  for (const raw of blocks) {
    let parsed;
    try { parsed = JSON.parse(raw.trim()); } catch { continue; }
    walkForPlans(parsed, plans);
  }
  return plans;
}

const NAME_KEYS = ["name", "title", "planName", "tierName", "label"];
const PRICE_KEYS = ["price", "amount", "monthlyPrice", "priceMonthly", "cost", "unitAmount", "unit_amount"];

function walkForPlans(node, out, depth = 0, seen = new Set()) {
  if (!node || depth > 8 || out.length > 40) return;
  if (Array.isArray(node)) { node.forEach((n) => walkForPlans(n, out, depth + 1, seen)); return; }
  if (typeof node !== "object") return;
  if (seen.has(node)) return;
  seen.add(node);

  const nameKey = NAME_KEYS.find((k) => typeof node[k] === "string" && node[k].length > 0 && node[k].length < 42);
  const priceKey = PRICE_KEYS.find((k) => node[k] !== undefined && node[k] !== null && Number.isFinite(Number(node[k])));
  if (nameKey && priceKey) {
    let value = Number(node[priceKey]);
    // Stripe-shaped data stores minor units; a four-figure "price" beside a
    // currency field is almost always cents.
    if (value >= 1000 && /unit_?amount/i.test(priceKey)) value /= 100;
    if (value >= 0 && value < 100_000) {
      out.push({
        name: String(node[nameKey]).slice(0, 60),
        price: value,
        currency: (node.currency || node.priceCurrency || "").toString().toUpperCase().slice(0, 3) || null,
        billingPeriod: /year|annual/i.test(JSON.stringify(node.interval || node.billingPeriod || "")) ? "year" : null,
        isFree: value === 0,
        isCustom: false,
        rawText: JSON.stringify(node).slice(0, 200),
      });
    }
  }
  for (const v of Object.values(node)) walkForPlans(v, out, depth + 1, seen);
}

/* ── 3. Reading the page the way a person does ──────────────────────────── */

/**
 * Walk the page in reading order. A plan name opens a section; the first price
 * under it belongs to it; the next plan name closes it. Prices that appear
 * before any plan name are held aside rather than attached to the wrong tier.
 *
 * The lookahead is bounded: a price twenty lines below a heading, with a wall
 * of feature bullets in between, is not that heading's price.
 */
const LOOKAHEAD_LINES = 8;

export function extractHtmlPlans(html) {
  const lines = toLines(html);
  const pageCurrency = detectCurrency(lines.map((l) => l.text).join(" "));
  const plans = [];
  const orphanPrices = [];

  for (let i = 0; i < lines.length; i++) {
    if (!isPlanName(lines[i])) continue;
    const name = lines[i].text.trim();

    // The window belonging to this plan: up to the next plan name.
    let end = lines.length;
    for (let j = i + 1; j < Math.min(lines.length, i + LOOKAHEAD_LINES + 1); j++) {
      if (isPlanName(lines[j])) { end = j; break; }
      end = j + 1;
    }
    const window = lines.slice(i, end).map((l) => l.text).join(" ");

    if (looksCustom(window) && findAmounts(window).length === 0) {
      plans.push({ name, price: null, currency: null, billingPeriod: null,
        isFree: false, isCustom: true, rawText: window.slice(0, 200) });
      continue;
    }

    const amounts = findAmounts(window, pageCurrency);
    if (!amounts.length) {
      // "Free" with no figure at all is still a plan, and a real one.
      if (/^free\b/i.test(name) || looksFreePlan(window)) {
        plans.push({ name, price: 0, currency: pageCurrency, billingPeriod: null,
          isFree: true, isCustom: false, rawText: window.slice(0, 200) });
      }
      continue;
    }

    // Where a plan shows both a monthly and an annual figure, the smaller is
    // the monthly-equivalent headline the vendor is advertising.
    const chosen = amounts.reduce((a, b) => (b.value < a.value ? b : a));
    const period = detectPeriod(chosen.context || window);
    plans.push({
      name,
      price: chosen.value,
      currency: chosen.currency || pageCurrency,
      billingPeriod: period.period,
      billingType: period.annualDeal ? "annual-billed-monthly" : period.period === "year" ? "annual" : period.period === "month" ? "monthly" : null,
      perUnit: period.perUnit,
      isFree: chosen.value === 0,
      isCustom: false,
      rawText: (chosen.context || window).slice(0, 200),
    });
  }

  if (!plans.length) {
    for (const a of findAmounts(lines.map((l) => l.text).join("\n"), pageCurrency).slice(0, 12)) {
      orphanPrices.push(a);
    }
  }
  return { plans, orphanPrices, pageCurrency };
}

/* ── The extractor, choosing between its sources ────────────────────────── */

export function extractPricing(html) {
  const cleaned = stripNonContent(html);
  const text = toLines(html).map((l) => l.text).join("\n");

  const jsonLd = extractJsonLd(html);
  if (jsonLd.length >= 1) {
    return finish(jsonLd, "json-ld", text, cleaned);
  }
  const embedded = extractEmbeddedJson(html);
  if (embedded.length >= 2) {
    return finish(embedded, "embedded-json", text, cleaned);
  }
  const { plans, orphanPrices, pageCurrency } = extractHtmlPlans(html);
  if (plans.length) return finish(plans, "html-text", text, cleaned);

  // Nothing structured. Say so — do not promote a loose number to a price.
  return {
    plans: [], method: null, currency: pageCurrency,
    freePlan: /free\s+(plan|tier|forever)/i.test(text),
    freeTrial: hasTrial(text),
    customOnly: looksCustom(text) && orphanPrices.length === 0,
    orphanPrices,
  };
}

const hasTrial = (text) => /\b(\d+[-\s]day\s+(free\s+)?trial|free\s+trial|try\s+(it\s+)?free|start\s+(your\s+)?free\s+trial)\b/i.test(text);

function finish(rawPlans, method, text, cleaned) {
  // Same plan twice (a monthly/annual toggle renders both) — keep the cheaper.
  const byName = new Map();
  for (const p of rawPlans) {
    const key = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const seen = byName.get(key);
    if (!seen || (p.price !== null && seen.price !== null && p.price < seen.price)) byName.set(key, p);
  }
  const plans = [...byName.values()].slice(0, 12).map((p, i) => ({ ...p, orderIndex: i }));

  const paid = plans.filter((p) => p.price !== null && p.price > 0);
  const currency = plans.find((p) => p.currency)?.currency || null;

  return {
    plans,
    method,
    currency,
    freePlan: plans.some((p) => p.isFree) || /free\s+(plan|tier|forever)/i.test(text),
    freeTrial: hasTrial(text),
    customOnly: plans.length > 0 && paid.length === 0 && plans.every((p) => p.isCustom),
    startingPaid: paid.length ? paid.reduce((a, b) => (b.price < a.price ? b : a)) : null,
    popularHint: findPopular(cleaned),
    orphanPrices: [],
  };
}

/** The tier the vendor themselves badge as "Most popular". */
const TIER_LIST = ["free", "starter", "basic", "lite", "personal", "hobby", "core", "standard",
  "plus", "pro", "professional", "premium", "team", "teams", "business", "growth", "scale",
  "advanced", "essential", "enterprise", "ultimate", "unlimited"];

function findPopular(cleaned) {
  const m = cleaned.match(/(most\s+popular|recommended|best\s+value)/i);
  if (!m) return null;
  // The badge sits inside the card it belongs to, so the tier name is close by.
  const around = cleaned
    .slice(Math.max(0, m.index - 400), m.index + 400)
    .replace(/<[^>]+>/g, " ")
    .toLowerCase();
  let best = null;
  let bestDistance = Infinity;
  for (const tier of TIER_LIST) {
    const at = around.indexOf(tier);
    if (at === -1) continue;
    const distance = Math.abs(at - 400);
    if (distance < bestDistance) { bestDistance = distance; best = tier; }
  }
  return best;
}
