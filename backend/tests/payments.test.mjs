/**
 * The payment integration, run against a stand-in provider.
 *
 * Real keys are the one thing that cannot be written here — they live in
 * Paystack and Flutterwave dashboards. Everything else about the integration
 * can be proved without them, and this is the file that does it, because the
 * alternative is finding out from a real customer's real card.
 *
 * What is actually being checked is the stuff that only shows up in
 * production: the exact URLs called, the shape of each request body, the
 * Authorization headers, and above all the minor/major unit handling —
 * Paystack is charged in kobo and Flutterwave in naira, so getting it backwards
 * charges someone a hundred times too much or a hundredth of the price.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";

/** Every request the fake provider received, for inspecting afterwards. */
const seen = [];
let reply = {};

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    seen.push({
      url: req.url,
      method: req.method,
      auth: req.headers.authorization || null,
      body: body ? JSON.parse(body) : null,
    });
    const match = Object.keys(reply).find((k) => req.url.startsWith(k));
    res.writeHead(match ? 200 : 404, { "content-type": "application/json" });
    res.end(JSON.stringify(match ? reply[match] : { message: "no stub for " + req.url }));
  });
});

let payments;
test.before(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.PAYSTACK_API_BASE = base + "/paystack";
  process.env.FLUTTERWAVE_API_BASE = base + "/flutterwave";
  process.env.PAYSTACK_SECRET_KEY = "sk_test_stand_in";
  process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_TEST-stand-in";
  process.env.FLUTTERWAVE_WEBHOOK_HASH = "agreed-hash-value";
  payments = await import("../src/lib/promotion/payments.js");
});

test.after(() => new Promise((r) => server.close(r)));

test("a campaign cannot be paid for when no provider is configured", async () => {
  const saved = process.env.PAYSTACK_SECRET_KEY;
  delete process.env.PAYSTACK_SECRET_KEY;
  try {
    assert.equal(payments.providerReady(payments.PROVIDERS.PAYSTACK), false);
    await assert.rejects(
      () => payments.initialise({
        provider: payments.PROVIDERS.PAYSTACK, email: "a@b.com",
        amountMinor: 1500000, currency: "NGN", reference: "r1", callbackUrl: "https://x/y",
      }),
      (e) => e.status === 503,
      "it should refuse with 503, not attempt a charge",
    );
  } finally { process.env.PAYSTACK_SECRET_KEY = saved; }
});

test("Paystack is asked for kobo, not naira", async () => {
  seen.length = 0;
  reply = { "/paystack": { status: true, data: { authorization_url: "https://pay/checkout", reference: "r-ps" } } };

  // ₦15,000 — the real 14-day naira price.
  const out = await payments.initialise({
    provider: payments.PROVIDERS.PAYSTACK,
    email: "vendor@example.com", amountMinor: 1500000, currency: "NGN",
    reference: "thp_test_1", callbackUrl: "https://toolhaven.net/back",
    meta: { campaign: "abc" },
  });

  const req = seen.at(-1);
  assert.ok(req.url.endsWith("/transaction/initialize"), `wrong endpoint: ${req.url}`);
  assert.equal(req.method, "POST");
  assert.equal(req.auth, "Bearer sk_test_stand_in");
  assert.equal(req.body.amount, 1500000, "Paystack takes MINOR units — 1500000 kobo is ₦15,000");
  assert.equal(req.body.currency, "NGN");
  assert.equal(req.body.reference, "thp_test_1", "our reference, so we can verify it later");
  assert.equal(req.body.callback_url, "https://toolhaven.net/back");
  assert.equal(out.url, "https://pay/checkout");
});

test("Flutterwave is asked for dollars, not cents", async () => {
  seen.length = 0;
  reply = { "/flutterwave": { status: "success", data: { link: "https://flw/checkout" } } };

  // $27.00 — the real 14-day dollar price.
  const out = await payments.initialise({
    provider: payments.PROVIDERS.FLUTTERWAVE,
    email: "vendor@example.com", amountMinor: 2700, currency: "USD",
    reference: "thp_test_2", callbackUrl: "https://toolhaven.net/back",
  });

  const req = seen.at(-1);
  assert.ok(req.url.endsWith("/payments"), `wrong endpoint: ${req.url}`);
  assert.equal(req.auth, "Bearer FLWSECK_TEST-stand-in");
  assert.equal(req.body.amount, "27.00", "Flutterwave takes MAJOR units — 2700 cents is $27.00");
  assert.equal(req.body.tx_ref, "thp_test_2");
  assert.equal(req.body.redirect_url, "https://toolhaven.net/back");
  assert.equal(out.url, "https://flw/checkout");
});

test("a provider that returns no checkout link is an error, not a silent pass", async () => {
  reply = { "/paystack": { status: true, data: {} } };
  await assert.rejects(
    () => payments.initialise({
      provider: payments.PROVIDERS.PAYSTACK, email: "a@b.com",
      amountMinor: 2700, currency: "NGN", reference: "r3", callbackUrl: "https://x/y",
    }),
    (e) => e.status === 502,
  );
});

test("a successful charge for the right amount verifies as paid", async () => {
  reply = { "/paystack": { status: true, data: { status: "success", amount: 1500000, currency: "NGN", paid_at: "2026-09-21T10:00:00Z" } } };
  const r = await payments.verify({
    provider: payments.PROVIDERS.PAYSTACK, reference: "r4",
    expectMinor: 1500000, expectCurrency: "NGN",
  });
  assert.equal(r.paid, true);
  assert.equal(r.amountMinor, 1500000);
  assert.ok(r.paidAt instanceof Date);
});

test("a successful charge for the WRONG amount does not verify", async () => {
  // The single most valuable assertion here: somebody paid ₦100 for a ₦15,000
  // campaign. The provider is happy. We must not be.
  reply = { "/paystack": { status: true, data: { status: "success", amount: 10000, currency: "NGN" } } };
  const r = await payments.verify({
    provider: payments.PROVIDERS.PAYSTACK, reference: "r5",
    expectMinor: 1500000, expectCurrency: "NGN",
  });
  assert.equal(r.paid, false, "an underpayment must never activate a campaign");
  assert.ok(r.mismatch, `and it should say why (${r.mismatch})`);
});

test("a charge in the wrong currency does not verify", async () => {
  reply = { "/paystack": { status: true, data: { status: "success", amount: 1500000, currency: "USD" } } };
  const r = await payments.verify({
    provider: payments.PROVIDERS.PAYSTACK, reference: "r6",
    expectMinor: 1500000, expectCurrency: "NGN",
  });
  assert.equal(r.paid, false);
});

test("a failed or abandoned charge does not verify", async () => {
  for (const status of ["failed", "abandoned", "pending", "reversed"]) {
    reply = { "/paystack": { status: true, data: { status, amount: 1500000, currency: "NGN" } } };
    const r = await payments.verify({
      provider: payments.PROVIDERS.PAYSTACK, reference: "r7",
      expectMinor: 1500000, expectCurrency: "NGN",
    });
    assert.equal(r.paid, false, `"${status}" must not count as paid`);
  }
});

test("Flutterwave's major-unit answer is converted back before comparing", async () => {
  reply = { "/flutterwave": { status: "success", data: { status: "successful", amount: 27, currency: "USD", created_at: "2026-09-21T10:00:00Z" } } };
  const r = await payments.verify({
    provider: payments.PROVIDERS.FLUTTERWAVE, reference: "r8",
    expectMinor: 2700, expectCurrency: "USD",
  });
  assert.equal(r.paid, true, "27 dollars should satisfy an expectation of 2700 cents");
  assert.equal(r.amountMinor, 2700);
});

test("a Flutterwave underpayment is caught despite the unit change", async () => {
  reply = { "/flutterwave": { status: "success", data: { status: "successful", amount: 2.7, currency: "USD" } } };
  const r = await payments.verify({
    provider: payments.PROVIDERS.FLUTTERWAVE, reference: "r9",
    expectMinor: 2700, expectCurrency: "USD",
  });
  assert.equal(r.paid, false, "$2.70 is not $27.00");
});

test("a Flutterwave reference that was never paid reads as not paid, not as an outage", async () => {
  // Flutterwave answers 404 for a checkout the buyer opened and abandoned.
  // That is an answer, not a failure: someone returning to their dashboard
  // after changing their mind must not be shown a gateway error.
  reply = {}; // nothing stubbed → the stand-in replies 404, as Flutterwave does
  const r = await payments.verify({
    provider: payments.PROVIDERS.FLUTTERWAVE, reference: "never-paid",
    expectMinor: 2700, expectCurrency: "USD",
  });
  assert.equal(r.paid, false);
  assert.equal(r.providerStatus, "not_found");
});

test("an unreachable provider fails as a 502 rather than hanging or passing", async () => {
  const saved = process.env.PAYSTACK_API_BASE;
  process.env.PAYSTACK_API_BASE = "http://127.0.0.1:1/paystack"; // nothing listens here
  try {
    await assert.rejects(
      () => payments.verify({ provider: payments.PROVIDERS.PAYSTACK, reference: "r10", expectMinor: 1, expectCurrency: "NGN" }),
      (e) => e.status === 502,
    );
  } finally { process.env.PAYSTACK_API_BASE = saved; }
});

/* ───────────────────────────── webhooks ───────────────────────────── */

const reqWith = (headers) => ({ get: (n) => headers[n.toLowerCase()] });

test("a Paystack webhook is only believed when correctly signed", async () => {
  const raw = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "r11" } }));
  const good = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(raw).digest("hex");

  assert.equal(
    payments.webhookIsGenuine(payments.PROVIDERS.PAYSTACK, reqWith({ "x-paystack-signature": good }), raw),
    true);

  // Wrong signature, missing signature, and a body altered after signing.
  assert.equal(
    payments.webhookIsGenuine(payments.PROVIDERS.PAYSTACK, reqWith({ "x-paystack-signature": "0".repeat(128) }), raw),
    false);
  assert.equal(
    payments.webhookIsGenuine(payments.PROVIDERS.PAYSTACK, reqWith({}), raw),
    false);
  const tampered = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "SOMEONE_ELSE" } }));
  assert.equal(
    payments.webhookIsGenuine(payments.PROVIDERS.PAYSTACK, reqWith({ "x-paystack-signature": good }), tampered),
    false, "a body changed after signing must be rejected");
});

test("a Flutterwave webhook is only believed when it carries the agreed hash", async () => {
  const raw = Buffer.from(JSON.stringify({ data: { tx_ref: "r12" } }));
  assert.equal(
    payments.webhookIsGenuine(payments.PROVIDERS.FLUTTERWAVE, reqWith({ "verif-hash": "agreed-hash-value" }), raw),
    true);
  assert.equal(
    payments.webhookIsGenuine(payments.PROVIDERS.FLUTTERWAVE, reqWith({ "verif-hash": "wrong" }), raw),
    false);
  assert.equal(
    payments.webhookIsGenuine(payments.PROVIDERS.FLUTTERWAVE, reqWith({}), raw),
    false);
});

test("the reference is read from whichever shape the provider sends", () => {
  assert.equal(
    payments.referenceFromWebhook(payments.PROVIDERS.PAYSTACK, { data: { reference: "abc" } }), "abc");
  assert.equal(
    payments.referenceFromWebhook(payments.PROVIDERS.FLUTTERWAVE, { data: { tx_ref: "xyz" } }), "xyz");
});
