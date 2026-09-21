/**
 * Delivery fairness on an oversubscribed placement.
 *
 * Discovery sells six slots and the row shows three. Before this, the three
 * with the earliest start date rendered on every single request and the other
 * three never appeared at all — a full-price campaign delivering nothing, with
 * a dashboard of zeros as the only clue.
 *
 * What is asserted here is the promise that replaced it: over enough requests
 * every paid campaign gets served, and the ones behind catch up.
 *
 * Run this file with --test-concurrency=1 alongside the other promotion
 * suites. It holds six live campaigns on the discovery placement for its
 * duration, which is the whole of that placement's inventory — run in
 * parallel it makes promoteflow's availability checks fail for reasons that
 * have nothing to do with promoteflow.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { liveFor } from "../src/lib/promotion/campaigns.js";

const prisma = new PrismaClient();
const PLACEMENT = "PROMOTIONAL_DISCOVERY";
const SLOTS = 3;
const HOW_MANY = 6;

let toolIds = [], subIds = [], campaigns = [];

test.before(async () => {
  const cat = await prisma.category.findFirst({ select: { id: true } });
  const plan = await prisma.promotionPlan.findFirst({ select: { id: true } });
  const now = Date.now();

  for (let i = 0; i < HOW_MANY; i++) {
    const tool = await prisma.tool.create({
      data: { slug: `zz-rot-${now}-${i}`, name: `ZZ Rotation ${i}`, description: "d",
        websiteUrl: `https://example.com/rot${i}`, categoryId: cat.id, isActive: true },
    });
    const sub = await prisma.toolSubmission.create({
      data: { toolName: `ZZ Rotation ${i}`, websiteUrl: `https://example.com/rot${i}`,
        contactName: "ZZ", email: `zz-rot${i}@example.com`, pitch: "p", status: "published",
        publishedToolId: tool.id, publicToken: `zzrot${now}${i}` },
    });
    const c = await prisma.promotionCampaign.create({
      data: {
        slug: `zz-rot-c-${now}-${i}`, ownerEmail: `zz-rot${i}@example.com`,
        submissionId: sub.id, toolId: tool.id, planId: plan.id, status: "ACTIVE",
        headline: `ZZ Rotation ${i}`, message: "m", destinationUrl: `https://example.com/rot${i}`,
        placements: [PLACEMENT],
        // Staggered start dates: this is exactly the ordering that used to
        // decide everything.
        startDate: new Date(now - (HOW_MANY - i) * 3600e3),
        endDate: new Date(now + 86400e3),
      },
    });
    toolIds.push(tool.id); subIds.push(sub.id); campaigns.push(c);
  }
});

test.after(async () => {
  for (const c of campaigns) {
    await prisma.promotionEvent.deleteMany({ where: { campaignId: c.id } });
    await prisma.promotionAudit.deleteMany({ where: { campaignId: c.id } });
    await prisma.promotionCampaign.delete({ where: { id: c.id } });
  }
  for (const id of subIds) await prisma.toolSubmission.delete({ where: { id } });
  for (const id of toolIds) await prisma.tool.delete({ where: { id } });
  await prisma.$disconnect();
});

test("the row never shows more than it has room for", async () => {
  const items = await liveFor(PLACEMENT, { limit: SLOTS });
  assert.equal(items.length, SLOTS);
});

/** Serve the row repeatedly, recording an impression for whoever appeared. */
async function serve(times) {
  const shown = new Map(campaigns.map((c) => [c.slug, 0]));
  for (let i = 0; i < times; i++) {
    const items = await liveFor(PLACEMENT, { limit: SLOTS });
    const rows = [];
    for (const it of items) {
      shown.set(it.slug, shown.get(it.slug) + 1);
      const c = campaigns.find((x) => x.slug === it.slug);
      rows.push({ campaignId: c.id, placement: PLACEMENT, type: "impression" });
    }
    await prisma.promotionEvent.createMany({ data: rows });
  }
  return shown;
}

test("every paid campaign gets served, not just the earliest three", async () => {
  const shown = await serve(20);
  const starved = [...shown.entries()].filter(([, n]) => n === 0);

  console.log("    impressions delivered per campaign:",
    [...shown.values()].sort((a, b) => a - b).join(", "));

  assert.equal(starved.length, 0,
    `these campaigns were sold a placement and never rendered: ${starved.map(([s]) => s).join(", ")}`);
});

test("delivery is even enough that nobody is quietly shortchanged", async () => {
  const counts = [...(await serve(30)).values()];
  const min = Math.min(...counts), max = Math.max(...counts);

  // 6 campaigns, 3 slots: each should land near half the requests. A spread
  // this tight is only possible if the starved ones are actively caught up.
  assert.ok(max - min <= 3,
    `delivery is lopsided — best ${max}, worst ${min} (spread ${max - min})`);
});
