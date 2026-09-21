/**
 * The promotion rules that must hold whatever the network says.
 *
 * Nothing here touches a provider or the database. These are the decisions
 * that stand between a browser and a live campaign: what a status may become,
 * what currency a buyer is quoted, and whether a payment is the one we sold.
 */
import { createHmac } from "node:crypto";
import { STATUS, canMove, refusal, liveWhere, toolIsPromotable } from "../src/lib/promotion/lifecycle.js";
import { countryOf, currencyFor, amountFor, formatMinor, pricesOf } from "../src/lib/promotion/money.js";
import { settle, webhookIsGenuine, referenceFromWebhook, newReference, PROVIDERS } from "../src/lib/promotion/payments.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL " + what); } };
const is = (got, want, what) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${what}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

console.log("\n1. campaign lifecycle");
ok(canMove(STATUS.DRAFT, STATUS.PENDING_PAYMENT), "a draft can go to checkout");
ok(canMove(STATUS.PENDING_PAYMENT, STATUS.PAYMENT_RECEIVED), "checkout can record a payment");
ok(canMove(STATUS.PENDING_REVIEW, STATUS.APPROVED), "review can approve");
ok(canMove(STATUS.ACTIVE, STATUS.EXPIRED), "a live campaign can expire");

// The whole point of the table: money and review cannot be skipped.
ok(!canMove(STATUS.DRAFT, STATUS.ACTIVE), "a draft can NOT jump straight to live");
ok(!canMove(STATUS.PENDING_PAYMENT, STATUS.ACTIVE), "an unpaid campaign can NOT go live");
ok(!canMove(STATUS.PAYMENT_RECEIVED, STATUS.ACTIVE), "paying does NOT skip editorial review");
ok(!canMove(STATUS.REJECTED, STATUS.ACTIVE), "a rejected campaign can NOT be revived into live");
ok(!canMove(STATUS.EXPIRED, STATUS.ACTIVE), "an expired campaign is finished");
ok(!canMove(STATUS.COMPLETED, STATUS.ACTIVE), "a completed campaign is finished");
ok(!canMove(STATUS.ACTIVE, "SUPER_ACTIVE"), "an invented status is refused");
ok(/cannot change/.test(refusal(STATUS.COMPLETED, STATUS.ACTIVE)), "and says why in plain words");

console.log("\n2. only live campaigns render");
{
  const w = liveWhere(new Date("2026-06-15T12:00:00Z"));
  is(w.status, "ACTIVE", "status must be ACTIVE");
  ok(w.startDate.lte instanceof Date && w.endDate.gt instanceof Date,
    "and the window is bounded at both ends, so a finished campaign cannot render even if the job never ran");
}

console.log("\n3. who may promote");
ok(toolIsPromotable({ status: "published", publishedToolId: 7 }), "a published tool with a listing");
ok(!toolIsPromotable({ status: "pending", publishedToolId: null }), "not a pending one");
ok(!toolIsPromotable({ status: "declined", publishedToolId: null }), "not a declined one");
ok(!toolIsPromotable({ status: "published", publishedToolId: null }), "not one that was never actually listed");
ok(!toolIsPromotable(null), "and not a missing submission");

console.log("\n4. where the buyer is");
const req = (headers) => ({ get: (h) => headers[h.toLowerCase()] ?? undefined });
is(countryOf(req({ "x-vercel-ip-country": "ng" })).country, "NG", "Vercel's country header");
is(countryOf(req({ "cf-ipcountry": "GB" })).country, "GB", "Cloudflare's");
is(countryOf(req({ "cf-ipcountry": "XX" })).country, null, "Cloudflare's unknown marker is not a country");
is(countryOf(req({ "accept-language": "en-NG,en;q=0.9" })).country, "NG", "language as a last resort");
is(countryOf(req({})).country, null, "and nothing invented when there is no signal");
is(countryOf(req({ "x-vercel-ip-country": "NG", "cf-ipcountry": "US" })).source, "vercel", "the edge header wins over the guess");

console.log("\n5. what they are charged");
const plan = { priceUsdCents: 4900, priceNgnKobo: 7500000 };
is(currencyFor("NG", plan).code, "NGN", "a Nigerian buyer is quoted naira");
is(currencyFor("US", plan).code, "USD", "everyone else, dollars");
is(currencyFor(null, plan).code, "USD", "unknown country falls back to dollars");
is(currencyFor("NG", plan).provider, "paystack", "naira goes to Paystack");
is(currencyFor("US", plan).provider, "flutterwave", "dollars to Flutterwave");
is(amountFor(plan, currencyFor("NG", plan)), 7500000, "the naira amount comes from the plan row");
is(amountFor(plan, currencyFor("US", plan)), 4900, "as does the dollar amount");

// A plan priced in one currency only must not be invented into the other.
is(currencyFor("US", { priceNgnKobo: 5000000 }).code, "NGN", "a naira-only plan is not converted for a US buyer");
is(currencyFor("US", { quoteOnly: true }), null, "a quote-only plan has no price at all");
is(pricesOf({ priceUsdCents: 1900 }).ngn, null, "an unpriced currency reports null, not zero");
is(formatMinor(7500000, "NGN"), "₦75,000", "naira formatting");
is(formatMinor(4900, "USD"), "$49", "dollar formatting");
is(formatMinor(2950, "USD"), "$29.50", "and keeps real decimals");

console.log("\n6. a payment is only the one we sold");
const base = { providerStatus: "success", succeeded: true, currency: "USD", paidAt: null };
ok(settle({ ...base, amountMinor: 4900, expectMinor: 4900, expectCurrency: "USD" }).paid,
  "matching amount and currency settles");
ok(!settle({ ...base, amountMinor: 100, expectMinor: 4900, expectCurrency: "USD" }).paid,
  "an underpayment does NOT settle");
ok(/expected 4900/.test(settle({ ...base, amountMinor: 100, expectMinor: 4900, expectCurrency: "USD" }).mismatch || ""),
  "and records what was expected");
ok(!settle({ ...base, amountMinor: 4900, currency: "NGN", expectMinor: 4900, expectCurrency: "USD" }).paid,
  "the right number in the wrong currency does NOT settle");
ok(!settle({ ...base, succeeded: false, amountMinor: 4900, expectMinor: 4900, expectCurrency: "USD" }).paid,
  "a failed charge does not settle however much it was for");
ok(!settle({ ...base, amountMinor: null, expectMinor: 4900, expectCurrency: "USD" }).paid,
  "and neither does a missing amount");

console.log("\n7. webhooks must be signed");
{
  const secret = "sk_test_pretend";
  process.env.PAYSTACK_SECRET_KEY = secret;
  const body = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "thp_x" } }));
  const good = createHmac("sha512", secret).update(body).digest("hex");

  ok(webhookIsGenuine(PROVIDERS.PAYSTACK, req({ "x-paystack-signature": good }), body),
    "a correctly signed Paystack webhook is accepted");
  ok(!webhookIsGenuine(PROVIDERS.PAYSTACK, req({ "x-paystack-signature": "deadbeef" }), body),
    "a forged signature is refused");
  ok(!webhookIsGenuine(PROVIDERS.PAYSTACK, req({}), body), "an unsigned webhook is refused");
  // Re-serialising the parsed body changes the bytes and must fail.
  ok(!webhookIsGenuine(PROVIDERS.PAYSTACK, req({ "x-paystack-signature": good }),
    Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "thp_x" } }) + " ")),
    "a body altered by one byte is refused");

  process.env.FLUTTERWAVE_WEBHOOK_HASH = "agreed-hash";
  ok(webhookIsGenuine(PROVIDERS.FLUTTERWAVE, req({ "verif-hash": "agreed-hash" }), body),
    "a matching Flutterwave hash is accepted");
  ok(!webhookIsGenuine(PROVIDERS.FLUTTERWAVE, req({ "verif-hash": "wrong" }), body), "a wrong one is refused");
  delete process.env.PAYSTACK_SECRET_KEY;
  ok(!webhookIsGenuine(PROVIDERS.PAYSTACK, req({ "x-paystack-signature": good }), body),
    "and with no secret configured, nothing is genuine");
}

console.log("\n8. references");
is(referenceFromWebhook(PROVIDERS.PAYSTACK, { data: { reference: "thp_a" } }), "thp_a", "Paystack reference");
is(referenceFromWebhook(PROVIDERS.FLUTTERWAVE, { data: { tx_ref: "thp_b" } }), "thp_b", "Flutterwave tx_ref");
is(referenceFromWebhook(PROVIDERS.PAYSTACK, {}), null, "a payload with no reference yields null");
ok(!/\d{1,6}$/.test(newReference()) || newReference() !== newReference(), "references are unique");
ok(!newReference().includes("undefined"), "and well-formed");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
