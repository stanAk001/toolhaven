/**
 * Fills the response cache before the first reader arrives.
 *
 * On Render's free tier the container spins down when idle, so a real visitor
 * routinely *is* the cold start: they wait for the process to boot, for Prisma
 * to connect, and then for a dozen sequential round trips to Ohio. Warming
 * takes that off the reader and puts it on the boot, where nobody is watching.
 *
 * Deliberately fire-and-forget. A warm-up that fails must never stop the
 * server answering — a slow page is better than no page.
 */
const HOT = [
  "/api/categories",
  "/api/tools?limit=24",
  "/api/tools?featured=true&limit=6",
  "/api/tools/rails",
  "/api/testimonials?limit=7",
  "/api/best",
];

export async function warmCache(port, { log = true } = {}) {
  const base = "http://127.0.0.1:" + port;
  const started = Date.now();
  const results = await Promise.allSettled(
    HOT.map((p) => fetch(base + p).then((r) => r.ok))
  );
  const ok = results.filter((r) => r.status === "fulfilled" && r.value).length;
  if (log) {
    console.log("[cache] warmed " + ok + "/" + HOT.length + " endpoints in " + (Date.now() - started) + "ms");
  }
  return ok;
}
