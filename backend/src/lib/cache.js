/**
 * Response caching for the public read endpoints.
 *
 * The numbers that made this necessary: a single round trip to the database in
 * Ohio costs ~250ms, and Prisma spends several of them per request once
 * relations are included. `/api/tools/:slug` measured 7s cold and ~1.7s warm in
 * production, for data that changes when an editor edits it and at no other
 * time. Nothing here makes the queries faster; it stops most requests from
 * running them at all.
 *
 * Two layers, because they solve different halves:
 *   - an in-process store, so the second reader never pays what the first paid
 *   - a Cache-Control header, so a reader moving between pages does not even
 *     open a connection
 *
 * Freshness is handled by a version counter rather than by timeouts. Any write
 * anywhere under /api bumps it, every cache key contains it, and so an editor's
 * change invalidates the whole server cache the instant it is saved. The only
 * staleness left is the browser's own max-age, which is deliberately short.
 */

const store = new Map();
let version = 1;

export const bumpVersion = () => { version++; store.clear(); };
export const cacheVersion = () => version;

// A hit that is older than this is dropped rather than served; the version
// counter handles correctness, this only stops the map growing without bound.
const MAX_AGE_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;

function sweep() {
  if (store.size <= MAX_ENTRIES) return;
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const [k, v] of store) if (v.at < cutoff) store.delete(k);
  // still oversized: drop oldest first
  if (store.size > MAX_ENTRIES) {
    const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at);
    for (let i = 0; i < oldest.length - MAX_ENTRIES; i++) store.delete(oldest[i][0]);
  }
}

/**
 * Cache this route's JSON for `seconds`.
 *
 * Skips anything that is not a plain public GET: an authenticated request gets
 * its own live answer, because an editor checking their own change must never
 * be shown the version a reader is being served.
 */
export function cached(seconds = 60) {
  return function cacheMiddleware(req, res, next) {
    if (req.method !== "GET" || req.get("x-admin-token")) {
      res.set("Cache-Control", "no-store");
      return next();
    }

    const key = version + " " + req.originalUrl;
    const hit = store.get(key);
    if (hit) {
      res.set("Cache-Control", `public, max-age=${seconds}, stale-while-revalidate=300`);
      res.set("X-Cache", "hit");
      return res.json(hit.body);
    }

    const send = res.json.bind(res);
    res.json = (body) => {
      // Only a success is worth keeping. Caching a 500 turns a blip into an outage.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(key, { body, at: Date.now() });
        sweep();
      }
      res.set("Cache-Control", `public, max-age=${seconds}, stale-while-revalidate=300`);
      res.set("X-Cache", "miss");
      return send(body);
    };
    next();
  };
}

/**
 * Express middleware: an editor's write invalidates every cached read.
 *
 * Only an editor's. The first version of this dropped the cache on any
 * non-GET, which sounds safe until you notice that logging an outbound
 * affiliate click is a POST — so every reader who clicked a "Get it" button
 * wiped the cache for everyone, and the site was slow again by lunchtime.
 * Reader writes (clicks, newsletter sign-ups, contact, tool submissions, and
 * reviews, which arrive pending) change nothing that is publicly visible, so
 * they leave the cache alone.
 */
export function invalidateOnWrite(req, _res, next) {
  const isWrite = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
  if (isWrite && req.get("x-admin-token")) bumpVersion();
  next();
}

export const cacheStats = () => ({ entries: store.size, version });
