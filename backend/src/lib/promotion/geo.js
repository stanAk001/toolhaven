/**
 * Where is this buyer? — resolved server-side, once, and never asked of the client.
 *
 * The country decides two things that must always agree: the currency a price
 * is quoted in, and the provider that takes the card. A Nigerian buyer pays
 * naira through Paystack; everyone else pays dollars through Flutterwave. The
 * buyer is never shown a switch, because a switch is a question they have no
 * reason to answer and a way to end up charged in a currency their bank will
 * decline.
 *
 * Why this file exists at all, rather than just reading a header:
 *
 * The browser calls the API host directly. Vercel's edge is not in that path,
 * so `x-vercel-ip-country` is never set in production, and Render sets no
 * country header of its own. That leaves `accept-language`, which reports
 * "en-US" for most Nigerian users — so header-only detection would quietly put
 * every Nigerian buyer on the dollar rail. Hence a real lookup against the
 * request's IP, with the headers kept as a fast path for the day a CDN does
 * sit in front.
 *
 * Three rules it follows:
 *   - it never throws, and never blocks a checkout: a failed lookup is `null`,
 *     and null falls through to the dollar default rather than to an error
 *   - it is cached per IP, because the answer does not change between the page
 *     view and the payment, and the free services are rate limited
 *   - it has a hard timeout, because a slow third party must not become a slow
 *     checkout
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 5000;
// Measured: a live lookup against the default service answers in ~1.4s, so a
// 1.5s budget would have timed out roughly half the time and quietly dropped
// Nigerian buyers onto the dollar rail. This is paid once per address per day.
const LOOKUP_TIMEOUT_MS = 2500;

const cache = new Map();

/** Anything that cannot belong to a real visitor: localhost, LAN, CGNAT. */
function isPrivate(ip) {
  if (!ip) return true;
  const v = ip.replace(/^::ffff:/, "");
  if (v === "::1" || v === "127.0.0.1" || v === "localhost") return true;
  if (/^10\./.test(v)) return true;
  if (/^192\.168\./.test(v)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(v)) return true;
  if (/^169\.254\./.test(v)) return true;
  if (/^f[cd]/i.test(v)) return true; // unique-local IPv6
  return false;
}

/** The caller's address, trusting exactly one proxy hop (set in server.js). */
export function clientIp(req) {
  const fwd = (req.get("x-forwarded-for") || "").split(",")[0].trim();
  return (fwd || req.ip || "").replace(/^::ffff:/, "");
}

function cached(ip) {
  const hit = cache.get(ip);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(ip); return undefined; }
  return hit.country;
}

function remember(ip, country) {
  if (cache.size >= MAX_ENTRIES) {
    // Drop the oldest tenth rather than clearing: a busy minute should not cost
    // every buyer currently mid-checkout their cached answer.
    const old = [...cache.entries()].sort((a, b) => a[1].at - b[1].at);
    for (let i = 0; i < Math.ceil(MAX_ENTRIES / 10); i++) cache.delete(old[i][0]);
  }
  cache.set(ip, { country, at: Date.now() });
}

/**
 * Ask a geo-IP service for a two-letter country code.
 *
 * The endpoint is configurable so this can be pointed at a paid provider
 * without a code change; `{ip}` is substituted. Any failure — network, rate
 * limit, malformed answer, timeout — returns null, and null is a perfectly
 * good answer here.
 */
async function lookup(ip) {
  // `ip === null` asks the service where *this machine* is, which is the right
  // question when the caller is on localhost — see resolveCountry below.
  const url = ip === null
    ? (process.env.GEOIP_SELF_URL || "https://ipapi.co/json/")
    : (process.env.GEOIP_URL || "https://ipapi.co/{ip}/json/").replace("{ip}", encodeURIComponent(ip));

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: abort.signal,
      headers: { accept: "application/json", "user-agent": "toolhaven/1.0" },
    });
    if (!res.ok) return null;
    const body = await res.json();
    // Different services name it differently; accept the usual spellings.
    const code = body?.country_code || body?.countryCode || body?.country;
    if (typeof code !== "string" || !/^[A-Za-z]{2}$/.test(code)) return null;
    return code.toUpperCase();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The country for this request, with where the answer came from.
 *
 * Order matters: an edge header is authoritative and free, so it wins; the IP
 * lookup is the one that actually does the work in production; the language
 * header is a last hint and is marked as such, so a caller can tell a guess
 * from a measurement.
 *
 * @returns {Promise<{ country: string|null, source: string }>}
 */
export async function resolveCountry(req) {
  const header = (name) => (req.get(name) || "").trim().toUpperCase();

  // A deliberate override, for working on this locally.
  //
  // On a dev machine the caller is ::1, which is correctly never sent to a geo
  // service — so a developer in Lagos sees dollars and reasonably concludes the
  // detection is broken. Setting GEO_COUNTRY=NG in backend/.env makes the
  // server answer as though the request came from there. It is read from the
  // environment and never from the request, so a visitor cannot set it.
  const forced = (process.env.GEO_COUNTRY || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(forced)) return { country: forced, source: "override" };

  const vercel = header("x-vercel-ip-country");
  if (vercel && vercel !== "XX") return { country: vercel, source: "vercel" };

  const cf = header("cf-ipcountry");
  if (cf && cf !== "XX") return { country: cf, source: "cloudflare" };

  const ip = clientIp(req);

  if (isPrivate(ip)) {
    // The caller is on this machine — a developer with the site open on
    // localhost, or a health check. Their address says nothing, but the
    // question "where is this visitor?" still has a real answer: they are
    // sitting at this computer, so it is this computer's own public location.
    //
    // Without this, working on the site in Lagos showed dollars and Paystack
    // never appeared, which looks exactly like broken detection. In production
    // the caller's address is real and this branch is never taken.
    const hit = cached("self");
    if (hit !== undefined) return { country: hit, source: hit ? "self-cache" : "unknown" };

    const mine = await lookup(null);
    remember("self", mine);
    if (mine) return { country: mine, source: "self" };
  } else {
    const hit = cached(ip);
    if (hit !== undefined) return { country: hit, source: hit ? "ip-cache" : "unknown" };

    const found = await lookup(ip);
    remember(ip, found); // cache the misses too, so a broken service is asked once
    if (found) return { country: found, source: "ip" };
  }

  const lang = (req.get("accept-language") || "").match(/[a-z]{2}-([A-Z]{2})/);
  if (lang) return { country: lang[1].toUpperCase(), source: "language" };

  return { country: null, source: "unknown" };
}

/** For tests and for the admin diagnostics view. */
export const geoCacheStats = () => ({ entries: cache.size });
export const clearGeoCache = () => cache.clear();
