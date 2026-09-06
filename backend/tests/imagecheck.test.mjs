/**
 * The case that mattered: upload id 1 in the live database is a 68-byte PNG
 * declaring 512×512 with no pixel data. It passed every check the route made
 * and rendered as a broken icon. These tests pin that shape as a rejection,
 * and pin real images as accepted so the check cannot be tightened into
 * uselessness later.
 */
import { imageComplaint } from "../src/lib/imagecheck.js";
import zlib from "node:zlib";

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) pass++; else { fail++; console.log("FAIL " + what); } };
const rejects = (buf, mime, what) => {
  const c = imageComplaint(buf, mime);
  if (c) pass++; else { fail++; console.log("FAIL (should have been rejected) " + what); }
};
const accepts = (buf, mime, what) => {
  const c = imageComplaint(buf, mime);
  if (!c) pass++; else { fail++; console.log(`FAIL (should have been accepted) ${what}\n  said: ${c}`); }
};

// --- PNG construction ------------------------------------------------------
const crcTable = [...Array(256)].map((_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
const crc = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = (w, h) => { const b = Buffer.alloc(13); b.writeUInt32BE(w, 0); b.writeUInt32BE(h, 4); b[8] = 8; b[9] = 2; return b; };

const realPng = (w = 64, h = 64) => {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 31; raw[o + 1] = 94; raw[o + 2] = 255;
  }
  return Buffer.concat([SIG, chunk("IHDR", ihdr(w, h)), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};

accepts(realPng(), "image/png", "a real 64x64 PNG");
accepts(realPng(512, 512), "image/png", "a real 512x512 PNG");

// The exact shape of the file that broke: header, end marker, no picture.
const headerOnly = Buffer.concat([SIG, chunk("IHDR", ihdr(512, 512)), chunk("IEND", Buffer.alloc(0))]);
ok(headerOnly.length < 100, "the reproduction really is a tiny file");
rejects(headerOnly, "image/png", "a PNG with a 512x512 header and no IDAT");

// An empty IDAT is the same failure wearing a chunk.
rejects(Buffer.concat([SIG, chunk("IHDR", ihdr(512, 512)), chunk("IDAT", Buffer.alloc(0)), chunk("IEND", Buffer.alloc(0))]),
  "image/png", "a PNG whose IDAT is empty");

// Cut off mid-transfer.
const truncated = realPng().subarray(0, 40);
rejects(truncated, "image/png", "a PNG cut off part-way");

// Complete but with the end marker missing.
const noEnd = Buffer.concat([SIG, chunk("IHDR", ihdr(64, 64)), chunk("IDAT", zlib.deflateSync(Buffer.alloc(64 * 3 * 64 + 64)))]);
rejects(noEnd, "image/png", "a PNG with no IEND");

// A chunk claiming more data than the file holds.
const liar = Buffer.concat([SIG, Buffer.from([0x00, 0x0F, 0x42, 0x40]), Buffer.from("IDAT"), Buffer.alloc(20)]);
rejects(liar, "image/png", "a PNG chunk whose length runs past the end");

// --- JPEG ------------------------------------------------------------------
const jpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(30),
  Buffer.from([0xff, 0xda]), Buffer.alloc(200),        // SOS + scan data
  Buffer.from([0xff, 0xd9]),                            // EOI
]);
accepts(jpeg, "image/jpeg", "a JPEG with a scan and an end marker");
rejects(jpeg.subarray(0, jpeg.length - 4), "image/jpeg", "a JPEG missing its end marker");
rejects(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40), Buffer.from([0xff, 0xd9])]),
  "image/jpeg", "a JPEG with headers but no scan");

// --- GIF / WEBP ------------------------------------------------------------
accepts(Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(40), Buffer.from([0x3b])]), "image/gif", "a terminated GIF");
rejects(Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(40)]), "image/gif", "a GIF with no terminator");

const webp = Buffer.alloc(64); webp.write("RIFF", 0); webp.writeUInt32LE(56, 4); webp.write("WEBP", 8);
accepts(webp, "image/webp", "a WEBP whose declared length matches");
const webpLiar = Buffer.alloc(64); webpLiar.write("RIFF", 0); webpLiar.writeUInt32LE(900000, 4); webpLiar.write("WEBP", 8);
rejects(webpLiar, "image/webp", "a WEBP declaring more data than it holds");

// --- SVG -------------------------------------------------------------------
accepts(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64"/></svg>'),
  "image/svg+xml", "an SVG with a shape in it");
rejects(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'),
  "image/svg+xml", "an SVG with no closing tag");
rejects(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>x</title></svg>'),
  "image/svg+xml", "an SVG with no drawable shapes");

// --- degenerate ------------------------------------------------------------
rejects(Buffer.alloc(4), "image/png", "four bytes");
rejects(Buffer.from("not an image at all"), "image/png", "plain text");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
