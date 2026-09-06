/**
 * Image upload, held in Postgres.
 *
 * Render's filesystem is ephemeral, so a file written to disk is gone on the
 * next deploy — which is the worst kind of bug, because it works perfectly
 * until the day it silently doesn't. Logos are small and few, so they live in
 * the database and are served from here.
 *
 * The body is the raw image rather than multipart form data. That avoids a
 * parsing dependency for a single field, and it means the size cap is enforced
 * by Express before a byte reaches this code.
 *
 * The type is decided by reading the file's own header, never by trusting the
 * extension or the declared Content-Type — both of which are attacker-supplied.
 */
import { Router } from "express";
import express from "express";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { imageComplaint } from "../lib/imagecheck.js";

const router = Router();

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Identify an image by its magic bytes.
 * @returns {{mime:string, ext:string} | null}
 */
function sniff(buf) {
  if (buf.length < 12) return null;
  const b = buf;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { mime: "image/gif", ext: "gif" };

  // SVG is text, so it is sniffed by content. It is also the one format here
  // that can carry script, so it is sanitised below rather than trusted.
  const head = b.toString("utf8", 0, Math.min(b.length, 1000)).trim();
  if (/^<\?xml|^<svg/i.test(head) && /<svg[\s>]/i.test(head)) return { mime: "image/svg+xml", ext: "svg" };
  return null;
}

/**
 * Strip anything executable from an SVG.
 *
 * An uploaded SVG served from our own origin is a stored-XSS vector: it can
 * carry <script>, event handlers and external references. Rather than parse it
 * properly, anything that can execute is removed and the result is served with
 * a Content-Security-Policy that forbids scripts regardless.
 */
function sanitiseSvg(buf) {
  let s = buf.toString("utf8");
  s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "")
    .replace(/<!ENTITY[\s\S]*?>/gi, "");
  return Buffer.from(s, "utf8");
}

/** Pixel dimensions, where the format makes them cheap to read. */
function dimensions(buf, mime) {
  try {
    if (mime === "image/png") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (mime === "image/gif") return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    if (mime === "image/jpeg") {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        // SOF0..SOF15, excluding the non-frame markers in that range
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (mime === "image/svg+xml") {
      const s = buf.toString("utf8", 0, 2000);
      const vb = s.match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i);
      if (vb) return { width: Math.round(+vb[1]), height: Math.round(+vb[2]) };
    }
  } catch { /* dimensions are a nicety, not a gate */ }
  return { width: null, height: null };
}

// POST /api/uploads — the raw image is the body
router.post("/",
  express.raw({ type: ["image/*", "application/octet-stream"], limit: MAX_BYTES }),
  ah(async (req, res, next) => {
    const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; return next(e); };

    let buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return fail("No image arrived. Pick a file and try again.");
    }
    if (buf.length > MAX_BYTES) {
      return fail("That image is over 5 MB. Try exporting it smaller.");
    }

    const kind = sniff(buf);
    if (!kind) {
      return fail("That doesn't look like an image we can use. Upload a PNG, JPG, WEBP, GIF or SVG.");
    }
    if (kind.mime === "image/svg+xml") buf = sanitiseSvg(buf);

    // Matching magic bytes only proves the file starts like an image. A
    // header-only PNG passes the sniff, passes the dimension gate below on the
    // size it *claims*, gets stored, reports "Uploaded" — and renders as a
    // broken icon. Nothing is accepted now unless the picture is actually in it.
    const broken = imageComplaint(buf, kind.mime);
    if (broken) return fail(broken);

    const { width, height } = dimensions(buf, kind.mime);
    if (width && height && (width < 48 || height < 48)) {
      return fail(`That image is ${width}×${height}. Images need to be at least 48×48 — 512×512 or larger looks best.`);
    }

    // Identical bytes are stored once, so replacing a logo with the same file
    // costs nothing and a resubmission does not duplicate the row.
    const sha256 = createHash("sha256").update(buf).digest("hex");
    const existing = await prisma.upload.findUnique({ where: { sha256 } });
    const row = existing || await prisma.upload.create({
      data: {
        data: buf, mimeType: kind.mime, byteSize: buf.length,
        width, height,
        filename: String(req.get("x-filename") || "").slice(0, 120) || null,
        sha256,
      },
    });

    res.status(201).json({
      id: row.id,
      url: `/api/uploads/${row.id}.${kind.ext}`,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      width: row.width,
      height: row.height,
    });
  }));

// GET /api/uploads/:id — the file. Immutable: the id is content-addressed in
// practice, so a URL always returns the same bytes.
router.get("/:id", ah(async (req, res, next) => {
  const id = Number(String(req.params.id).replace(/\.\w+$/, ""));
  if (!Number.isInteger(id)) { const e = new Error("Not found"); e.status = 404; return next(e); }

  const row = await prisma.upload.findUnique({ where: { id } });
  if (!row) { const e = new Error("Not found"); e.status = 404; return next(e); }

  res.set("Content-Type", row.mimeType);
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.set("X-Content-Type-Options", "nosniff");
  // Belt and braces for SVG: even sanitised, it is served under a policy that
  // cannot run script.
  res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");

  // These images are embedded by the site, and the site is a different origin
  // from this API — localhost:5173 against localhost:4000 in development,
  // Vercel against Render in production. helmet() sets
  // Cross-Origin-Resource-Policy: same-origin on everything, which makes the
  // browser refuse to *render* the image even though it fetched it perfectly:
  //
  //     net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin
  //
  // A 200 with the right bytes, and a broken-image icon on the page. This route
  // serves public pictures meant to be embedded, which is precisely what
  // cross-origin is for. Nothing is weakened: the CSP above still forbids
  // script, nosniff still pins the type, and no credentials are involved.
  res.set("Cross-Origin-Resource-Policy", "cross-origin");
  res.send(Buffer.from(row.data));
}));

export default router;
