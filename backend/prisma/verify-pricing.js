/**
 * Run the pricing pipeline from the command line.
 *
 * Useful for a first pass over the catalogue, or for looking at what the
 * extractor made of one awkward site without waiting for the background worker
 * to get round to it.
 *
 *   node prisma/verify-pricing.js                  the 10 most due tools
 *   node prisma/verify-pricing.js make notion      those tools, by slug
 *   node prisma/verify-pricing.js --all            every active tool
 *   node prisma/verify-pricing.js --why make       what it read, and why it scored
 *
 * Nothing here publishes anything the pipeline would not publish on its own;
 * the confidence rules are the same either way.
 */
import { PrismaClient } from "@prisma/client";
import { verifyToolPricing } from "../src/lib/pricing/service.js";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const all = args.includes("--all");
const why = args.includes("--why");
const slugs = args.filter((a) => !a.startsWith("--"));

const money = (v, c) => (v === null || v === undefined ? "no price"
  : v === 0 ? "free" : new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD" }).format(v));

async function main() {
  const tools = await prisma.tool.findMany({
    where: slugs.length ? { slug: { in: slugs } } : { isActive: true, websiteUrl: { not: null } },
    select: { id: true, name: true, slug: true, websiteUrl: true },
    orderBy: [{ popularity: "desc" }],
    take: slugs.length ? slugs.length : (all ? 200 : 10),
  });
  if (!tools.length) { console.log("no matching tools"); return; }

  let published = 0, held = 0, failed = 0;
  for (const tool of tools) {
    const res = await verifyToolPricing(tool);
    const row = await prisma.toolPricing.findUnique({
      where: { toolId: tool.id }, include: { plans: { orderBy: { orderIndex: "asc" } } },
    });

    if (res.published) published++;
    else if (res.pendingReview) held++;
    else if (res.outcome !== "success") failed++;

    const state = res.published ? "published" : res.pendingReview ? "held for review" : res.outcome;
    console.log(
      tool.name.padEnd(18)
      + money(row?.startingPrice, row?.currency).padEnd(12)
      + (row?.billingPeriod ? ("/" + row.billingPeriod).padEnd(9) : "".padEnd(9))
      + (row?.verificationStatus || "-").padEnd(20)
      + String(row?.confidenceScore ?? "").padEnd(6)
      + state
    );

    if (why) {
      (row?.plans || []).forEach((p) => console.log("      " + p.name.padEnd(20) + (p.isCustom ? "custom" : money(p.price, p.currency))));
      (row?.confidenceReasons || []).forEach((x) => console.log("      · " + x));
      if (row?.sourceUrl) console.log("      source: " + row.sourceUrl);
    }
  }
  console.log("\n" + published + " published, " + held + " held for review, " + failed + " could not be read");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
