/**
 * The editor's side: review, scheduling, pricing, inventory.
 *
 * Same discipline as the vendor flow — a throwaway tool and an example.com
 * owner, deleted at the end. The scheduler is driven by calling its tick
 * directly rather than waiting five minutes for the timer.
 */
import { PrismaClient } from "@prisma/client";
import { tick } from "../src/lib/promotion/scheduler.js";

const prisma = new PrismaClient();
const BASE = `http://localhost:${process.env.PROMOTE_TEST_PORT || 4102}/api`;
const TOKEN = process.env.ADMIN_TOKEN || "303100";
const OWNER = "zz-admin-owner@example.com";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) { pass++; console.log("  ok   " + what); } else { fail++; console.log("  FAIL " + what); } };
const admin = (path, opts = {}) => fetch(BASE + path, {
  ...opts, headers: { "content-type": "application/json", "x-admin-token": TOKEN, ...(opts.headers || {}) },
});

const made = { toolIds: [], submissionIds: [], campaignIds: [] };

async function main() {
  console.log("\n0. a throwaway campaign in review");
  const category = await prisma.category.findFirst({ select: { id: true } });
  const tool = await prisma.tool.create({
    data: {
      slug: `zz-admin-test-${Date.now()}`, name: "ZZ Admin Test",
      description: "Throwaway.", websiteUrl: "https://example.com/admin",
      categoryId: category.id, isActive: true,
    },
  });
  made.toolIds.push(tool.id);
  const sub = await prisma.toolSubmission.create({
    data: {
      toolName: "ZZ Admin Test", websiteUrl: "https://example.com/admin",
      contactName: "ZZ", email: OWNER, pitch: "Throwaway.",
      status: "published", publishedToolId: tool.id, publicToken: `zza${Date.now()}`,
    },
  });
  made.submissionIds.push(sub.id);
  // Ordered, so the same plan is exercised every run and a failure is
  // reproducible rather than depending on row order.
  const plan = await prisma.promotionPlan.findFirst({
    where: { active: true, quoteOnly: false },
    orderBy: { sortOrder: "asc" },
  });

  const c = await prisma.promotionCampaign.create({
    data: {
      slug: `zz-admin-${Date.now()}`, toolId: tool.id, submissionId: sub.id,
      ownerEmail: OWNER, planId: plan.id, status: "DRAFT",
      headline: "ZZ headline", placements: ["HOMEPAGE_FEATURED"],
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 8 * 86400000),
    },
  });
  made.campaignIds.push(c.id);
  ok(true, `campaign ${c.slug}`);

  console.log("\n1. an unpaid campaign cannot be approved (§2, §15)");
  const early = await admin(`/admin/promotions/campaigns/${c.slug}/approve`, { method: "POST" });
  const earlyBody = await early.json();
  ok(early.status === 409, `approving a draft is refused (${early.status})`);
  ok(/can only become/i.test(earlyBody.error || ""), `and says what it can become: "${earlyBody.error}"`);

  console.log("\n2. review actions need a reason");
  await prisma.promotionCampaign.update({ where: { id: c.id }, data: { status: "PENDING_REVIEW" } });
  ok((await admin(`/admin/promotions/campaigns/${c.slug}/reject`, { method: "POST", body: "{}" })).status === 400,
    "rejecting with no reason is refused");
  ok((await admin(`/admin/promotions/campaigns/${c.slug}/request-changes`, { method: "POST", body: "{}" })).status === 400,
    "so is asking for changes with no reason");

  console.log("\n3. requesting changes reopens it for the vendor");
  const changes = await admin(`/admin/promotions/campaigns/${c.slug}/request-changes`, {
    method: "POST", body: JSON.stringify({ reason: "Please shorten the headline." }),
  });
  const afterChanges = (await changes.json()).campaign;
  ok(changes.status === 200, "accepted");
  ok(afterChanges.status === "DRAFT", "it goes back to draft, so the vendor can edit");
  ok(afterChanges.reviewNote === "Please shorten the headline.", "and carries the reason verbatim");

  console.log("\n4. approving schedules it");
  await prisma.promotionCampaign.update({ where: { id: c.id }, data: { status: "PENDING_REVIEW" } });
  const approve = await admin(`/admin/promotions/campaigns/${c.slug}/approve`, { method: "POST" });
  const approved = (await approve.json()).campaign;
  ok(approve.status === 200, `approved (${approve.status})`);
  ok(approved.status === "SCHEDULED", "scheduled rather than switched on by hand");

  const featuredNow = await (await fetch(`${BASE}/promote/featured`)).json();
  ok(!featuredNow.items.some((i) => i.slug === c.slug), "and it is NOT yet on any surface — its start date is tomorrow");

  console.log("\n5. the scheduler starts it when its hour comes (§26, §27)");
  await prisma.promotionCampaign.update({
    where: { id: c.id },
    data: { startDate: new Date(Date.now() - 60000), endDate: new Date(Date.now() + 86400000) },
  });
  const pass1 = await tick();
  ok(pass1 && pass1.started >= 1, `the pass started ${pass1?.started} campaign(s)`);
  const live = await prisma.promotionCampaign.findUnique({ where: { id: c.id } });
  ok(live.status === "ACTIVE", "it is active");
  const featuredLive = await (await fetch(`${BASE}/promote/featured`)).json();
  ok(featuredLive.items.some((i) => i.slug === c.slug), "and now renders on the homepage surface");

  console.log("\n6. running the pass again changes nothing (idempotent)");
  const pass2 = await tick();
  ok(pass2 && pass2.started === 0, `nothing started a second time (${pass2?.started})`);
  const auditRows = await prisma.promotionAudit.count({ where: { campaignId: c.id, action: "campaign.activated" } });
  ok(auditRows === 1, `activation recorded once, not twice (${auditRows})`);

  console.log("\n7. pausing takes it off the surfaces");
  await admin(`/admin/promotions/campaigns/${c.slug}/pause`, { method: "POST" });
  const paused = await (await fetch(`${BASE}/promote/featured`)).json();
  ok(!paused.items.some((i) => i.slug === c.slug), "a paused campaign does not render");
  await admin(`/admin/promotions/campaigns/${c.slug}/resume`, { method: "POST" });
  const resumed = await (await fetch(`${BASE}/promote/featured`)).json();
  ok(resumed.items.some((i) => i.slug === c.slug), "and resuming puts it back");

  console.log("\n8. the scheduler finishes it and writes the report");
  await prisma.promotionCampaign.update({
    where: { id: c.id }, data: { endDate: new Date(Date.now() - 1000) },
  });
  const pass3 = await tick();
  ok(pass3 && pass3.finished >= 1, `the pass finished ${pass3?.finished} campaign(s)`);
  const done = await prisma.promotionCampaign.findUnique({ where: { id: c.id } });
  ok(done.status === "COMPLETED", "it is completed");

  console.log("\n8b. the vendor is actually emailed");
  // The run before this one passed every assertion while every campaign email
  // silently failed: once() was writing a column EmailEvent does not have, so
  // the claim threw and each send was skipped as "already sent". Statuses are
  // not evidence that anyone was told.
  const mails = await prisma.emailEvent.findMany({
    where: { submissionId: sub.id }, select: { eventType: true, status: true, error: true },
  });
  ok(mails.length > 0, `email rows written (${mails.map((m) => `${m.eventType}:${m.status}`).join(", ") || "none"})`);
  ok(mails.some((m) => m.eventType === "promo:approved"), "the approval email was attempted");
  ok(mails.some((m) => m.eventType === "promo:completed"), "and the completion report");

  console.log("\n9. prices change without a deployment, and are audited (§24, §43)");
  const before = await prisma.promotionPlan.findUnique({ where: { id: plan.id } });
  const patched = await admin(`/admin/promotions/plans/${plan.slug}`, {
    method: "PATCH", body: JSON.stringify({ priceUsd: 59 }),
  });
  ok(patched.status === 200, "the price changed");
  const after = await prisma.promotionPlan.findUnique({ where: { id: plan.id } });
  ok(after.priceUsdCents === 5900, `stored in minor units (${after.priceUsdCents})`);
  const trail = await prisma.promotionAudit.findFirst({
    where: { planId: plan.id, action: "plan.price" }, orderBy: { id: "desc" },
  });
  ok(Boolean(trail), "and an audit row records it");
  ok(/→/.test(trail?.detail || ""), `showing before and after: "${trail?.detail}"`);
  // Put the seeded price back.
  await prisma.promotionPlan.update({ where: { id: plan.id }, data: { priceUsdCents: before.priceUsdCents } });

  console.log("\n10. a blank price means 'not sold here', not free");
  await admin(`/admin/promotions/plans/${plan.slug}`, { method: "PATCH", body: JSON.stringify({ priceNgn: "" }) });
  const blanked = await prisma.promotionPlan.findUnique({ where: { id: plan.id } });
  ok(blanked.priceNgnKobo === null, "it stores null rather than zero");
  await prisma.promotionPlan.update({ where: { id: plan.id }, data: { priceNgnKobo: before.priceNgnKobo } });

  console.log("\n11. inventory limits are enforced, not decorative (§25)");
  await admin("/admin/promotions/placements/HOMEPAGE_FEATURED", { method: "PATCH", body: JSON.stringify({ maxActive: 0 }) });
  const plansNow = await (await fetch(`${BASE}/promote/plans`)).json();
  const slot = plansNow.placements.find((p) => p.key === "HOMEPAGE_FEATURED");
  ok(slot.available === false, "a placement with no room reports unavailable");
  ok(slot.free === 0, `and zero free (${slot.free})`);
  await admin("/admin/promotions/placements/HOMEPAGE_FEATURED", { method: "PATCH", body: JSON.stringify({ maxActive: 3 }) });

  console.log("\n12. revenue counts verified payments only (§18, §40)");
  await prisma.promotionPayment.create({
    data: {
      campaignId: c.id, provider: "paystack", reference: `zz_pending_${Date.now()}`,
      amountMinor: 999999, currency: "NGN", status: "PENDING",
    },
  });
  const overview = await (await admin("/admin/promotions/overview")).json();
  const ngn = overview.revenue.find((r) => r.currency === "NGN");
  ok(!ngn || ngn.minor !== 999999, "a pending charge is not counted as revenue");
}

async function cleanup() {
  console.log("\n13. cleaning up");
  await prisma.promotionEvent.deleteMany({ where: { campaignId: { in: made.campaignIds } } });
  await prisma.promotionPayment.deleteMany({ where: { campaignId: { in: made.campaignIds } } });
  await prisma.promotionAudit.deleteMany({ where: { campaignId: { in: made.campaignIds } } });
  await prisma.promotionCampaign.deleteMany({ where: { id: { in: made.campaignIds } } });
  await prisma.emailEvent.deleteMany({ where: { submissionId: { in: made.submissionIds } } });
  await prisma.toolSubmission.deleteMany({ where: { id: { in: made.submissionIds } } });
  await prisma.tool.deleteMany({ where: { id: { in: made.toolIds } } });
  ok((await prisma.promotionCampaign.count({ where: { ownerEmail: OWNER } })) === 0, "throwaway campaign removed");
}

main()
  .catch((e) => { fail++; console.log("\nTHREW: " + (e.stack || e.message)); })
  .finally(async () => {
    await cleanup().catch((e) => console.log("cleanup problem: " + e.message));
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
