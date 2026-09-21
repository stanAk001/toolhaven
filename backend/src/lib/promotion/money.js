/**
 * Which currency a buyer is charged in, and which provider takes it.
 *
 * Nigerian cards are routinely declined on foreign-currency charges, so a
 * Nigerian buyer pays in naira through Paystack and everyone else pays in
 * dollars through Flutterwave.
 *
 * No exchange rate exists anywhere in this file. Each plan carries a naira
 * price and a dollar price, both typed in by an editor. Converting one into the
 * other would mean picking a rate, and a rate nobody chose is a number nobody
 * can stand behind — it would also move a published price on its own.
 */

export const CURRENCY = {
  NGN: { code: "NGN", minor: 100, symbol: "₦", provider: "paystack" },
  USD: { code: "USD", minor: 100, symbol: "$", provider: "flutterwave" },
};

/**
 * Where is this request coming from?
 *
 * Read from the edge headers the hosts actually set — Vercel and Cloudflare
 * both put a country on every request, which is far more reliable than parsing
 * an IP here. The language header is a weak last resort, and the buyer can
 * override the guess in the UI regardless: this decides a default, not a fact
 * about a person.
 *
 * @returns {{ country: string|null, source: string }}
 */
export function countryOf(req) {
  const header = (name) => (req.get(name) || "").trim().toUpperCase();

  const vercel = header("x-vercel-ip-country");
  if (vercel) return { country: vercel, source: "vercel" };

  const cf = header("cf-ipcountry");
  if (cf && cf !== "XX") return { country: cf, source: "cloudflare" };

  const render = header("x-render-ip-country");
  if (render) return { country: render, source: "render" };

  // e.g. "en-NG,en;q=0.9" — a hint, not a location.
  const lang = (req.get("accept-language") || "").match(/[a-z]{2}-([A-Z]{2})/);
  if (lang) return { country: lang[1].toUpperCase(), source: "language" };

  return { country: null, source: "unknown" };
}

/** The currency to quote, given a country and what the plan is priced in. */
export function currencyFor(country, plan) {
  const hasNgn = Number.isInteger(plan?.priceNgnKobo) && plan.priceNgnKobo > 0;
  const hasUsd = Number.isInteger(plan?.priceUsdCents) && plan.priceUsdCents > 0;

  if (country === "NG" && hasNgn) return CURRENCY.NGN;
  if (hasUsd) return CURRENCY.USD;
  // A plan priced only in naira is still sellable to a Nigerian buyer; to
  // anyone else it simply has no price yet, and must not be guessed at.
  if (hasNgn) return CURRENCY.NGN;
  return null;
}

/** The amount, in the provider's minor units. Never derived from the client. */
export function amountFor(plan, currency) {
  if (!plan || !currency) return null;
  if (currency.code === "NGN") return plan.priceNgnKobo ?? null;
  if (currency.code === "USD") return plan.priceUsdCents ?? null;
  return null;
}

/** "₦15,000" / "$49" — for display only; the charge always uses minor units. */
export function formatMinor(minor, currencyCode) {
  const c = CURRENCY[currencyCode];
  if (!c || !Number.isInteger(minor)) return null;
  const major = minor / c.minor;
  const shown = major % 1 === 0 ? major.toLocaleString("en-US")
    : major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${c.symbol}${shown}`;
}

/**
 * What a plan costs, in both currencies, for a card.
 * A currency the plan has no price in is reported as null rather than zero —
 * "free" and "not priced yet" are different things.
 */
export function pricesOf(plan) {
  return {
    usd: Number.isInteger(plan?.priceUsdCents) && plan.priceUsdCents > 0
      ? { minor: plan.priceUsdCents, currency: "USD", display: formatMinor(plan.priceUsdCents, "USD") }
      : null,
    ngn: Number.isInteger(plan?.priceNgnKobo) && plan.priceNgnKobo > 0
      ? { minor: plan.priceNgnKobo, currency: "NGN", display: formatMinor(plan.priceNgnKobo, "NGN") }
      : null,
  };
}
