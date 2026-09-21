/**
 * How many promotional slots are actually free.
 *
 * Every number here is a count of live campaigns against a limit an editor
 * set. Nothing is invented, and in particular nothing ever says "only 2 spots
 * left!" unless two spots are genuinely left — manufactured scarcity is the
 * house style of exactly the kind of ad network this is meant not to be.
 *
 * When a placement is full the honest sentence is the one the buyer sees:
 * "That placement is currently unavailable."
 */
import { prisma } from "../prisma.js";
import { liveWhere } from "./lifecycle.js";

export const PLACEMENT_KEYS = [
  "HOMEPAGE_FEATURED",
  "CATEGORY_FEATURED",
  "PROMOTIONAL_DISCOVERY",
  "GUIDE_PROMOTION",
  "SOCIAL_PROMOTION",
  "NEWSLETTER_PROMOTION",
];

export const UNAVAILABLE = "That placement is currently unavailable.";

/**
 * Availability for every placement, optionally within one category.
 *
 * Counted in a single query rather than one per placement: this is read on the
 * campaign builder and on the public pricing page, and a query per placement
 * per page load is how a feature becomes the reason a site feels slow.
 *
 * @param {{ categoryId?: number|null, ignoreCampaignId?: number|null }} opts
 */
export async function availability({ categoryId = null, ignoreCampaignId = null } = {}) {
  const [placements, live] = await Promise.all([
    prisma.promotionPlacement.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.promotionCampaign.findMany({
      where: {
        ...liveWhere(),
        ...(ignoreCampaignId ? { id: { not: ignoreCampaignId } } : {}),
      },
      select: {
        id: true,
        placements: true,
        tool: { select: { categoryId: true } },
      },
    }),
  ]);

  return placements.map((p) => {
    const holders = live.filter((c) => {
      if (!c.placements.includes(p.key)) return false;
      // A category slot is only contended by campaigns in that same category.
      if (p.perCategory && categoryId != null) return c.tool?.categoryId === categoryId;
      return true;
    });

    const taken = holders.length;
    const free = Math.max(0, p.maxActive - taken);
    return {
      key: p.key,
      label: p.label,
      description: p.description,
      manual: p.manual,
      perCategory: p.perCategory,
      maxActive: p.maxActive,
      taken,
      free,
      available: free > 0,
    };
  });
}

/**
 * Can this set of placements be taken right now?
 *
 * Checked on the server at the moment of purchase as well as when the form is
 * drawn. Two buyers reaching the last slot at once is not a hypothetical, and
 * the page they saw a minute ago is not evidence of anything.
 *
 * @returns {Promise<{ ok: boolean, reason?: string, full?: string[] }>}
 */
export async function canTake(keys, { categoryId = null, ignoreCampaignId = null } = {}) {
  const wanted = [...new Set((keys || []).filter((k) => PLACEMENT_KEYS.includes(k)))];
  if (!wanted.length) return { ok: false, reason: "Choose at least one placement." };

  const rows = await availability({ categoryId, ignoreCampaignId });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const unknown = wanted.filter((k) => !byKey.has(k));
  if (unknown.length) {
    return { ok: false, reason: `That placement is not available on Toolhaven.`, full: unknown };
  }

  const full = wanted.filter((k) => !byKey.get(k).available);
  if (full.length) {
    return {
      ok: false,
      reason: full.length === 1
        ? UNAVAILABLE
        : "Those placements are currently unavailable.",
      full,
    };
  }
  return { ok: true };
}
