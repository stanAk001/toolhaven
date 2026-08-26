/**
 * Replaces the invented reader ratings with the real ones.
 *
 * `Tool.rating` and `Tool.reviewCount` were seeded with made-up figures — Canva
 * claimed 15,000 reader reviews against 0 actual rows — and they were rendered
 * as "Community rating" and emitted to Google as `aggregateRating`. Fake
 * aggregate ratings are a documented cause of a Search Console manual action,
 * quite apart from being the thing this site exists not to do.
 *
 * After this runs, both columns are derived from approved ToolReview rows and
 * nothing else. Tools with no reader reviews show no community rating at all;
 * their pages fall back to the sourced Capterra figure where one exists.
 *
 * The previous values are written to fabricated-ratings-backup.json first, so
 * this is reversible.
 *
 * Usage: node prisma/fix-fabricated-ratings.js [--apply]
 * Without --apply it only reports what it would change.
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const tools = await prisma.tool.findMany({
    select: {
      id: true, slug: true, name: true, rating: true, reviewCount: true,
      reviews: { where: { status: "approved" }, select: { rating: true } },
    },
    orderBy: { reviewCount: "desc" },
  });

  const backup = tools.map((t) => ({ slug: t.slug, rating: t.rating, reviewCount: t.reviewCount }));
  writeFileSync("prisma/fabricated-ratings-backup.json", JSON.stringify(backup, null, 2));

  let changed = 0, claimed = 0, real = 0;
  for (const t of tools) {
    const n = t.reviews.length;
    const avg = n ? Math.round((t.reviews.reduce((s, r) => s + r.rating, 0) / n) * 10) / 10 : 0;
    claimed += t.reviewCount || 0;
    real += n;
    if ((t.reviewCount || 0) === n && Number(t.rating) === avg) continue;
    changed++;
    if (changed <= 12) {
      console.log("  " + t.name.padEnd(18)
        + String(t.rating).padStart(4) + " from " + String(t.reviewCount).padStart(6)
        + "   ->   " + (n ? avg + " from " + n : "no community rating"));
    }
    if (APPLY) await prisma.tool.update({ where: { id: t.id }, data: { rating: avg, reviewCount: n } });
  }

  console.log("\n" + changed + " tools " + (APPLY ? "updated" : "would change"));
  console.log("review count claimed on the site: " + claimed.toLocaleString());
  console.log("reader reviews that actually exist: " + real.toLocaleString());
  console.log(APPLY ? "\napplied. backup: prisma/fabricated-ratings-backup.json"
                    : "\ndry run only — re-run with --apply to write it");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
