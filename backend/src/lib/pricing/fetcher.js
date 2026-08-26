/**
 * Fetching the outside world, carefully.
 *
 * Everything that can run away from you is bounded: how long a request may
 * take, how much it may download, how many redirects it may follow, how often
 * one host may be asked, and how many times a failure may be retried. A pricing
 * crawl is a background nicety — it must never be able to hang a request, fill
 * a disk, or get Toolhaven's address blocked by a vendor.
 *
 * Redirects are followed by hand rather than by fetch, because each hop has to
 * go back through the address guard. `redirect: "follow"` would happily walk a
 * public URL to a private one.
 */
import { assertSafeUrl, UnsafeUrlError } from "./urlguard.js";

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 3 * 1024 * 1024;  // pricing pages are text; 3MB is generous
const MAX_REDIRECTS = 4;
const PER_HOST_GAP_MS = 1_500;      // politeness: no more than ~40 requests/min/host

// Identifies the crawler honestly and points at a page explaining it, so a
// vendor who sees it in their logs can tell what it is and ask us to stop.
const UA = "ToolhavenPricingBot/1.0 (+https://www.toolhaven.net/how-we-review)";

const lastHit = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function politeDelay(host) {
  const prev = lastHit.get(host) || 0;
  const wait = prev + PER_HOST_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

/** Read a response body up to a hard cap, so a huge page cannot exhaust memory. */
async function readCapped(res) {
  const reader = res.body?.getReader?.();
  if (!reader) return (await res.text()).slice(0, MAX_BYTES);

  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) { await reader.cancel().catch(() => {}); break; }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(
    chunks.length === 1 ? chunks[0] : Buffer.concat(chunks.map((c) => Buffer.from(c)))
  );
}

/**
 * GET a page and return its text, or a structured reason it could not.
 * Never throws for an expected failure — the caller logs the outcome.
 *
 * @returns {{ok: boolean, status?: number, html?: string, finalUrl?: string,
 *            outcome: string, detail?: string, durationMs: number}}
 */
export async function fetchPage(rawUrl, { timeoutMs = TIMEOUT_MS } = {}) {
  const started = Date.now();
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let safe;
    try {
      safe = await assertSafeUrl(current);
    } catch (err) {
      return {
        ok: false,
        outcome: err instanceof UnsafeUrlError ? "blocked" : "error",
        detail: err.message,
        durationMs: Date.now() - started,
      };
    }

    await politeDelay(safe.url.hostname);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(safe.url.href, {
        redirect: "manual",           // every hop gets re-checked, see above
        signal: ac.signal,
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });
    } catch (err) {
      clearTimeout(timer);
      const timedOut = err.name === "AbortError";
      return {
        ok: false,
        outcome: timedOut ? "timeout" : "error",
        detail: timedOut ? `no response in ${timeoutMs}ms` : String(err.message || err).slice(0, 300),
        durationMs: Date.now() - started,
      };
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        return { ok: false, outcome: "error", status: res.status, detail: "redirect without a location", durationMs: Date.now() - started };
      }
      current = new URL(location, safe.url).href;   // relative redirects are legal
      continue;
    }

    if (res.status === 429 || res.status === 403) {
      return { ok: false, outcome: "blocked", status: res.status, finalUrl: safe.url.href,
               detail: `host answered ${res.status}`, durationMs: Date.now() - started };
    }
    if (!res.ok) {
      return { ok: false, outcome: "error", status: res.status, finalUrl: safe.url.href,
               detail: `HTTP ${res.status}`, durationMs: Date.now() - started };
    }

    const type = res.headers.get("content-type") || "";
    if (!/text\/html|application\/(xhtml|json)/i.test(type)) {
      return { ok: false, outcome: "error", status: res.status, finalUrl: safe.url.href,
               detail: `unexpected content-type ${type.slice(0, 60)}`, durationMs: Date.now() - started };
    }

    const html = await readCapped(res);
    return { ok: true, status: res.status, html, finalUrl: safe.url.href,
             outcome: "success", durationMs: Date.now() - started };
  }

  return { ok: false, outcome: "error", detail: "too many redirects", durationMs: Date.now() - started };
}

export const _internals = { MAX_BYTES, MAX_REDIRECTS, TIMEOUT_MS, PER_HOST_GAP_MS, UA };
