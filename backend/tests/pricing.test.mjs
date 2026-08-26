/**
 * Pricing intelligence tests.  Run: node tests/pricing.test.mjs
 *
 * Extraction across pricing shapes, the verification rules, price-change
 * detection, failure handling and the SSRF protections. Everything runs against
 * fixtures and in-memory data — no network — so it is safe on every change.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = (n) => readFileSync(path.join(HERE, "../src/lib/pricing/fixtures", n), "utf8");
const L = (p) => import(pathToFileURL(path.join(HERE, "../src/lib/pricing/", p)).href);

let passed = 0, failed = 0;
const group = (name) => console.log("\n" + name);
function ok(cond, label, detail) {
  if (cond) { passed++; console.log("  PASS  " + label); }
  else { failed++; console.log("  FAIL  " + label + (detail ? "   -> " + detail : "")); }
}
const eq = (a, b, label) => ok(a === b, label, "got " + JSON.stringify(a) + ", wanted " + JSON.stringify(b));

const { detectPeriod, findAmounts, looksCustom, looksFreePlan } = await L("money.js");
const { extractPricing } = await L("extract.js");
const { normalize, headline } = await L("normalize.js");
const { scorePricing, isPublishable, STATUS } = await L("confidence.js");
const { looksLikePricingPage } = await L("discover.js");
const { isPublicAddress, assertSafeUrl } = await L("urlguard.js");
const { diffPricing, isSignificant } = await L("changes.js");

group("Reading money out of text");
eq(findAmounts("$9/month")[0].currency, "USD", "dollar sign is USD");
eq(findAmounts("\u20ac29 per user/month")[0].currency, "EUR", "euro sign is EUR");
eq(findAmounts("\u20a615,000/month")[0].value, 15000, "naira with a thousands separator");
eq(findAmounts("CA$12/mo")[0].currency, "CAD", "CA$ is Canadian, not US");
eq(findAmounts("99 USD per year")[0].currency, "USD", "trailing ISO code");
eq(findAmounts("Founded in 2019, version 2.5").length, 0, "years and versions are not prices");
eq(detectPeriod("$108/year billed annually").period, "year", "annual stays annual");
eq(detectPeriod("$9/month billed annually").annualDeal, true, "spots an annual deal");
eq(detectPeriod("$16 per user/month").perUnit, "user", "per-seat is per-seat");
eq(detectPeriod("$0.60 per 1,000 operations").perUnit, "operation", "usage unit");
ok(looksCustom("Contact sales for a quote"), "recognises sales-led pricing");
ok(looksFreePlan("Free plan available"), "recognises a free plan");
ok(!looksFreePlan("14-day free trial, no card required"), "a free trial is not a free plan");

group("Extraction across pricing shapes");
{
  const r = extractPricing(FIX("freemium-tiers.html"));
  eq(r.method, "html-text", "reads a conventional pricing grid");
  eq(r.plans.length, 5, "finds exactly the five tiers");
  eq(r.startingPaid.price, 9, "starting paid price is $9, not the $0 free tier");
  eq(r.plans.find((p) => p.name === "Pro").perUnit, "user", "Pro is priced per user");
  ok(r.plans.find((p) => p.name === "Enterprise").isCustom, "Enterprise is custom pricing");
  ok(r.freePlan && r.freeTrial, "free plan and free trial both detected");
}
{
  const r = extractPricing(FIX("jsonld-product.html"));
  eq(r.method, "json-ld", "prefers machine-readable pricing when offered");
  eq(r.startingPaid.price, 24, "starting price read from JSON-LD");
}
{
  const r = extractPricing(FIX("annual-only.html"));
  eq(r.plans.length, 2, "an annual-only page has two plans, not three");
  eq(r.freePlan, false, "a free trial did not invent a free plan");
  eq(r.startingPaid.billingPeriod, "year", "annual billing period preserved");
}
{
  const r = extractPricing(FIX("usage-based.html"));
  ok(r.plans.some((p) => p.isCustom), "usage page still finds its enterprise tier");
  eq(r.freePlan, true, "usage page has a free tier");
}
{
  const r = extractPricing(FIX("no-public-pricing.html"));
  eq(r.plans.length, 0, "no plans invented where none are published");
  eq(r.customOnly, true, "recognised as sales-led pricing");
}
{
  const r = extractPricing(FIX("multi-currency.html"));
  eq(r.currency, "EUR", "keeps the page's own currency, unconverted");
  eq(r.startingPaid.price, 19, "euro starting price");
}
eq(extractPricing(FIX("js-shell.html")).plans.length, 0, "a JavaScript shell yields nothing rather than nonsense");

group("Normalisation");
{
  const n = normalize(extractPricing(FIX("freemium-tiers.html")), { sourceType: "official-pricing-page" });
  eq(n.startingPrice, 9, "headline figure is the cheapest paid plan");
  eq(n.pricingModel, "freemium", "a free tier plus paid tiers is freemium");
  eq(headline(n), "$9/month", "renders as $9/month");
  eq(headline(normalize(extractPricing(FIX("annual-only.html")), {})), "$108/year", "an annual price never renders as monthly");
  {
    const c = normalize(extractPricing(FIX("no-public-pricing.html")), {});
    eq(c.startingPrice, null, "no number invented where none is published");
    eq(headline(c), "Custom pricing", "sales-led pricing says so rather than showing nothing");
  }
}

group("Verification and confidence");
{
  const OFFICIAL = "https://www.vendor.com/";
  const n = normalize(extractPricing(FIX("jsonld-product.html")),
    { sourceUrl: "https://vendor.com/pricing", sourceType: "official-pricing-page" });
  const fresh = { officialUrl: OFFICIAL, sourceUrl: "https://vendor.com/pricing", sourceType: "official-pricing-page", fetchedAt: new Date() };
  const s = scorePricing(n, fresh);
  eq(s.status, STATUS.VERIFIED, "official domain plus JSON-LD verifies");
  ok(s.score >= 0.9, "and scores highly (" + s.score + ")");
  ok(isPublishable(s.status, s.score), "so it may be shown to a reader");

  const third = scorePricing(n, { officialUrl: OFFICIAL, sourceUrl: "https://someblog.com/post", fetchedAt: new Date() });
  ok(third.score < s.score, "the same data from a third party scores lower");
  ok(third.score < 0.8, "and falls below the publishing threshold");

  const stale = scorePricing(n, { ...fresh, fetchedAt: new Date(Date.now() - 200 * 86400000) });
  ok(stale.score < s.score, "a stale check scores lower than a fresh one");

  const loose = normalize(extractPricing("<body><main><p>" + "Our company has a long history. ".repeat(8) + "Plans start from $12.</p></main></body>"), {});
  const ls = scorePricing(loose, { officialUrl: OFFICIAL, sourceUrl: "https://vendor.com/about" });
  ok(!isPublishable(ls.status, ls.score), "a loose number in prose is never published as a price");

  const custom = normalize(extractPricing(FIX("no-public-pricing.html")), { sourceType: "official-pricing-page" });
  eq(scorePricing(custom, fresh).status, STATUS.CUSTOM, "sales-led pricing is its own status, not a failure");
}

group("Recognising a pricing page");
ok(looksLikePricingPage(FIX("freemium-tiers.html")), "a tier grid is a pricing page");
ok(looksLikePricingPage(FIX("no-public-pricing.html")), "a sales-led page is still a pricing page");
ok(!looksLikePricingPage(FIX("js-shell.html")), "an empty JavaScript shell is not");
ok(!looksLikePricingPage("<body><main><h1>About us</h1><p>" + "We build software for teams. ".repeat(20) + "</p></main></body>"), "an about page is not");

group("Price change detection");
{
  const base = { startingPrice: 9, currency: "USD", billingPeriod: "month", freePlan: true, freeTrial: true, pricingModel: "freemium", plans: [{ name: "Free", price: 0 }, { name: "Pro", price: 9 }] };
  const up = diffPricing(base, { ...base, startingPrice: 12, plans: [{ name: "Free", price: 0 }, { name: "Pro", price: 12 }] });
  eq(up.changeType, "increase", "detects an increase");
  eq(up.percentChange, 33.3, "and reports it as +33.3%");
  ok(isSignificant(up), "a third is significant enough to flag");
  eq(diffPricing(base, { ...base, startingPrice: 6 }).changeType, "decrease", "detects a decrease");
  eq(diffPricing(base, { ...base, plans: [...base.plans, { name: "Team", price: 29 }] }).changeType, "plan-added", "detects a new plan");
  eq(diffPricing(base, { ...base, plans: [{ name: "Free", price: 0 }] }).changeType, "plan-removed", "detects a withdrawn plan");
  eq(diffPricing(base, { ...base, freePlan: false }).changeType, "free-plan-changed", "detects the free plan disappearing");
  eq(diffPricing(base, { ...base, currency: "EUR" }).changeType, "currency-changed", "a currency change is not a 400% rise");
  eq(diffPricing(base, { ...base }), null, "no change means no history record");
  eq(diffPricing(null, base).changeType, "first-record", "the first observation is recorded as such");
}

group("URL safety and SSRF protection");
for (const ip of ["127.0.0.1", "169.254.169.254", "10.1.2.3", "192.168.1.1", "172.16.5.4",
  "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "224.0.0.1", "198.18.0.1"]) {
  ok(!isPublicAddress(ip), "blocks " + ip);
}
for (const ip of ["8.8.8.8", "93.184.216.34"]) ok(isPublicAddress(ip), "allows " + ip);

for (const [url, why] of [
  ["file:///etc/passwd", "the file scheme"],
  ["ftp://example.com/", "the ftp scheme"],
  ["http://user:pw@example.com/", "credentials in the URL"],
  ["http://example.com:6379/", "a non-web port"],
  ["http://localhost/", "localhost"],
  ["http://internal.local/", "a .local name"],
  ["http://169.254.169.254/latest/meta-data/", "the cloud metadata address"],
  ["http://[::1]/", "IPv6 loopback"],
  ["not a url", "junk input"],
]) {
  let blocked = false;
  try { await assertSafeUrl(url); } catch { blocked = true; }
  ok(blocked, "refuses " + why);
}

group("Failure handling");
{
  const { fetchPage } = await L("fetcher.js");
  const blockedRes = await fetchPage("http://169.254.169.254/latest/meta-data/");
  eq(blockedRes.ok, false, "a blocked address does not fetch");
  eq(blockedRes.outcome, "blocked", "and is reported as blocked, not as an error");
  ok(!/stack|at Object|node:internal/.test(blockedRes.detail || ""), "the reason carries no stack trace");
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
