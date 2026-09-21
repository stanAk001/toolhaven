/**
 * Toolhaven Promote, end to end against a running server and a real database.
 *
 * Everything happens on a throwaway tool and a throwaway submission owned by an
 * example.com address, both deleted at the end. No real submitter is ever
 * emailed and no existing row is touched — mail is live on this box, so a test
 * that signed in as a real vendor would put a real link in a real inbox.
 *
 * Needs a server on PORT (default 4102).
 *
 *   PORT=4102 node src/server.js &
 *   node tests/promoteflow.test.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = `http://localhost:${process.env.PROMOTE_TEST_PORT || 4102}/api`;
const OWNER = "zz-promote-owner@example.com";
const STRANGER = "zz-promote-stranger@example.com";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) { pass++; console.log("  ok   " + what); } else { fail++; console.log("  FAIL " + what); } };

const api = (path, opts = {}) => fetch(BASE + path, {
  ...opts,
  headers: { "content-type": "application/json", ...(opts.headers || {}) },
});
const asOwner = (token, path, opts = {}) => api(path, { ...opts, headers: { "x-owner-token": token, ...(opts.headers || {}) } });

const made = { toolIds: [], submissionIds: [], campaignIds: [] };

async function main() {
  console.log("\n0. a throwaway tool and its submission");
  const category = await prisma.category.findFirst({ select: { id: true, slug: true } });
  const tool = await prisma.tool.create({
    data: {
      slug: `zz-promote-test-${Date.now()}`,
      name: "ZZ Promote Test",
      description: "A throwaway listing used to test the promotion flow.",
      websiteUrl: "https://example.com/product",
      categoryId: category.id,
      isActive: true,
    },
  });
  made.toolIds.push(tool.id);

  const mine = await prisma.toolSubmission.create({
    data: {
      toolName: "ZZ Promote Test", websiteUrl: "https://example.com/product",
      contactName: "ZZ Owner", email: OWNER, pitch: "Throwaway.",
      status: "published", publishedToolId: tool.id, publicToken: `zz${Date.now()}`,
    },
  });
  const theirs = await prisma.toolSubmission.create({
    data: {
      toolName: "ZZ Someone Else", websiteUrl: "https://example.org/other",
      contactName: "ZZ Stranger", email: STRANGER, pitch: "Throwaway.",
      status: "published", publishedToolId: tool.id, publicToken: `zz${Date.now()}b`,
    },
  });
  const pending = await prisma.toolSubmission.create({
    data: {
      toolName: "ZZ Not Approved", websiteUrl: "https://example.com/pending",
      contactName: "ZZ Owner", email: OWNER, pitch: "Throwaway.",
      status: "pending", publicToken: `zz${Date.now()}c`,
    },
  });
  made.submissionIds.push(mine.id, theirs.id, pending.id);
  ok(true, `tool ${tool.id}, submissions ${mine.id} / ${theirs.id} / ${pending.id}`);

  console.log("\n1. signing in never reveals who has submitted (TEST 9)");
  const unknown = await (await api("/owner/login", { method: "POST", body: JSON.stringify({ email: "zz-nobody@example.com" }) })).json();
  const known = await (await api("/owner/login", { method: "POST", body: JSON.stringify({ email: OWNER }) })).json();
  ok(unknown.message === known.message, "an unknown address gets the same reply as a known one");

  const link = await prisma.ownerLoginToken.findFirst({ where: { email: OWNER, usedAt: null }, orderBy: { id: "desc" } });
  ok(Boolean(link), "a link was issued for the address that does own a tool");
  ok(!(await prisma.ownerLoginToken.findFirst({ where: { email: "zz-nobody@example.com" } })), "and none for the one that doesn't");

  console.log("\n2. the link is single use");
  const first = await (await api("/owner/session", { method: "POST", body: JSON.stringify({ token: link.token }) })).json();
  ok(Boolean(first.token), "it exchanges for a session");
  const replay = await api("/owner/session", { method: "POST", body: JSON.stringify({ token: link.token }) });
  ok(replay.status === 401, "and cannot be used a second time");
  const session = first.token;

  console.log("\n3. no session, no access (TEST 3 / §34)");
  ok((await api("/owner/campaigns")).status === 401, "campaigns need a session");
  ok((await api("/owner/me")).status === 401, "so does the dashboard");
  ok((await asOwner("not-a-real-token", "/owner/me")).status === 401, "an invented token is refused");

  console.log("\n4. the dashboard shows only this owner's live tools (TEST 2)");
  const me = await (await asOwner(session, "/owner/me")).json();
  ok(me.email === OWNER, "signed in as the right address");
  ok(me.tools.length === 1, `one promotable tool (${me.tools.length})`);
  ok(me.tools[0].tool.slug === tool.slug, "and it is the published one");
  ok(!me.tools.some((t) => t.submissionId === pending.id), "the pending submission is not offered for promotion");

  console.log("\n5. a campaign cannot be created for a tool you don't own (TEST 3)");
  const plans = await (await api("/promote/plans")).json();
  const plan = plans.plans.find((p) => !p.quoteOnly);
  const body = (submissionId) => JSON.stringify({
    submissionId, planSlug: plan.slug, placements: ["HOMEPAGE_FEATURED"],
    headline: "Try ZZ Promote Test", message: "A throwaway campaign.", ctaText: "Visit",
  });
  const stolen = await asOwner(session, "/owner/campaigns", { method: "POST", body: body(theirs.id) });
  ok(stolen.status === 404, `someone else's submission is refused (${stolen.status})`);

  const notLive = await asOwner(session, "/owner/campaigns", { method: "POST", body: body(pending.id) });
  const notLiveBody = await notLive.json();
  ok(notLive.status === 409, `an unapproved tool is refused (${notLive.status})`);
  ok(/needs to be approved/i.test(notLiveBody.error || ""), `and says why: "${notLiveBody.error}"`);

  console.log("\n6. creating a campaign");
  const created = await asOwner(session, "/owner/campaigns", { method: "POST", body: body(mine.id) });
  const campaign = (await created.json()).campaign;
  ok(created.status === 201, `created (${created.status})`);
  ok(campaign.status === "DRAFT", "it starts as a draft, not live");
  const row = await prisma.promotionCampaign.findUnique({ where: { slug: campaign.slug } });
  made.campaignIds.push(row.id);

  console.log("\n7. vendor copy is text, never markup (§10, §36)");
  const nasty = await asOwner(session, `/owner/campaigns/${campaign.slug}`, {
    method: "PATCH",
    body: JSON.stringify({ headline: '<script>alert(1)</script>Best <b>tool</b>' }),
  });
  const cleaned = (await nasty.json()).campaign;
  ok(!/[<>]/.test(cleaned.headline || ""), `tags stripped: "${cleaned.headline}"`);

  console.log("\n8. the outbound link cannot be pointed off the vendor's domain (§19)");
  const hijack = await asOwner(session, `/owner/campaigns/${campaign.slug}`, {
    method: "PATCH", body: JSON.stringify({ destinationUrl: "https://evil.example.net/phish" }),
  });
  ok(hijack.status === 400, `an unrelated domain is refused (${hijack.status})`);
  const sameSite = await asOwner(session, `/owner/campaigns/${campaign.slug}`, {
    method: "PATCH", body: JSON.stringify({ destinationUrl: "https://example.com/product?ref=x" }),
  });
  ok(sameSite.status === 200, "a deeper link on their own site is allowed");

  console.log("\n9. checkout without provider keys fails safely (TEST 4)");
  const checkout = await asOwner(session, `/owner/campaigns/${campaign.slug}/checkout`, { method: "POST", body: "{}" });
  const checkoutBody = await checkout.json();
  ok(checkout.status === 503, `refused with 503 while keys are unset (${checkout.status})`);
  ok(/aren't switched on|contact us/i.test(checkoutBody.error || ""), `and says so plainly: "${checkoutBody.error}"`);
  const afterCheckout = await prisma.promotionCampaign.findUnique({ where: { id: row.id } });
  ok(afterCheckout.status === "DRAFT", "the campaign did NOT advance on a failed checkout");

  console.log("\n10. a campaign cannot be talked into going live (§2, §16)");
  ok(afterCheckout.status !== "ACTIVE", "still not active");
  const featuredBefore = await (await api("/promote/featured")).json();
  ok(!featuredBefore.items.some((i) => i.slug === campaign.slug), "and it does not appear on any surface");

  console.log("\n11. once an editor activates it, it renders and counts (TEST 1)");
  await prisma.promotionCampaign.update({
    where: { id: row.id },
    data: {
      status: "ACTIVE",
      startDate: new Date(Date.now() - 60000),
      endDate: new Date(Date.now() + 86400000),
    },
  });
  const featured = await (await api("/promote/featured")).json();
  ok(featured.items.some((i) => i.slug === campaign.slug), "it is on the homepage surface");

  await api("/promote/events", {
    method: "POST",
    body: JSON.stringify({
      events: [
        { campaign: campaign.slug, type: "impression", placement: "HOMEPAGE_FEATURED" },
        { campaign: campaign.slug, type: "impression", placement: "HOMEPAGE_FEATURED" },
        { campaign: campaign.slug, type: "tool_view", placement: "HOMEPAGE_FEATURED" },
      ],
    }),
  });

  const redirect = await fetch(`${BASE}/promote/go/${campaign.slug}?p=HOMEPAGE_FEATURED`, { redirect: "manual" });
  const target = redirect.headers.get("location") || "";
  ok(redirect.status === 302, `the outbound hop redirects (${redirect.status})`);
  ok(target.startsWith("https://example.com/"), "to the vendor's own site");
  ok(/utm_source=toolhaven/.test(target) && /utm_medium=promotion/.test(target) && new URL(target).searchParams.get("utm_campaign") === campaign.slug,
    "carrying UTM tags");
  ok(!/\/\d+(\?|$)/.test(new URL(target).pathname), "and exposing no internal id");

  await new Promise((r) => setTimeout(r, 600));
  const report = (await (await asOwner(session, `/owner/campaigns/${campaign.slug}`)).json()).campaign;
  ok(report.stats.impressions === 2, `impressions counted from real events (${report.stats.impressions})`);
  ok(report.stats.toolPageViews === 1, `tool page views (${report.stats.toolPageViews})`);
  ok(report.stats.websiteClicks === 1, `website clicks (${report.stats.websiteClicks})`);
  ok(report.stats.ctr === 50, `CTR computed, not stored (${report.stats.ctr}%)`);
  ok(/do not necessarily represent conversions/i.test(report.stats.note || ""), "with the honest caveat attached");

  console.log("\n12. inventory is a real count (§25)");
  const avail = (await (await api("/promote/plans")).json()).placements.find((p) => p.key === "HOMEPAGE_FEATURED");
  ok(avail.taken === 1, `one homepage slot taken (${avail.taken}/${avail.maxActive})`);
  ok(avail.free === avail.maxActive - 1, "and the free count follows from it");

  console.log("\n13. a vendor sees only their own campaigns (TEST 9)");
  await prisma.ownerLoginToken.deleteMany({ where: { email: STRANGER } });
  await api("/owner/login", { method: "POST", body: JSON.stringify({ email: STRANGER }) });
  const theirLink = await prisma.ownerLoginToken.findFirst({ where: { email: STRANGER, usedAt: null }, orderBy: { id: "desc" } });
  const theirSession = (await (await api("/owner/session", { method: "POST", body: JSON.stringify({ token: theirLink.token }) })).json()).token;
  const theirList = await (await asOwner(theirSession, "/owner/campaigns")).json();
  ok(theirList.items.length === 0, `the other owner sees none of it (${theirList.items.length})`);
  ok((await asOwner(theirSession, `/owner/campaigns/${campaign.slug}`)).status === 404,
    "and cannot open it by slug");

  console.log("\n14. expiry removes it from every surface (TEST 6, §27)");
  await prisma.promotionCampaign.update({
    where: { id: row.id },
    // Still ACTIVE in the column: this proves the *query* refuses it, so a
    // stopped scheduler cannot leave a finished campaign on the homepage.
    data: { startDate: new Date(Date.now() - 172800000), endDate: new Date(Date.now() - 3600000) },
  });
  const after = await (await api("/promote/featured")).json();
  ok(!after.items.some((i) => i.slug === campaign.slug), "gone from the homepage, though its status still says ACTIVE");

  const lateClick = await fetch(`${BASE}/promote/go/${campaign.slug}`, { redirect: "manual" });
  ok(lateClick.status === 302, "an old shared link still works for the reader");
  await new Promise((r) => setTimeout(r, 400));
  const afterExpiry = (await (await asOwner(session, `/owner/campaigns/${campaign.slug}`)).json()).campaign;
  ok(afterExpiry.stats.websiteClicks === 1, "but stops counting — nobody paid for those days");

  console.log("\n15. unknown payment references settle nothing (TEST 5)");
  const bogus = await asOwner(session, `/owner/campaigns/${campaign.slug}/settle`, {
    method: "POST", body: JSON.stringify({ reference: "thp_not_a_real_reference" }),
  });
  ok(bogus.status === 404, `an invented reference is refused (${bogus.status})`);
}

async function cleanup() {
  console.log("\n16. cleaning up");
  await prisma.promotionEvent.deleteMany({ where: { campaignId: { in: made.campaignIds } } });
  await prisma.promotionPayment.deleteMany({ where: { campaignId: { in: made.campaignIds } } });
  await prisma.promotionAudit.deleteMany({ where: { campaignId: { in: made.campaignIds } } });
  await prisma.promotionCampaign.deleteMany({ where: { id: { in: made.campaignIds } } });
  await prisma.ownerSession.deleteMany({ where: { email: { in: [OWNER, STRANGER] } } });
  await prisma.ownerLoginToken.deleteMany({ where: { email: { in: [OWNER, STRANGER, "zz-nobody@example.com"] } } });
  await prisma.emailEvent.deleteMany({ where: { submissionId: { in: made.submissionIds } } });
  await prisma.toolSubmission.deleteMany({ where: { id: { in: made.submissionIds } } });
  await prisma.tool.deleteMany({ where: { id: { in: made.toolIds } } });

  const leftovers = await prisma.promotionCampaign.count();
  const tools = await prisma.tool.count({ where: { slug: { startsWith: "zz-promote-test" } } });
  ok(tools === 0, "throwaway tool removed");
  console.log(`  campaigns left in the database: ${leftovers}`);
}

main()
  .catch((e) => { fail++; console.log("\nTHREW: " + (e.stack || e.message)); })
  .finally(async () => {
    await cleanup().catch((e) => console.log("cleanup problem: " + e.message));
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
