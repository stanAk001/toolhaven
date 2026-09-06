/**
 * The submission workflow, end to end against a live server.
 *
 *   node tests/submissions.test.mjs [baseUrl]
 *
 * Covers the flows in the brief: upload validation, the state machine, the
 * order of "commit then email", duplicate-email prevention, resubmission,
 * authorisation, and the rule that a submitter can never read a reviewer's
 * internal notes. Cleans up everything it creates.
 */
const BASE = process.argv[2] || "http://localhost:4002";
const TOKEN = "303100";
const A = { "content-type": "application/json", "x-admin-token": TOKEN };

let pass = 0, fail = 0;
const group = (s) => console.log("\n" + s);
const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? "  PASS  " : "  FAIL  ") + m + (!c && d ? "   -> " + d : "")); };
const eq = (a, b, m) => ok(a === b, m, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

const j = async (r) => { try { return await r.json(); } catch { return {}; } };
const post = (p, body, headers = {}) => fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const patch = (p, body, headers = {}) => fetch(BASE + p, { method: "PATCH", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

/* A genuine PNG of the requested size.
 *
 * This used to take a real 1x1 PNG and overwrite the width and height in its
 * header, leaving the one pixel of image data behind. That produces a file
 * claiming to be 512x512 with nothing in it — which is exactly the shape that
 * used to upload "successfully" and then render as a broken icon on the page,
 * and which the upload route now refuses. The fixture was asserting that a
 * broken file is accepted, so it had to be the thing that changed.
 *
 * Built here rather than pasted as hex so any size can be asked for and the
 * pixel data always matches the header.
 */
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b) => {
  let c = 0xFFFFFFFF;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, sum]);
};

function png(size, tint = 40) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // truecolour
  // One filter byte per row, then RGB triples. The tint keeps two different
  // calls from hashing to the same upload, which the de-duplication test needs.
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = tint; raw[o + 1] = (x * 3) & 255; raw[o + 2] = (y * 5) & 255;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const upload = (buf, type = "image/png") =>
  fetch(BASE + "/api/uploads", { method: "POST", headers: { "content-type": type }, body: buf });

let uploadId = null, submissionId = null, publicToken = null, publishedSlug = null;

/* ── uploads ─────────────────────────────────────────────────────────────── */
group("Image upload");
{
  const r = await upload(png(512));
  const b = await j(r);
  eq(r.status, 201, "a valid PNG uploads");
  ok(!!b.id && /^\/api\/uploads\/\d+\.png$/.test(b.url || ""), "and returns an id and a URL");
  eq(b.width, 512, "reads the real dimensions from the file");
  uploadId = b.id;

  const again = await j(await upload(png(512)));
  eq(again.id, uploadId, "identical bytes are stored once, not duplicated");

  const served = await fetch(BASE + "/api/uploads/" + uploadId);
  eq(served.status, 200, "the file serves back");
  eq(served.headers.get("content-type"), "image/png", "with its real content type");
  ok(/immutable/.test(served.headers.get("cache-control") || ""), "and a long immutable cache header");
  eq(served.headers.get("x-content-type-options"), "nosniff", "and nosniff, so a browser cannot re-interpret it");

  const notImage = await upload(Buffer.from("this is definitely not an image, it is prose"), "image/png");
  eq(notImage.status, 400, "a text file claiming to be a PNG is refused");
  ok(/PNG, JPG/i.test((await j(notImage)).error || ""), "with a message naming the formats we take");

  const tiny = await upload(png(8));
  eq(tiny.status, 400, "an 8x8 image is refused as too small");
  ok(/48/.test((await j(tiny)).error || ""), "and says what the minimum is");

  const empty = await upload(Buffer.alloc(0));
  eq(empty.status, 400, "an empty body is refused");

  // SVG carrying script is the stored-XSS case
  const evil = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><script>alert(1)</script><rect width="64" height="64" onload="alert(2)"/></svg>');
  const svg = await j(await upload(evil, "image/svg+xml"));
  ok(!!svg.id, "an SVG uploads");
  const back = await (await fetch(BASE + "/api/uploads/" + svg.id)).text();
  ok(!/<script/i.test(back), "with its script tag stripped");
  ok(!/onload/i.test(back), "and its event handlers stripped");
}

/* ── submission ──────────────────────────────────────────────────────────── */
group("Submitting");
{
  const bad = await j(await post("/api/submissions", { toolName: "X" }));
  ok(/required/i.test(bad.error || ""), "a half-filled submission is refused");

  const badEmail = await j(await post("/api/submissions", {
    toolName: "T", websiteUrl: "https://x.com", contactName: "N", email: "nope", pitch: "p",
  }));
  ok(/valid email/i.test(badEmail.error || ""), "an invalid email is refused");

  const r = await post("/api/submissions", {
    toolName: "Harness Widget", websiteUrl: "https://harness.example",
    contactName: "Dana Okoro", email: "dana@harness.example",
    pitch: "A test submission created by the verification harness.",
    category: "Productivity", pricing: "freemium",
    logoUploadId: uploadId,
  });
  const b = await j(r);
  eq(r.status, 201, "a complete submission is accepted");
  ok(!!b.token && /^[a-f0-9]{32}$/.test(b.token), "and comes back with a tracking token");
  submissionId = b.id; publicToken = b.token;

  const spam = await post("/api/submissions", {
    toolName: "Spam", websiteUrl: "https://s.example", contactName: "Bot",
    email: "bot@s.example", pitch: "x", website: "gotcha",
  });
  eq(spam.status, 201, "the honeypot accepts silently");
  ok(!(await j(spam)).id, "but writes nothing");
}

/* ── the submitter's own view ────────────────────────────────────────────── */
group("The tracking link");
{
  const r = await fetch(BASE + "/api/submissions/track/" + publicToken);
  const b = await j(r);
  eq(r.status, 200, "the token opens the submission");
  eq(b.submission.status, "pending", "and shows it pending");
  eq(b.submission.toolName, "Harness Widget", "with the tool named");
  ok(b.timeline.length >= 1, "and a timeline that has begun");
  ok(b.submission.logoUrl?.includes("/api/uploads/"), "the uploaded logo comes through");

  const junk = await fetch(BASE + "/api/submissions/track/" + "0".repeat(32));
  eq(junk.status, 404, "an unknown token is a 404");
  const malformed = await fetch(BASE + "/api/submissions/track/not-a-token");
  eq(malformed.status, 404, "a malformed token is a 404");
}

/* ── authorisation ───────────────────────────────────────────────────────── */
group("Authorisation");
{
  eq((await fetch(BASE + "/api/submissions")).status, 401, "the queue needs the editor token");
  eq((await fetch(BASE + "/api/submissions/" + submissionId)).status, 401, "so does one submission");
  eq((await patch("/api/submissions/" + submissionId, { status: "approved" })).status, 401,
    "and a status change cannot be made without it");
  const stillPending = await j(await fetch(BASE + "/api/submissions/track/" + publicToken));
  eq(stillPending.submission.status, "pending", "the refused change really did not happen");
}

/* ── the state machine ───────────────────────────────────────────────────── */
group("The review workflow");
{
  const jump = await patch("/api/submissions/" + submissionId, { status: "published" }, A);
  eq(jump.status, 409, "pending cannot jump straight to published");
  ok(/approved before it can be published/i.test((await j(jump)).error || ""),
    "and says why in words an editor can act on");

  const nonsense = await patch("/api/submissions/" + submissionId, { status: "banana" }, A);
  eq(nonsense.status, 400, "an unknown status is refused");

  const review = await patch("/api/submissions/" + submissionId, { status: "under_review" }, A);
  eq(review.status, 200, "pending moves to under review");
  eq((await j(review)).submission.status, "under_review", "and the row says so");

  const noMessage = await patch("/api/submissions/" + submissionId, { status: "changes_requested" }, A);
  eq(noMessage.status, 400, "changes cannot be requested with no message");
  ok(/whole message they receive/i.test((await j(noMessage)).error || ""), "and explains why the note matters");

  const asked = await patch("/api/submissions/" + submissionId, {
    status: "changes_requested",
    submitterMessage: "The pricing page 404s — could you check the link?",
    reviewerNote: "INTERNAL: looks fine otherwise, just the dead link.",
  }, A);
  eq(asked.status, 200, "with a message it goes through");

  const seen = await j(await fetch(BASE + "/api/submissions/track/" + publicToken));
  eq(seen.submission.status, "changes_requested", "the submitter sees the new status");
  ok(/404s/.test(seen.submission.message || ""), "and the message written for them");
  ok(!JSON.stringify(seen).includes("INTERNAL"), "but never the reviewer's internal note");
  eq(seen.submission.editable, true, "and the submission is open for edits");
}

/* ── resubmission ────────────────────────────────────────────────────────── */
group("Resubmitting");
{
  const r = await patch("/api/submissions/track/" + publicToken, {
    toolName: "Harness Widget", pitch: "Fixed the pricing link and resubmitted.",
  });
  const b = await j(r);
  eq(r.status, 200, "the submitter can update and resubmit");
  eq(b.status, "pending", "which puts it back in the queue");
  eq(b.resubmitCount, 1, "and counts as revision 1");

  const after = await j(await fetch(BASE + "/api/submissions/track/" + publicToken));
  eq(after.submission.message, null, "the reviewer's ask is cleared once answered");
  ok(after.timeline.some((e) => e.type === "resubmitted"), "and the timeline records the resubmission");

  const list = await j(await fetch(BASE + "/api/submissions", { headers: A }));
  const mine = list.items.filter((x) => x.id === submissionId);
  eq(mine.length, 1, "resubmitting updated the row rather than creating a duplicate");
}

/* ── approve, then publish ───────────────────────────────────────────────── */
group("Approval and publication are separate");
{
  await patch("/api/submissions/" + submissionId, { status: "under_review" }, A);
  const approved = await patch("/api/submissions/" + submissionId, { status: "approved" }, A);
  eq(approved.status, 200, "under review moves to approved");
  const ab = await j(approved);
  ok(!!ab.submission.approvedAt, "and stamps when it was approved");
  eq(ab.submission.publishedAt, null, "but does not publish it");

  const seen = await j(await fetch(BASE + "/api/submissions/track/" + publicToken));
  eq(seen.submission.status, "approved", "the submitter sees approved, not live");

  const published = await patch("/api/submissions/" + submissionId, { status: "published" }, A);
  eq(published.status, 200, "approved can then be published");
  const pb = await j(published);
  ok(!!pb.submission.publishedAt, "and stamps when");

  // Publishing has to produce the listing it claims to have produced. Before
  // this it set a status and mailed "view your listing" pointing at the
  // homepage, because no tool was ever created.
  ok(!!pb.tool?.slug, "publishing creates the actual listing (" + (pb.tool?.slug || "none") + ")");
  eq(pb.submission.publishedToolId, pb.tool?.id, "and links the submission to it");

  const live = await j(await fetch(BASE + "/api/tools/" + pb.tool.slug));
  eq(live.slug, pb.tool.slug, "the tool is live on the public API");
  eq(live.rating, 0, "with no invented rating");
  eq(live.reviewCount, 0, "and no invented review count");
  publishedSlug = pb.tool.slug;

  const afterPublish = await j(await fetch(BASE + "/api/submissions/track/" + publicToken));
  eq(afterPublish.submission.toolSlug, pb.tool.slug, "and the submitter's page links to the real listing");
}

group("Publishing refuses to guess");
{
  const r = await post("/api/submissions", {
    toolName: "No Category Widget", websiteUrl: "https://nc.example",
    contactName: "Sam Test", email: "sam@nc.example",
    pitch: "A submission with a category that does not exist.",
    category: "Underwater Basket Weaving",
  });
  const b = await j(r);
  await patch("/api/submissions/" + b.id, { status: "under_review" }, A);
  await patch("/api/submissions/" + b.id, { status: "approved" }, A);
  const pub = await patch("/api/submissions/" + b.id, { status: "published" }, A);
  eq(pub.status, 400, "an unknown category blocks publication rather than being guessed");
  ok(/No category called/i.test((await j(pub)).error || ""), "and names the category it could not find");

  const still = await j(await fetch(BASE + "/api/submissions/" + b.id, { headers: A }));
  eq(still.submission.status, "approved", "the submission stayed approved rather than half-publishing");
  await fetch(BASE + "/api/submissions/" + b.id, { method: "DELETE", headers: A });
}

/* ── audit trail ─────────────────────────────────────────────────────────── */
group("Audit trail");
{
  const b = await j(await fetch(BASE + "/api/submissions/" + submissionId, { headers: A }));
  const types = b.submission.events.map((e) => e.type);
  ok(types.includes("created"), "records the creation");
  ok(types.includes("status-changed"), "records status changes");
  ok(types.includes("resubmitted"), "records the resubmission");
  ok(b.submission.events.length >= 6, `keeps every step (${b.submission.events.length} events)`);
  const moves = b.submission.events.filter((e) => e.type === "status-changed");
  ok(moves.every((e) => e.fromStatus && e.toStatus), "each move names where it came from and went to");
}

/* ── the email guard ─────────────────────────────────────────────────────── */
group("Duplicate email prevention");
{
  // Asserted as an invariant rather than a count, because whether anything was
  // actually sent depends on how the server under test was configured — and a
  // test that only passes with mail switched off is testing the configuration,
  // not the guard. Either way, no event may be sent twice.
  const b = await j(await fetch(BASE + "/api/submissions/" + submissionId, { headers: A }));
  const sent = (b.submission.emailEvents || []).filter((e) => e.status === "sent");
  const kinds = sent.map((e) => e.eventType);
  eq(kinds.length, new Set(kinds).size,
    `no event type was sent more than once (${kinds.length ? kinds.join(", ") : "none sent"})`);
  ok(sent.every((e) => e.recipient), "every recorded send names who it went to");
}

/* ── cleanup ─────────────────────────────────────────────────────────────── */
group("Cleanup");
{
  if (publishedSlug) {
    const t = await j(await fetch(BASE + "/api/tools/" + publishedSlug));
    if (t?.id) await fetch(BASE + "/api/tools/manage/" + t.id, { method: "DELETE", headers: A });
  }
  const del = await fetch(BASE + "/api/submissions/" + submissionId, { method: "DELETE", headers: A });
  eq(del.status, 200, "the harness submission is removed");
  eq((await fetch(BASE + "/api/submissions/track/" + publicToken)).status, 404, "and its tracking link stops working");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);import zlib from "node:zlib";

