/**
 * Geo resolution: the buyer's country decides the currency and the provider,
 * and the buyer is never asked. These tests cover the orderings that decide
 * whether a Nigerian buyer lands on Paystack or is quietly put on the dollar
 * rail — which is the failure this module exists to prevent.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { resolveCountry, clientIp, clearGeoCache } from "../src/lib/promotion/geo.js";
import { currencyFor } from "../src/lib/promotion/money.js";

/** A stand-in for an Express request carrying the headers we care about. */
const reqWith = (headers = {}, ip = "8.8.8.8") => ({
  ip,
  get(name) {
    const k = Object.keys(headers).find((h) => h.toLowerCase() === name.toLowerCase());
    return k ? headers[k] : undefined;
  },
});

const NGN_PLAN = { priceNgnKobo: 3_000_000, priceUsdCents: 4900 };

test("an edge header wins, and costs no lookup", async () => {
  clearGeoCache();
  const { country, source } = await resolveCountry(reqWith({ "x-vercel-ip-country": "NG" }));
  assert.equal(country, "NG");
  assert.equal(source, "vercel");
  assert.equal(currencyFor(country, NGN_PLAN).provider, "paystack");
});

test("Cloudflare's header is read, and its 'unknown' value is not believed", async () => {
  clearGeoCache();
  assert.equal((await resolveCountry(reqWith({ "cf-ipcountry": "GB" }))).country, "GB");

  // XX means Cloudflare could not tell; treating it as a country would be a lie.
  // With every lookup failing, the language header is the last thing left — and
  // it is reported as the guess it is, not as a measurement.
  clearGeoCache();
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("no network"); };
  try {
    const xx = await resolveCountry(reqWith({ "cf-ipcountry": "XX", "accept-language": "en-NG,en;q=0.9" }, "127.0.0.1"));
    assert.notEqual(xx.country, "XX");
    assert.equal(xx.country, "NG");
    assert.equal(xx.source, "language");
  } finally { globalThis.fetch = original; }
});

test("a private address is never sent to a geo service", async () => {
  clearGeoCache();
  const asked = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    return { ok: true, json: async () => ({ country_code: "NG" }) };
  };
  try {
    for (const ip of ["127.0.0.1", "::1", "10.0.0.5", "192.168.1.7", "172.16.4.2", "169.254.1.1"]) {
      clearGeoCache();
      await resolveCountry(reqWith({}, ip));
    }
    // A LAN address is meaningless to a geo service and must never be sent.
    for (const url of asked) {
      assert.ok(!/127\.0\.0\.1|::1|10\.0\.0\.5|192\.168|172\.16|169\.254/.test(url),
        `a private address leaked into a lookup: ${url}`);
    }
  } finally { globalThis.fetch = original; }
});

test("a request from this machine resolves to this machine's own location", async () => {
  // Someone developing in Lagos with the site on localhost is a Nigerian
  // visitor. Answering "unknown" there sent them to the dollar rail and looked
  // exactly like broken detection.
  clearGeoCache();
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ country_code: "NG" }) });
  try {
    const r = await resolveCountry(reqWith({}, "::1"));
    assert.equal(r.country, "NG");
    assert.equal(r.source, "self");
    assert.equal(currencyFor(r.country, NGN_PLAN).provider, "paystack");

    const again = await resolveCountry(reqWith({}, "127.0.0.1"));
    assert.equal(again.source, "self-cache", "and it is not asked again per request");
  } finally { globalThis.fetch = original; }
});

test("a real visitor's address is still used, not this machine's", async () => {
  clearGeoCache();
  const asked = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    return { ok: true, json: async () => ({ country_code: "GB" }) };
  };
  try {
    const r = await resolveCountry(reqWith({}, "102.89.34.10"));
    assert.equal(r.source, "ip", "a public address must take the per-IP path");
    assert.ok(asked.some((u) => u.includes("102.89.34.10")), "and the visitor's own address is what is looked up");
  } finally { globalThis.fetch = original; }
});

test("a real address is looked up, and the answer is cached rather than asked twice", async () => {
  clearGeoCache();
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ country_code: "ng" }) };
  };
  try {
    const first = await resolveCountry(reqWith({}, "102.89.34.10"));
    assert.equal(first.country, "NG", "lower-case answers are normalised");
    assert.equal(first.source, "ip");

    const second = await resolveCountry(reqWith({}, "102.89.34.10"));
    assert.equal(second.country, "NG");
    assert.equal(second.source, "ip-cache");
    assert.equal(calls, 1, "the second request must not hit the service again");

    assert.equal(currencyFor(first.country, NGN_PLAN).code, "NGN");
    assert.equal(currencyFor(first.country, NGN_PLAN).provider, "paystack");
  } finally { globalThis.fetch = original; }
});

test("a failing geo service never breaks the page, and is not retried per request", async () => {
  clearGeoCache();
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { calls++; throw new Error("network down"); };
  try {
    const r = await resolveCountry(reqWith({}, "45.12.9.1"));
    assert.equal(r.country, null);
    assert.equal(r.source, "unknown");

    await resolveCountry(reqWith({}, "45.12.9.1"));
    assert.equal(calls, 1, "a miss is cached too, so a broken service is asked once");

    // And an unknown country still has a currency to fall back on.
    assert.equal(currencyFor(null, NGN_PLAN).code, "USD");
    assert.equal(currencyFor(null, NGN_PLAN).provider, "flutterwave");
  } finally { globalThis.fetch = original; }
});

test("a malformed answer is rejected rather than used as a country", async () => {
  clearGeoCache();
  const original = globalThis.fetch;
  for (const body of [{ country_code: "NIGERIA" }, { country_code: 42 }, {}, { error: true }]) {
    clearGeoCache();
    globalThis.fetch = async () => ({ ok: true, json: async () => body });
    const r = await resolveCountry(reqWith({}, "45.12.9.2"));
    assert.equal(r.country, null, `${JSON.stringify(body)} must not produce a country`);
  }
  globalThis.fetch = original;
});

test("the forwarded address is preferred over the socket address", () => {
  assert.equal(clientIp(reqWith({ "x-forwarded-for": "102.89.1.1, 10.0.0.1" }, "10.0.0.1")), "102.89.1.1");
  assert.equal(clientIp(reqWith({}, "::ffff:102.89.1.2")), "102.89.1.2");
});

test("non-Nigerian buyers are charged in dollars through Flutterwave", async () => {
  clearGeoCache();
  for (const cc of ["US", "GB", "DE", "KE", "ZA"]) {
    const { country } = await resolveCountry(reqWith({ "x-vercel-ip-country": cc }));
    const c = currencyFor(country, NGN_PLAN);
    assert.equal(c.code, "USD", `${cc} should be quoted in dollars`);
    assert.equal(c.provider, "flutterwave");
  }
});
