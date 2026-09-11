/**
 * Adding a pick must not strip the photos off the picks before it.
 *
 * The bug, as it happened: save pick A with photos; the editor reloads the
 * guide; the API sends each photo as its raw join row, whose `id` is the row's
 * id; you add pick B and save; the server reads that row id as an image id,
 * finds no such image, and drops the photo. Every earlier pick lost its
 * pictures, and a row id that happened to match a different image would have
 * attached the wrong one.
 *
 * This replays that sequence exactly — including sending the reloaded guide
 * back unmodified, the way the editor does — against a live server, on a
 * throwaway guide that is deleted at the end.
 *
 *   PORT=4100 node src/server.js   then   node tests/pickphotos.test.mjs
 */
import zlib from "node:zlib";
import { PrismaClient } from "@prisma/client";

const API = process.env.API || "http://localhost:4100/api";
const TOKEN = process.env.ADMIN_TOKEN || "303100";
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) { pass++; console.log("  ok   " + what); } else { fail++; console.log("  FAIL " + what); } };
const admin = (path, opts = {}) => fetch(API + path, {
  ...opts, headers: { "x-admin-token": TOKEN, "content-type": "application/json", ...(opts.headers || {}) },
});

// Real PNGs whose pixel data matches their header — the upload route refuses
// anything else — each tinted differently so no two share a hash.
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
const crc32 = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (t, d) => {
  const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t), d]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
  return Buffer.concat([l, td, c]);
};
const png = (w, h, tint) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = tint; raw[o + 1] = (x * 7 + tint) & 255; raw[o + 2] = (y * 3) & 255;
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};
const upload = async (buf) => (await fetch(API + "/uploads", {
  method: "POST", body: buf, headers: { "content-type": "image/png" },
})).json();

const made = [];   // upload ids this test created, removed at the end
let guideId = null;

try {
  console.log("\n1. three photos and a throwaway guide");
  const [u1, u2, u3] = [await upload(png(400, 300, 11)), await upload(png(420, 300, 97)), await upload(png(440, 300, 203))];
  made.push(u1.id, u2.id, u3.id);
  ok([u1, u2, u3].every((u) => Number.isInteger(u.id)), `uploaded ${u1.id}, ${u2.id}, ${u3.id}`);
  const g = (await (await admin("/admin/guides", {
    method: "POST", body: JSON.stringify({ title: "ZZ pick photo regression", slug: "zz-pick-photo-regression" }),
  })).json()).guide;
  guideId = g.id;
  ok(!!guideId, "guide " + guideId);

  console.log("\n2. save pick A with two photos");
  await admin(`/admin/guides/${guideId}/picks`, {
    method: "PUT", body: JSON.stringify({ picks: [{ name: "Pick A", photos: [{ id: u1.id }, { id: u2.id }] }] }),
  });

  console.log("\n3. reload, the way the editor does after every save");
  const reloaded = (await (await admin(`/admin/guides/${guideId}`)).json()).guide;
  const A = reloaded.picks[0];
  ok(A.photos.length === 2, "pick A came back with two photos");
  ok(A.photos.every((ph) => ph.id === ph.uploadId), "each photo's id IS its image id — no join-row id to confuse");
  ok(A.photos.every((ph) => ph.url === `/api/uploads/${ph.uploadId}`), "and each has a url to draw the thumbnail from");
  ok(A.photos.every((ph) => ph.width === 400 || ph.width === 420), "with real dimensions for the editor");

  console.log("\n4. add pick B and save the whole list — the step that used to wipe pick A");
  const picks = [...reloaded.picks, { name: "Pick B", photos: [{ id: u3.id }] }];
  const saved = await admin(`/admin/guides/${guideId}/picks`, { method: "PUT", body: JSON.stringify({ picks }) });
  ok(saved.status === 200, "saved (" + saved.status + ")");
  const after = (await (await admin(`/admin/guides/${guideId}`)).json()).guide;
  ok(after.picks[0].photos.map((p) => p.uploadId).join() === [u1.id, u2.id].join(),
    "pick A still has BOTH its photos, in order — got " + after.picks[0].photos.map((p) => p.uploadId).join());
  ok(after.picks[1].photos.map((p) => p.uploadId).join() === String(u3.id), "pick B has its photo");
  ok(after.picks[0].imageId === u1.id, "pick A's lead image is unchanged");

  console.log("\n5. save it five more times without touching anything");
  for (let n = 0; n < 5; n++) {
    const cur = (await (await admin(`/admin/guides/${guideId}`)).json()).guide;
    await admin(`/admin/guides/${guideId}/picks`, { method: "PUT", body: JSON.stringify({ picks: cur.picks }) });
  }
  const five = (await (await admin(`/admin/guides/${guideId}`)).json()).guide;
  ok(five.picks[0].photos.length === 2 && five.picks[1].photos.length === 1, "nothing decays across repeated saves");

  console.log("\n6. an old-shape payload — the join row as the editor used to send it");
  // The row id deliberately points at a real, *different* image: exactly the
  // case that would have swapped in the wrong picture.
  await admin(`/admin/guides/${guideId}/picks`, {
    method: "PUT",
    body: JSON.stringify({ picks: [{ name: "Pick A", photos: [{ id: u3.id, uploadId: u1.id }] }] }),
  });
  const old = (await (await admin(`/admin/guides/${guideId}`)).json()).guide;
  ok(old.picks[0].photos[0].uploadId === u1.id, "uploadId wins over id — the right picture, not the one the row id matched");

  console.log("\n7. the recent-uploads tray");
  const recent = await (await admin("/admin/guides/uploads/recent")).json();
  const ids = (recent.items || []).map((r) => r.id);
  ok(Array.isArray(recent.items), "returns a list");
  ok(!ids.includes(u1.id), "an image on a pick is not offered");
  ok(ids.includes(u2.id) && ids.includes(u3.id), "images no longer on any pick are offered back");
  ok((recent.items || []).every((r) => r.width >= 300 && r.url), "only product-sized images, each with a url");
  const unauth = await fetch(API + "/admin/guides/uploads/recent");
  ok(unauth.status === 401 || unauth.status === 403, "and it is admin-only (" + unauth.status + ")");
} finally {
  console.log("\n8. cleaning up");
  if (guideId) await admin(`/admin/guides/${guideId}`, { method: "DELETE" });
  if (made.length) await prisma.upload.deleteMany({ where: { id: { in: made } } }).catch(() => {});
  const left = await prisma.buyingGuide.count({ where: { slug: "zz-pick-photo-regression" } });
  ok(left === 0, "throwaway guide and its uploads removed");
  await prisma.$disconnect();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
