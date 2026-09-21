/**
 * Taking money, and being certain it arrived.
 *
 * Paystack for naira, Flutterwave for dollars. Two providers because Nigerian
 * cards are routinely declined on foreign-currency charges, and a checkout that
 * declines is not a checkout.
 *
 * The rule the whole file is built around: **a campaign never goes live because
 * a browser said the payment worked.** A redirect back from a provider is a
 * navigation, and anyone can type one. The only thing that moves a payment to
 * PAID is our own server calling the provider's verify endpoint and getting an
 * amount and a currency that match what we recorded when we started.
 *
 * Four attacks this closes:
 *
 *   tampered price     the amount is read from the plan row at initialise time
 *                      and re-checked against the provider's answer. A price
 *                      posted from a browser is never used for anything.
 *   forged callback    the success page proves nothing; verification is a
 *                      server-to-server call keyed on our own reference.
 *   replayed webhook   the reference is unique per provider, and a payment
 *                      already marked PAID short-circuits. A webhook delivered
 *                      five times settles once.
 *   forged webhook     Paystack signs the raw body with the secret key;
 *                      Flutterwave sends an agreed hash. Neither is trusted
 *                      without that check passing.
 *
 * One asymmetry worth remembering: Paystack charges in minor units (kobo),
 * Flutterwave in major units (naira, dollars). Getting that backwards charges
 * someone a hundred times too much, so the conversion happens in exactly one
 * place per provider and nowhere else.
 */
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

// Overridable so the integration can be exercised against a stand-in provider.
// Without this the only way to find out whether the request shapes and the
// minor/major unit handling are right is to make a real charge with real keys
// — which is a bad moment to discover an off-by-one-hundred.
//
// These are read at call time, not at import, so a test can point them
// somewhere else after the module has loaded.
const PAYSTACK_API = () => process.env.PAYSTACK_API_BASE || "https://api.paystack.co";
const FLUTTERWAVE_API = () => process.env.FLUTTERWAVE_API_BASE || "https://api.flutterwave.com/v3";

export const PROVIDERS = { PAYSTACK: "paystack", FLUTTERWAVE: "flutterwave" };

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  ABANDONED: "ABANDONED",
  REFUNDED: "REFUNDED",
};

/** Is a provider configured at all? Checked before a plan is offered for sale. */
export function providerReady(provider) {
  if (provider === PROVIDERS.PAYSTACK) return Boolean(process.env.PAYSTACK_SECRET_KEY);
  if (provider === PROVIDERS.FLUTTERWAVE) return Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
  return false;
}

/** Our own reference. Unguessable, and carries no internal id. */
export function newReference(prefix = "thp") {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(9).toString("hex")}`;
}

async function call(url, opts, what) {
  let res;
  try {
    res = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
  } catch (err) {
    const e = new Error(`Couldn't reach the payment provider. Please try again.`);
    e.status = 502; e.cause = err; e.detail = `${what}: ${err.message}`;
    throw e;
  }
  let body = null;
  try { body = await res.json(); } catch { /* handled below */ }
  if (!res.ok || !body) {
    const e = new Error(body?.message || "The payment provider rejected that request.");
    e.status = 502; e.detail = `${what}: HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`;
    throw e;
  }
  return body;
}

/* ───────────────────────────── initialise ───────────────────────────── */

/**
 * Open a payment with the right provider.
 *
 * @param {object} p
 * @param {string} p.provider
 * @param {string} p.email        the tool owner's address, from their session
 * @param {number} p.amountMinor  read from the plan row, never from the client
 * @param {string} p.currency     "NGN" | "USD"
 * @param {string} p.reference    ours, generated above
 * @param {string} p.callbackUrl  where the buyer is sent afterwards
 * @param {object} p.meta         campaign slug etc., for the provider dashboard
 * @returns {Promise<{ url: string, reference: string }>}
 */
export async function initialise({ provider, email, amountMinor, currency, reference, callbackUrl, meta = {} }) {
  if (!providerReady(provider)) {
    const e = new Error("Card payments aren't configured yet. Please contact us to arrange this campaign.");
    e.status = 503;
    throw e;
  }

  if (provider === PROVIDERS.PAYSTACK) {
    // Paystack wants minor units, which is what we already hold.
    const body = await call(`${PAYSTACK_API()}/transaction/initialize`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email, amount: amountMinor, currency, reference,
        callback_url: callbackUrl, metadata: meta,
      }),
    }, "paystack initialize");

    const url = body?.data?.authorization_url;
    if (!url) { const e = new Error("The payment provider didn't return a checkout link."); e.status = 502; throw e; }
    return { url, reference: body.data.reference || reference };
  }

  // Flutterwave wants major units — the one place this division happens.
  const body = await call(`${FLUTTERWAVE_API()}/payments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: reference,
      amount: (amountMinor / 100).toFixed(2),
      currency,
      redirect_url: callbackUrl,
      customer: { email },
      meta,
      customizations: { title: "Toolhaven Promote" },
    }),
  }, "flutterwave payments");

  const url = body?.data?.link;
  if (!url) { const e = new Error("The payment provider didn't return a checkout link."); e.status = 502; throw e; }
  return { url, reference };
}

/* ────────────────────────────── verify ─────────────────────────────── */

/**
 * Ask the provider what really happened.
 *
 * Returns a normalised result. `paid` is true only when the provider says the
 * transaction succeeded **and** the amount and currency match what we asked
 * for — a successful charge for the wrong amount is not the charge we sold.
 *
 * @returns {Promise<{ paid: boolean, providerStatus: string, amountMinor: number|null, currency: string|null, paidAt: Date|null, mismatch?: string }>}
 */
export async function verify({ provider, reference, expectMinor, expectCurrency }) {
  if (provider === PROVIDERS.PAYSTACK) {
    const body = await call(`${PAYSTACK_API()}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    }, "paystack verify");

    const d = body?.data || {};
    const amountMinor = Number.isFinite(d.amount) ? d.amount : null;
    return settle({
      providerStatus: String(d.status || "unknown"),
      succeeded: d.status === "success",
      amountMinor,
      currency: d.currency || null,
      paidAt: d.paid_at ? new Date(d.paid_at) : null,
      expectMinor, expectCurrency,
    });
  }

  // A reference Flutterwave has never seen means the buyer opened the checkout
  // and never paid — they closed the tab, or the card was never submitted.
  // Flutterwave reports that as a 404, which the generic helper turns into a
  // 502 "couldn't reach the provider". It reached the provider perfectly well;
  // the answer was "no such payment". Paystack says "abandoned" and settles
  // cleanly, and someone returning to their dashboard after changing their
  // mind should get the same calm answer on either rail, not a gateway error.
  let body;
  try {
    body = await call(
      `${FLUTTERWAVE_API()}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      { headers: { authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } },
      "flutterwave verify",
    );
  } catch (err) {
    if (/HTTP 404|no transaction was found/i.test(err.detail || err.message || "")) {
      return settle({
        providerStatus: "not_found",
        succeeded: false,
        amountMinor: null, currency: null, paidAt: null,
        expectMinor, expectCurrency,
      });
    }
    throw err;
  }

  const d = body?.data || {};
  // Flutterwave reports major units; bring it back to ours before comparing.
  const amountMinor = Number.isFinite(Number(d.amount)) ? Math.round(Number(d.amount) * 100) : null;
  return settle({
    providerStatus: String(d.status || "unknown"),
    succeeded: String(d.status).toLowerCase() === "successful",
    amountMinor,
    currency: d.currency || null,
    paidAt: d.created_at ? new Date(d.created_at) : null,
    expectMinor, expectCurrency,
  });
}

/**
 * Decide whether a provider's answer is the transaction we sold.
 *
 * Exported so it can be tested directly: this is the function standing between
 * a tampered amount and a live campaign, and it should not only be reachable
 * through a network call.
 */
export function settle({ providerStatus, succeeded, amountMinor, currency, paidAt, expectMinor, expectCurrency }) {
  const out = { paid: false, providerStatus, amountMinor, currency, paidAt };
  if (!succeeded) return out;

  // Underpayment is the attack; overpayment is a support ticket. Neither is
  // the transaction we agreed to, so neither activates a campaign by itself.
  if (Number.isInteger(expectMinor) && amountMinor !== expectMinor) {
    out.mismatch = `expected ${expectMinor}, provider reported ${amountMinor}`;
    return out;
  }
  if (expectCurrency && currency && currency.toUpperCase() !== expectCurrency.toUpperCase()) {
    out.mismatch = `expected ${expectCurrency}, provider reported ${currency}`;
    return out;
  }
  out.paid = true;
  return out;
}

/* ────────────────────────────── webhooks ───────────────────────────── */

/** Constant-time compare, so a wrong signature leaks nothing by how long it took. */
function sameSecret(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  if (x.length !== y.length || !x.length) return false;
  return timingSafeEqual(x, y);
}

/**
 * Is this webhook really from the provider?
 *
 * Paystack signs the exact bytes of the body with the secret key, so the raw
 * buffer is required — re-serialising the parsed JSON changes the bytes and
 * the signature will never match. Flutterwave sends a hash agreed in their
 * dashboard.
 *
 * @param {Buffer|string} rawBody  the unparsed request body
 */
export function webhookIsGenuine(provider, req, rawBody) {
  if (provider === PROVIDERS.PAYSTACK) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return false;
    const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
    return sameSecret(expected, req.get("x-paystack-signature"));
  }
  if (provider === PROVIDERS.FLUTTERWAVE) {
    const secret = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    if (!secret) return false;
    return sameSecret(secret, req.get("verif-hash"));
  }
  return false;
}

/** Pull our reference out of a webhook payload, whatever shape it arrived in. */
export function referenceFromWebhook(provider, payload) {
  if (provider === PROVIDERS.PAYSTACK) return payload?.data?.reference || null;
  return payload?.data?.tx_ref || payload?.txRef || null;
}
