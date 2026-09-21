/**
 * The job that starts and finishes campaigns.
 *
 * Built like the pricing worker beside it: one interval, gated by an
 * environment variable so only one process runs it, and every pass is
 * idempotent. Running it twice does nothing the first pass did not.
 *
 * Worth being clear about what this is *not* responsible for: a campaign does
 * not stop appearing because this ran. Every promotional query already bounds
 * itself by the campaign window, so a finished campaign is invisible the
 * moment its end time passes, whether this job is running, late, or has never
 * started. What the job adds is the paperwork — the status, the final report,
 * and the emails — which is the part that can safely be a minute behind.
 */
import { prisma } from "../prisma.js";
import { STATUS } from "./lifecycle.js";
import { analyticsFor } from "./campaigns.js";
import { audit } from "./campaigns.js";
import { purgeExpired } from "./owner.js";
import { sendLive, sendEndingSoon, sendCompleted } from "./campaignmail.js";

const TICK_MS = 5 * 60 * 1000;
let timer = null;

const withNames = {
  include: { tool: { select: { name: true } }, plan: { select: { name: true } } },
};

/** Start anything whose hour has come. */
async function activate(now) {
  const due = await prisma.promotionCampaign.findMany({
    where: {
      status: { in: [STATUS.SCHEDULED, STATUS.APPROVED] },
      startDate: { lte: now },
      endDate: { gt: now },
    },
    ...withNames,
    take: 50,
  });

  for (const c of due) {
    // Guarded by status so two workers cannot both claim the same campaign.
    const claimed = await prisma.promotionCampaign.updateMany({
      where: { id: c.id, status: { in: [STATUS.SCHEDULED, STATUS.APPROVED] } },
      data: { status: STATUS.ACTIVE },
    });
    if (!claimed.count) continue;

    await audit("campaign.activated", { campaignId: c.id, actor: "system" });
    await sendLive({ ...c, status: STATUS.ACTIVE });
  }
  return due.length;
}

/** Finish anything whose window has closed, and send its report. */
async function complete(now) {
  const done = await prisma.promotionCampaign.findMany({
    where: { status: { in: [STATUS.ACTIVE, STATUS.PAUSED] }, endDate: { lte: now } },
    ...withNames,
    take: 50,
  });

  for (const c of done) {
    const claimed = await prisma.promotionCampaign.updateMany({
      where: { id: c.id, status: { in: [STATUS.ACTIVE, STATUS.PAUSED] } },
      data: { status: STATUS.COMPLETED },
    });
    if (!claimed.count) continue;

    await audit("campaign.completed", { campaignId: c.id, actor: "system" });
    // The report is counted at the moment it finishes, from real events.
    const stats = await analyticsFor(c.id);
    await sendCompleted({ ...c, status: STATUS.COMPLETED }, stats);
  }
  return done.length;
}

/** A note three days out, so a vendor can decide whether to run it again. */
async function warnEndingSoon(now) {
  const soon = new Date(now.getTime() + 3 * 86400000);
  const ending = await prisma.promotionCampaign.findMany({
    where: { status: STATUS.ACTIVE, endDate: { gt: now, lte: soon } },
    ...withNames,
    take: 50,
  });
  // once() keys on the campaign and event name, so this sends one note however
  // many times the job passes over the same campaign.
  for (const c of ending) {
    const days = Math.max(1, Math.ceil((c.endDate - now) / 86400000));
    await sendEndingSoon(c, days);
  }
  return ending.length;
}

export async function tick() {
  const now = new Date();
  try {
    const started = await activate(now);
    const finished = await complete(now);
    const warned = await warnEndingSoon(now);
    const purged = await purgeExpired();
    if (started || finished || warned) {
      // eslint-disable-next-line no-console
      console.log(`[promote] started ${started}, finished ${finished}, ending-soon ${warned}`);
    }
    return { started, finished, warned, purged };
  } catch (err) {
    // A failed pass must not stop the timer: the next one picks up the same
    // work, and the surfaces are correct regardless.
    // eslint-disable-next-line no-console
    console.warn(`[promote] scheduler pass failed: ${err.message}`);
    return null;
  }
}

/**
 * Start the worker.
 *
 * Off unless PROMOTE_WORKER is set, matching the pricing worker: on Render the
 * web service and any background service run the same image, and two schedulers
 * sending the same "your campaign is live" email is exactly the kind of thing
 * nobody notices until a vendor asks why they got it twice.
 */
export function startPromotionScheduler() {
  if (process.env.PROMOTE_WORKER !== "1") return false;
  if (timer) return true;
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
  // One pass shortly after boot, so a restart picks up anything missed while
  // the process was down.
  setTimeout(tick, 15000).unref?.();
  // eslint-disable-next-line no-console
  console.log(`[promote] scheduler on, every ${TICK_MS / 60000} minutes`);
  return true;
}

export function stopPromotionScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
}
