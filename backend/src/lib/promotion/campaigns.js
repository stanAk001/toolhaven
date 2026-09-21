/**
 * Campaign shaping, and the numbers behind it.
 *
 * Two jobs. First, turning what a vendor typed into something safe to store and
 * render: no HTML, sensible lengths, a destination that must stay on the tool's
 * own domain. Second, reading analytics back out — and every figure returned
 * here is a count of PromotionEvent rows. There is no field anywhere that a
 * number can be written into, which is what makes the vendor dashboard worth
 * believing.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "../prisma.js";
import { liveWhere, STATUS } from "./lifecycle.js";

/** Strip anything that could become markup. Vendors supply text, never HTML. */
export const plain = (v, len) => {
  if (v === undefined || v === null) return null;
  const s = String(v)
    .replace(/<[^>]*>/g, " ")      // no tags, ever
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s.slice(0, len) : null;
};

export const LIMITS = {
  headline: 70,
  message: 180,
  ctaText: 24,
  targetAudience: 120,
};

/**
 * Where a promotional click may lead.
 *
 * The destination must sit on the same registrable domain as the tool's own
 * website. A campaign is bought to promote a listed product, and letting a
 * vendor point the link anywhere turns a paid slot into an open redirect with
 * Toolhaven's name on it.
 */
export function checkDestination(raw, toolWebsite) {
  if (!raw) return { ok: true, url: toolWebsite || null };
  let want, base;
  try { want = new URL(String(raw)); } catch { return { ok: false, reason: "That destination isn't a valid URL." }; }
  if (!/^https?:$/.test(want.protocol)) return { ok: false, reason: "The destination must be an http or https link." };
  if (!toolWebsite) return { ok: true, url: want.toString() };
  try { base = new URL(toolWebsite); } catch { return { ok: true, url: want.toString() }; }

  const root = (h) => h.toLowerCase().replace(/^www\./, "").split(".").slice(-2).join(".");
  if (root(want.hostname) !== root(base.hostname)) {
    return { ok: false, reason: `The destination has to be on ${root(base.hostname)} — the site your listing points at.` };
  }
  return { ok: true, url: want.toString() };
}

/** An unguessable public handle. No internal id is ever exposed. */
export const newSlug = (name = "") => {
  const stub = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "campaign";
  return `${stub}-${randomBytes(4).toString("hex")}`;
};

/** The campaign window. Start is the vendor's choice; length is the plan's. */
export function windowFor(plan, requestedStart) {
  const now = new Date();
  let start = requestedStart ? new Date(requestedStart) : now;
  if (Number.isNaN(start.getTime())) start = now;
  // A campaign cannot begin in the past; backdating would mean selling days
  // that have already gone.
  if (start < now) start = now;
  const end = new Date(start.getTime() + plan.durationDays * 86400000);
  return { start, end };
}

/** The shape a promotional surface renders. Deliberately lean. */
export const publicCampaign = (c) => ({
  slug: c.slug,
  headline: c.headline,
  message: c.message,
  ctaText: c.ctaText || "Visit website",
  image: c.imageId ? `/api/uploads/${c.imageId}` : null,
  tool: c.tool && {
    slug: c.tool.slug,
    name: c.tool.name,
    description: c.tool.description,
    logoUrl: c.tool.logoUrl,
    logoMono: c.tool.logoMono,
    category: c.tool.category && { slug: c.tool.category.slug, name: c.tool.category.name },
  },
});

/**
 * Live campaigns holding a placement.
 *
 * One query, selecting only what a card draws. This runs on the homepage, so
 * it must not become the reason the homepage is slow — and it must never
 * return a campaign whose window has closed, whatever the scheduler has or
 * hasn't done.
 */
export async function liveFor(placement, { categoryId = null, limit = 3 } = {}) {
  const rows = await prisma.promotionCampaign.findMany({
    where: {
      ...liveWhere(),
      placements: { has: placement },
      ...(categoryId ? { tool: { categoryId } } : {}),
    },
    select: {
      id: true,
      slug: true, headline: true, message: true, ctaText: true, imageId: true,
      tool: {
        select: {
          slug: true, name: true, description: true,
          logoUrl: true, logoMono: true,
          category: { select: { slug: true, name: true } },
        },
      },
    },
    orderBy: { startDate: "asc" },
    // Everyone eligible, not just the first few — who actually renders is
    // decided below, and it cannot be decided fairly from a list that has
    // already been truncated.
    take: 50,
  });

  const slots = Math.min(Math.max(1, limit), 12);
  if (rows.length <= slots) return rows.map(publicCampaign);

  return (await fairest(rows, placement, slots)).map(publicCampaign);
}

/**
 * Choose which campaigns get the slots when more have been sold than fit.
 *
 * This exists because a placement may be sold to more campaigns than the page
 * has room for — discovery allows six and the row shows three — and the
 * obvious implementation hands the slots to whoever started first, on every
 * request, forever. The other three vendors then pay in full for a placement
 * that renders zero times, and the only evidence is a dashboard reading zero.
 *
 * So the least-served campaign goes first. Impressions are counted per
 * placement, ties are broken at random, and the result is that delivery
 * evens out on its own: a campaign that has been starved is first in the
 * queue next time, and one that has run ahead waits. No campaign can be
 * permanently shut out by the accident of when it started.
 *
 * The extra query only happens when the placement is oversubscribed, which is
 * the only time it can change the answer.
 */
async function fairest(rows, placement, slots) {
  const counts = new Map(rows.map((r) => [r.id, 0]));
  try {
    const seen = await prisma.promotionEvent.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: rows.map((r) => r.id) }, placement, type: "impression" },
      _count: { _all: true },
    });
    for (const s of seen) counts.set(s.campaignId, s._count._all);
  } catch {
    // If the count fails, fall through to a random draw rather than to the
    // same three every time. An unfair answer is worse than an arbitrary one.
  }

  return rows
    .map((r) => ({ r, served: counts.get(r.id) ?? 0, coin: Math.random() }))
    .sort((a, b) => a.served - b.served || a.coin - b.coin)
    .slice(0, slots)
    .map((x) => x.r);
}

/* ───────────────────────────── analytics ───────────────────────────── */

const EVENT_TYPES = ["impression", "tool_view", "cta_click", "outbound_click"];

/**
 * Everything a vendor is shown about one campaign, counted from events.
 *
 * Two grouped queries rather than one per metric per placement, which is how
 * this stays fast as events accumulate.
 */
export async function analyticsFor(campaignId) {
  const [byType, byPlacement] = await Promise.all([
    prisma.promotionEvent.groupBy({
      by: ["type"],
      where: { campaignId },
      _count: { _all: true },
    }),
    prisma.promotionEvent.groupBy({
      by: ["placement", "type"],
      where: { campaignId, placement: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const totals = Object.fromEntries(EVENT_TYPES.map((t) => [t, 0]));
  for (const row of byType) if (row.type in totals) totals[row.type] = row._count._all;

  const places = new Map();
  for (const row of byPlacement) {
    const p = places.get(row.placement) || { placement: row.placement, impressions: 0, clicks: 0 };
    if (row.type === "impression") p.impressions += row._count._all;
    if (row.type === "outbound_click" || row.type === "cta_click") p.clicks += row._count._all;
    places.set(row.placement, p);
  }

  // Click-through against impressions, and only when there are impressions to
  // divide by — a CTR over zero views is not 0%, it is nothing yet.
  const ctr = totals.impression > 0
    ? Math.round((totals.outbound_click / totals.impression) * 1000) / 10
    : null;

  return {
    impressions: totals.impression,
    toolPageViews: totals.tool_view,
    ctaClicks: totals.cta_click,
    websiteClicks: totals.outbound_click,
    ctr,
    placements: [...places.values()].sort((a, b) => b.impressions - a.impressions),
    note: "These metrics represent activity recorded by Toolhaven and do not necessarily represent conversions on your website.",
  };
}

/** The same, for a list of campaigns, in one pass. Used by both dashboards. */
export async function analyticsForMany(campaignIds) {
  if (!campaignIds.length) return new Map();
  // Two grouped queries, not one per campaign. The second is what makes the
  // "placement-by-placement analytics" the packages sell actually reach the
  // vendor's dashboard — it was being computed only on the single-campaign
  // endpoint, which nothing rendered.
  const [rows, placeRows] = await Promise.all([
    prisma.promotionEvent.groupBy({
      by: ["campaignId", "type"],
      where: { campaignId: { in: campaignIds } },
      _count: { _all: true },
    }),
    prisma.promotionEvent.groupBy({
      by: ["campaignId", "placement", "type"],
      where: { campaignId: { in: campaignIds }, placement: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const out = new Map(campaignIds.map((id) => [id, {
    impressions: 0, toolPageViews: 0, ctaClicks: 0, websiteClicks: 0, ctr: null, placements: [],
  }]));
  for (const r of rows) {
    const t = out.get(r.campaignId);
    if (!t) continue;
    if (r.type === "impression") t.impressions = r._count._all;
    if (r.type === "tool_view") t.toolPageViews = r._count._all;
    if (r.type === "cta_click") t.ctaClicks = r._count._all;
    if (r.type === "outbound_click") t.websiteClicks = r._count._all;
  }

  const places = new Map(); // campaignId -> Map(placement -> row)
  for (const r of placeRows) {
    if (!places.has(r.campaignId)) places.set(r.campaignId, new Map());
    const m = places.get(r.campaignId);
    const p = m.get(r.placement) || { placement: r.placement, impressions: 0, clicks: 0 };
    if (r.type === "impression") p.impressions += r._count._all;
    if (r.type === "outbound_click" || r.type === "cta_click") p.clicks += r._count._all;
    m.set(r.placement, p);
  }

  for (const [id, t] of out) {
    t.ctr = t.impressions > 0 ? Math.round((t.websiteClicks / t.impressions) * 1000) / 10 : null;
    t.placements = [...(places.get(id)?.values() || [])].sort((a, b) => b.impressions - a.impressions);
  }
  return out;
}

/**
 * Record events.
 *
 * Only live campaigns accrue anything: an expired or paused campaign that is
 * still on someone's open tab must not keep counting, or the final report
 * would include days nobody paid for.
 */
export async function recordEvents(items, { ipHash = null, userAgent = null } = {}) {
  const clean = (items || [])
    .filter((e) => e && EVENT_TYPES.includes(e.type) && typeof e.campaign === "string")
    .slice(0, 20);
  if (!clean.length) return 0;

  const slugs = [...new Set(clean.map((e) => e.campaign))];
  const live = await prisma.promotionCampaign.findMany({
    where: { slug: { in: slugs }, ...liveWhere() },
    select: { id: true, slug: true, toolId: true },
  });
  if (!live.length) return 0;
  const bySlug = new Map(live.map((c) => [c.slug, c]));

  const data = clean
    .map((e) => {
      const c = bySlug.get(e.campaign);
      if (!c) return null;
      return {
        campaignId: c.id,
        toolId: c.toolId,
        type: e.type,
        placement: typeof e.placement === "string" ? e.placement.slice(0, 40) : null,
        userAgent: userAgent ? userAgent.slice(0, 200) : null,
        ipHash,
      };
    })
    .filter(Boolean);

  if (!data.length) return 0;
  const { count } = await prisma.promotionEvent.createMany({ data });
  return count;
}

/** Note something that happened, for the audit trail. Never throws. */
export function audit(action, { campaignId = null, planId = null, actor = "admin", detail = null } = {}) {
  return prisma.promotionAudit
    .create({ data: { action, campaignId, planId, actor, detail: detail ? String(detail).slice(0, 500) : null } })
    .catch(() => { /* an audit row must never be the reason an action fails */ });
}

/** The audit action an editor writes when they have done a by-hand placement. */
export const FULFILLED = "campaign.fulfilled";

/**
 * The by-hand placements a campaign bought, and whether they have been done.
 *
 * Two placements — the newsletter slot and the social post — are not rendered
 * by the site; an editor performs them. Until now that was recorded only in the
 * audit trail, which the vendor cannot see, so someone who had paid for a
 * newsletter mention had no way of learning whether it had gone out. This turns
 * the audit row into an answer for the person who paid for it.
 *
 * `doneAt: null` is the honest reading of "no row yet": not delivered. It is
 * never softened into "in progress", because nothing here knows that.
 */
export async function manualDelivery(campaigns) {
  const manual = await prisma.promotionPlacement.findMany({
    where: { manual: true },
    select: { key: true, label: true },
  });
  const labels = new Map(manual.map((m) => [m.key, m.label]));
  const out = new Map();
  if (!labels.size) return out;

  const ids = campaigns.map((c) => c.id).filter(Boolean);
  const rows = ids.length
    ? await prisma.promotionAudit.findMany({
      where: { action: FULFILLED, campaignId: { in: ids } },
      select: { campaignId: true, detail: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    })
    : [];

  const done = new Map();
  for (const r of rows) {
    if (!done.has(r.campaignId)) done.set(r.campaignId, new Map());
    done.get(r.campaignId).set(r.detail, r.createdAt);
  }

  for (const c of campaigns) {
    out.set(c.id, (c.placements || [])
      .filter((p) => labels.has(p))
      .map((p) => ({
        placement: p,
        label: labels.get(p),
        doneAt: done.get(c.id)?.get(p) || null,
      })));
  }
  return out;
}

export { STATUS };
