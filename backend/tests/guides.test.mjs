/**
 * Buying guides, end to end against a live server.
 *   node tests/guides.test.mjs [baseUrl]
 *
 * Covers the editorial workflow, the Amazon link validation, the draft/publish
 * boundary, and the two things this section must never do: publish an empty
 * page, or print a price.
 */
const BASE = process.argv[2] || "http://localhost:4002";
const A = { "content-type": "application/json", "x-admin-token": "303100" };

let pass = 0, fail = 0;
const group = (s) => console.log("\n" + s);
const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? "  PASS  " : "  FAIL  ") + m + (!c && d ? "   -> " + d : "")); };
const eq = (a, b, m) => ok(a === b, m, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);
const j = async (r) => { try { return await r.json(); } catch { return {}; } };
const post = (p, b, h = {}) => fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) });
const patch = (p, b, h = {}) => fetch(BASE + p, { method: "PATCH", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) });
const put = (p, b, h = {}) => fetch(BASE + p, { method: "PUT", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) });

let guideId = null, slug = null;

group("Authorisation");
eq((await fetch(BASE + "/api/admin/guides")).status, 401, "the desk needs the editor token");
eq((await post("/api/admin/guides", { title: "X" })).status, 401, "so does creating one");

group("Starting a guide");
{
  eq((await post("/api/admin/guides", {}, A)).status, 400, "a guide with no title is refused");

  const r = await post("/api/admin/guides", {
    title: "Best monitors for software developers in 2026",
    standfirst: "Two panels, one budget, and the trade-offs nobody mentions.",
  }, A);
  const b = await j(r);
  eq(r.status, 201, "a titled guide is created");
  eq(b.guide.status, "draft", "and starts as a draft");
  eq(b.guide.slug, "best-monitors-for-software-developers-in-2026", "with a slug from the title");
  guideId = b.guide.id; slug = b.guide.slug;

  eq((await post("/api/admin/guides", { title: "Best monitors for software developers in 2026" }, A)).status, 400,
    "a duplicate slug is refused");
}

group("A draft is invisible");
eq((await fetch(BASE + "/api/guides/" + slug)).status, 404, "a draft 404s on the public route");
{
  const list = await j(await fetch(BASE + "/api/guides"));
  ok(!list.items.some((g) => g.slug === slug), "and does not appear in the public index");
}

group("Publishing needs something to publish");
{
  const empty = await patch("/api/admin/guides/" + guideId, { status: "published" }, A);
  eq(empty.status, 400, "an empty guide cannot be published");
  ok(/thin page/i.test((await j(empty)).error || ""), "and says why");
}

group("Amazon links are checked, not trusted");
{
  const bad = await put("/api/admin/guides/" + guideId + "/picks", {
    picks: [{ name: "Dell U2723QE", amazonUrl: "https://definitely-not-amazon.example/dp/123" }],
  }, A);
  eq(bad.status, 400, "a non-Amazon host is refused");
  ok(/isn't an Amazon domain/i.test((await j(bad)).error || ""), "and names the host it rejected");

  const insecure = await put("/api/admin/guides/" + guideId + "/picks", {
    picks: [{ name: "Dell U2723QE", amazonUrl: "http://www.amazon.com/dp/B09" }],
  }, A);
  eq(insecure.status, 400, "http is refused");

  const nameless = await put("/api/admin/guides/" + guideId + "/picks", { picks: [{ name: "" }] }, A);
  eq(nameless.status, 400, "a pick with no product name is refused");
}

group("Filling it in");
{
  const r = await put("/api/admin/guides/" + guideId + "/picks", {
    picks: [
      {
        award: "Best overall", name: "Dell UltraSharp U2723QE", brand: "Dell",
        verdict: "The one to buy if you only buy one. Sharp enough to stop thinking about pixels.",
        bestFor: "Long days in a text editor",
        considerElseIf: "You need colour accuracy for print work",
        specs: [{ label: "Size", value: "27 inch" }, { label: "Resolution", value: "4K" }],
        pros: "Excellent text clarity\nUSB-C with 90W charging",
        cons: "Not for fast-paced gaming\nStand is bulky",
        amazonUrl: "https://www.amazon.com/dp/B09VXBSN2C?tag=toolhaven-20",
        asin: "B09VXBSN2C",
      },
      {
        award: "Best budget", name: "LG 27UP850N", brand: "LG",
        verdict: "Most of the same panel for meaningfully less money.",
        bestFor: "A second screen without a second mortgage",
        considerElseIf: "You want the very best text rendering",
        specs: [{ label: "Size", value: "27 inch" }, { label: "Resolution", value: "4K" }],
        pros: "Cheaper than the Dell\nSame resolution",
        cons: "Weaker build\nColour needs calibrating",
        amazonUrl: "https://amzn.to/example123",
      },
    ],
  }, A);
  eq(r.status, 200, "two picks save");
  eq((await j(r)).count, 2, "both of them");

  const faqs = await put("/api/admin/guides/" + guideId + "/faqs", {
    faqs: [
      { question: "Is 4K worth it at 27 inches?", answer: "For text, yes. For games, less so." },
      { question: "", answer: "dropped" },
    ],
  }, A);
  eq((await j(faqs)).count, 1, "empty questions are dropped rather than saved blank");
}

group("Publishing");
{
  const r = await patch("/api/admin/guides/" + guideId, { status: "published" }, A);
  eq(r.status, 200, "a guide with picks publishes");
  ok(!!(await j(r)).guide.publishedAt, "and stamps when");

  const pub = await j(await fetch(BASE + "/api/guides/" + slug));
  eq(pub.slug, slug, "it is now on the public route");
  eq(pub.picks.length, 2, "with both picks");
  eq(pub.picks[0].award, "Best overall", "in the order they were saved");
  eq(pub.faqs.length, 1, "and the question");

  // The two things this section must never do.
  const raw = JSON.stringify(pub);
  ok(!/"price"|"rating"|"reviewCount"/.test(raw), "no price or rating field reaches a reader");
  ok(pub.picks.every((p) => p.pros.length && p.cons.length), "every pick carries both sides");

  const idx = await j(await fetch(BASE + "/api/guides"));
  ok(idx.items.some((g) => g.slug === slug), "and it appears in the index");
}

group("Withdrawing");
{
  await patch("/api/admin/guides/" + guideId, { status: "draft" }, A);
  eq((await fetch(BASE + "/api/guides/" + slug)).status, 404, "withdrawing takes it off the public route");

  const back = await j(await patch("/api/admin/guides/" + guideId, { status: "published" }, A));
  ok(!!back.guide.publishedAt, "republishing keeps the original publication date");
}

group("Cleanup");
{
  eq((await fetch(BASE + "/api/admin/guides/" + guideId, { method: "DELETE", headers: A })).status, 200, "the guide is deleted");
  eq((await fetch(BASE + "/api/guides/" + slug)).status, 404, "and is gone from the public route");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
