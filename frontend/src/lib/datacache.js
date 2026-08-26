/**
 * A small stale-while-revalidate cache sitting under `useData`.
 *
 * The problem it solves is the one you feel rather than measure: every page
 * mounted its own fetch from zero, so going Home -> a tool -> Back re-ran three
 * requests that had already been answered, and each one put a spinner on screen
 * first. Navigation felt slow even when the network was fine.
 *
 * With this, a page you have already seen renders from memory on the same frame
 * it mounts, and a background request quietly checks whether anything moved.
 * You only ever watch a spinner for data this browser has genuinely never seen.
 *
 * Deliberately not a dependency. The whole contract is: read, write, dedupe,
 * expire — and being able to read it in one sitting is worth more here than the
 * features a library would add.
 */

const store = new Map();   // key -> { data, at }
const inflight = new Map(); // key -> Promise, so two components share one request

const TTL = 5 * 60 * 1000;      // beyond this, revalidate before trusting it
const MAX_ENTRIES = 120;

/**
 * A stable identity for a call site. `fn.toString()` is the source text of the
 * closure, which is fixed per call site (and stays fixed after minification),
 * and the deps distinguish one slug from another. Two call sites that really
 * are identical share an entry, which is exactly what you want — the same
 * request twice should not be two requests.
 */
export const keyFor = (fn, deps) => {
  try { return String(fn) + "|" + JSON.stringify(deps); }
  catch { return String(fn) + "|?"; }
};

export const peek = (key) => (store.has(key) ? store.get(key).data : undefined);
export const isFresh = (key) => {
  const hit = store.get(key);
  return !!hit && Date.now() - hit.at < TTL;
};

export function write(key, data) {
  store.set(key, { data, at: Date.now() });
  if (store.size > MAX_ENTRIES) {
    // drop the oldest; this is a browsing session, not a database
    const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at);
    for (let i = 0; i < oldest.length - MAX_ENTRIES; i++) store.delete(oldest[i][0]);
  }
}

/** Run `fn` once per key even if several components ask at the same moment. */
export function load(key, fn) {
  const running = inflight.get(key);
  if (running) return running;

  const p = Promise.resolve()
    .then(fn)
    .then((data) => { write(key, data); return data; })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

/** Warm an entry ahead of time. Never throws — a failed guess costs nothing. */
export function prefetch(fn, deps = []) {
  const key = keyFor(fn, deps);
  if (isFresh(key) || inflight.has(key)) return;
  load(key, fn).catch(() => {});
}

/** After a write of our own — a posted review, say — stop trusting what we hold. */
export function clearDataCache(match) {
  if (!match) { store.clear(); return; }
  for (const k of [...store.keys()]) if (k.includes(match)) store.delete(k);
}

export const cacheSize = () => store.size;
