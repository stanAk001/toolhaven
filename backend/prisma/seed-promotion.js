/**
 * The starting plans and placements.
 *
 * Idempotent: it upserts by slug/key, so running it twice changes nothing and
 * it will not overwrite a price an editor has since changed in admin. Prices
 * set here are the ones from the brief, in minor units.
 *
 * The naira figures are not converted from the dollar ones. There is no rate
 * in this codebase and inventing one would put a number on a published page
 * that nobody decided. They are round naira prices, set deliberately, and both
 * are editable in admin without a deployment.
 *
 *   node prisma/seed-promotion.js
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLACEMENTS = [
  {
    key: "HOMEPAGE_FEATURED", label: "Homepage featured", sortOrder: 1, maxActive: 3,
    description: "In the Featured tools row on the Toolhaven homepage.",
    dailyRateUsdCents: 75, dailyRateNgnKobo: 48000,
  },
  {
    key: "CATEGORY_FEATURED", label: "Category featured", sortOrder: 2, maxActive: 2, perCategory: true,
    description: "In the featured area at the top of your tool's category page.",
    dailyRateUsdCents: 75, dailyRateNgnKobo: 48000,
  },
  {
    key: "PROMOTIONAL_DISCOVERY", label: "Discovery surfaces", sortOrder: 3, maxActive: 6,
    description: "Promotional slots across Toolhaven's browse and comparison pages.",
    dailyRateUsdCents: 75, dailyRateNgnKobo: 48000,
  },
  {
    key: "GUIDE_PROMOTION", label: "Buying guide promotion", sortOrder: 1, maxActive: 2,
    description: "A clearly labelled sponsored slot on a relevant buying guide. It does not affect which products the guide recommends.",
    dailyRateUsdCents: 75, dailyRateNgnKobo: 48000,
  },
  {
    key: "SOCIAL_PROMOTION", label: "Toolhaven social promotion", sortOrder: 2, maxActive: 2, manual: true,
    description: "A post from Toolhaven's own accounts, written and published by an editor. Fulfilled by hand, not automatically.",
  },
  {
    key: "NEWSLETTER_PROMOTION", label: "Newsletter placement", sortOrder: 3, maxActive: 1, manual: true,
    description: "A labelled placement in a Toolhaven newsletter. Fulfilled by hand when the next issue goes out.",
  },
];

const PLANS = [
  {
    slug: "boost-14", name: "Toolhaven Boost · 14 days", sortOrder: 1, durationDays: 14,
    description: "Drive additional traffic from Toolhaven to your site.",
    priceUsdCents: 2000, priceNgnKobo: 1500000,
    placements: ["HOMEPAGE_FEATURED", "CATEGORY_FEATURED", "PROMOTIONAL_DISCOVERY"],
    features: [
      "Homepage featured rotation",
      "Featured in your tool's category",
      "Promotional discovery surfaces",
      "Outbound click tracking with UTM tags",
      "Placement-by-placement analytics",
    ],
  },
  {
    slug: "boost-30", name: "Toolhaven Boost · 30 days", sortOrder: 2, durationDays: 30,
    description: "Drive additional traffic from Toolhaven to your site, for a month.",
    priceUsdCents: 3000, priceNgnKobo: 2800000,
    placements: ["HOMEPAGE_FEATURED", "CATEGORY_FEATURED", "PROMOTIONAL_DISCOVERY"],
    features: [
      "Homepage featured rotation",
      "Featured in your tool's category",
      "Promotional discovery surfaces",
      "Outbound click tracking with UTM tags",
      "Placement-by-placement analytics",
    ],
  },
  {
    // Quoted by hand on purpose. Toolhaven's newsletter and social reach are
    // not yet large enough to put a fixed figure against, and inventing one
    // would be selling an audience that has not been counted.
    slug: "full-promotion", name: "Full promotion", sortOrder: 3, durationDays: 30,
    description: "A larger campaign across Toolhaven, including the placements an editor fulfils by hand.",
    quoteOnly: true,
    placements: ["HOMEPAGE_FEATURED", "CATEGORY_FEATURED", "PROMOTIONAL_DISCOVERY", "GUIDE_PROMOTION", "SOCIAL_PROMOTION", "NEWSLETTER_PROMOTION"],
    features: [
      "Everything in Boost",
      "Sponsored slot on a relevant buying guide",
      "Toolhaven social promotion",
      "Newsletter placement",
      "Priced per campaign — tell us what you have in mind",
    ],
  },
];

async function main() {
  let placements = 0;
  for (const p of PLACEMENTS) {
    await prisma.promotionPlacement.upsert({
      where: { key: p.key },
      update: {},                      // never overwrite an editor's limits
      create: { perCategory: false, manual: false, active: true, ...p },
    });
    placements++;
  }

  let plans = 0;
  for (const p of PLANS) {
    await prisma.promotionPlan.upsert({
      where: { slug: p.slug },
      update: {},                      // never overwrite an edited price
      create: { active: true, quoteOnly: false, ...p },
    });
    plans++;
  }

  console.log(`placements: ${await prisma.promotionPlacement.count()} (${placements} offered)`);
  console.log(`plans:      ${await prisma.promotionPlan.count()} (${plans} offered)`);
  console.log("\nUpsert by slug/key — running this again will not overwrite prices changed in admin.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
