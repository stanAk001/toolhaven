/**
 * Keeping prices current without anyone remembering to.
 *
 * A small in-process worker: every few minutes it takes the handful of tools
 * whose next check is due and works through them one at a time. Deliberately
 * unhurried — the fetcher already spaces requests per host, and there is no
 * deadline here worth being rude to a vendor's servers over.
 *
 * It runs inside the API process rather than as a separate service, because
 * Toolhaven is one Render instance and a second one would be a system to
 * operate rather than a feature to use. The claim below is what stops two
 * instances doing the same tool if that ever changes.
 */
import { prisma } from "../prisma.js";
import { verifyToolPricing } from "./service.js";

const TICK_MS = 5 * 60 * 1000;    // look for due work every five minutes
const BATCH = 3;                  // and never take on much at once
const START_DELAY_MS = 60 * 1000; // let the server finish booting first

let timer = null;
let running = false;

export const stats = { ticks: 0, checked: 0, published: 0, failed: 0, lastRunAt: null, lastError: null };

/** Tools that are due, most popular first, with never-checked ones included. */
async function dueTools(limit) {
  const now = new Date();
  return prisma.tool.findMany({
    where: {
      isActive: true,
      websiteUrl: { not: null },
      OR: [
        { pricing: { is: null } },
        { pricing: { nextVerificationAt: { lte: now } } },
      ],
    },
    select: { id: true, name: true, slug: true, websiteUrl: true },
    orderBy: [{ popularity: "desc" }],
    take: limit,
  });
}

export async function runOnce({ limit = BATCH, log = true } = {}) {
  if (running) return { skipped: "a run is already in progress" };
  running = true;
  stats.ticks++;
  const started = Date.now();
  const results = [];

  try {
    const tools = await dueTools(limit);
    for (const tool of tools) {
      // Claim it before doing the work, so a second instance picks something
      // else and a crash cannot leave a tool being retried in a tight loop.
      await prisma.toolPricing.upsert({
        where: { toolId: tool.id },
        update: { lastAttemptedAt: new Date(), nextVerificationAt: new Date(Date.now() + 3600_000) },
        create: { toolId: tool.id, lastAttemptedAt: new Date(), nextVerificationAt: new Date(Date.now() + 3600_000) },
      }).catch(() => {});

      try {
        const r = await verifyToolPricing(tool);
        stats.checked++;
        if (r.published) stats.published++;
        if (r.outcome !== "success") stats.failed++;
        results.push({ tool: tool.slug, ...r });
      } catch (err) {
        stats.failed++;
        stats.lastError = String(err?.message || err).slice(0, 200);
        results.push({ tool: tool.slug, outcome: "error" });
      }
    }
    stats.lastRunAt = new Date();
    if (log && results.length) {
      const published = results.filter((r) => r.published).length;
      console.log(`[pricing] checked ${results.length} tool(s) in ${Math.round((Date.now() - started) / 1000)}s, ${published} publishable`);
    }
    return { checked: results.length, results };
  } finally {
    running = false;
  }
}

export function startPricingWorker() {
  if (timer) return;
  if (process.env.PRICING_WORKER === "off") {
    console.log("[pricing] background worker disabled by PRICING_WORKER=off");
    return;
  }
  // A crawl must never be able to take the API down with it.
  const tick = () => runOnce().catch((err) => { stats.lastError = String(err?.message || err).slice(0, 200); });
  setTimeout(tick, START_DELAY_MS).unref?.();
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
  console.log("[pricing] background worker started");
}

export function stopPricingWorker() {
  if (timer) { clearInterval(timer); timer = null; }
}
