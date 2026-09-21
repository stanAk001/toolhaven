/**
 * Campaigns the buyer assembles themselves: pick the surfaces, pick the days.
 *
 * The packages cover the common case. This covers everyone else — someone who
 * only wants the category page, or who wants three weeks rather than two — and
 * it exists so that "none of these quite fit" is not the end of the
 * conversation.
 *
 * Three rules hold this together:
 *
 *   1. The price is computed here and nowhere else. The client sends a list of
 *      placements and a number of days; it never sends a figure. A quote the
 *      browser could influence is a quote an attacker sets to zero.
 *
 *   2. Every rate is a number an editor typed into the placement row. Nothing
 *      here converts between currencies — a naira price is a naira price
 *      somebody chose, not a dollar price multiplied by a rate nobody chose.
 *
 *   3. A package always beats assembling the same thing by hand. That is what
 *      makes a bundle a bundle, and it is asserted in the tests rather than
 *      left to trust.
 */

import { prisma } from "../prisma.js";

export const MIN_DAYS = 7;
export const MAX_DAYS = 90;

/**
 * Published, not secret: a longer booking costs less per day because it is
 * worth more to us to have the slot filled. The thresholds are shown to the
 * buyer as they cross them rather than applied quietly at the end.
 */
export const DURATION_TIERS = [
  { minDays: 30, discountPct: 30 },
  { minDays: 14, discountPct: 10 },
  { minDays: 0, discountPct: 0 },
];

export const discountFor = (days) =>
  DURATION_TIERS.find((t) => days >= t.minDays)?.discountPct ?? 0;

export const REFUSALS = {
  DAYS: `Choose a run length between ${MIN_DAYS} and ${MAX_DAYS} days.`,
  NONE: "Choose at least one placement.",
  UNKNOWN: "One of those placements isn't something we sell.",
  NOT_SOLD: "One of those placements isn't sold on its own — it's part of a quoted campaign.",
};

/** The placements a buyer may assemble on their own, with their day rates. */
export async function sellableIndividually() {
  const rows = await prisma.promotionPlacement.findMany({
    where: { active: true, manual: false },
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
  });
  return rows.filter((p) =>
    Number.isInteger(p.dailyRateUsdCents) && p.dailyRateUsdCents > 0 &&
    Number.isInteger(p.dailyRateNgnKobo) && p.dailyRateNgnKobo > 0);
}

/**
 * Price a custom campaign.
 *
 * Returns both currencies. Which one the buyer is actually charged is decided
 * by the geo resolver at checkout, exactly as it is for a package — this
 * function has no opinion about where anyone is.
 *
 * Rounding is applied once, to the final figure, and always to a whole minor
 * unit. Discounting each line separately and summing would let a rounding
 * error land on the buyer's side of the bill.
 *
 * @returns {Promise<{ok: true, days, discountPct, lines, usdCents, ngnKobo} | {ok: false, reason: string}>}
 */
export async function quoteFor(placementKeys, days) {
  const n = Number(days);
  if (!Number.isInteger(n) || n < MIN_DAYS || n > MAX_DAYS) {
    return { ok: false, reason: REFUSALS.DAYS };
  }

  const wanted = [...new Set((placementKeys || []).map((k) => String(k)))];
  if (!wanted.length) return { ok: false, reason: REFUSALS.NONE };

  const known = await prisma.promotionPlacement.findMany({ where: { key: { in: wanted } } });
  if (known.length !== wanted.length) return { ok: false, reason: REFUSALS.UNKNOWN };

  const sellable = new Map((await sellableIndividually()).map((p) => [p.key, p]));
  if (wanted.some((k) => !sellable.has(k))) return { ok: false, reason: REFUSALS.NOT_SOLD };

  const discountPct = discountFor(n);
  const keep = (100 - discountPct) / 100;

  const lines = wanted.map((k) => {
    const p = sellable.get(k);
    return {
      placement: k,
      label: p.label,
      days: n,
      dailyUsdCents: p.dailyRateUsdCents,
      dailyNgnKobo: p.dailyRateNgnKobo,
      usdCents: p.dailyRateUsdCents * n,
      ngnKobo: p.dailyRateNgnKobo * n,
    };
  });

  const grossUsd = lines.reduce((a, l) => a + l.usdCents, 0);
  const grossNgn = lines.reduce((a, l) => a + l.ngnKobo, 0);

  return {
    ok: true,
    days: n,
    discountPct,
    lines,
    grossUsdCents: grossUsd,
    grossNgnKobo: grossNgn,
    usdCents: Math.round(grossUsd * keep),
    ngnKobo: Math.round(grossNgn * keep),
  };
}

/** The slug of the plan row custom campaigns are filed under. */
export const CUSTOM_PLAN_SLUG = "custom";

/**
 * Every campaign needs a plan row because the relation is required. Custom
 * campaigns share one, kept inactive so it never appears among the packages
 * for sale while still being a valid thing to file a campaign under.
 */
export async function customPlan() {
  return prisma.promotionPlan.upsert({
    where: { slug: CUSTOM_PLAN_SLUG },
    update: {},
    create: {
      slug: CUSTOM_PLAN_SLUG,
      name: "Custom campaign",
      description: "Placements and a run length chosen by the buyer.",
      durationDays: 0,
      placements: [],
      features: [],
      active: false,
      sortOrder: 99,
    },
  });
}
