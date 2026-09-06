/**
 * Structural validation for uploaded images.
 *
 * Sniffing the first four bytes proves a file *starts* like a PNG. It does not
 * prove a browser can draw it. A 68-byte file whose header declares 512×512 and
 * whose pixel data was never written passes every check the upload route used
 * to make: right magic bytes, plausible dimensions, under the size cap. It is
 * stored, the form shows a green "Uploaded", and the page renders a broken-image
 * icon — the worst possible outcome, because the failure is invisible until
 * someone looks at the published page.
 *
 * So each format is walked far enough to confirm the parts that carry the
 * actual picture are present and self-consistent. This is not a decoder and
 * does not want to be: it is the cheap structural check that separates "a real
 * file" from "a header with nothing behind it", with no dependency to keep
 * patched and no attacker-controlled data reaching an image library.
 */

/** Every PNG chunk, walked by its own length fields. */
function pngChunks(buf) {
  const out = [];
  let i = 8;                                   // past the signature
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("ascii", i + 4, i + 8);
    // A length that runs past the end means the file is truncated or lying.
    if (len > buf.length || i + 12 + len > buf.length) { out.push({ type, len, truncated: true }); break; }
    out.push({ type, len });
    i += 12 + len;                             // length + type + data + crc
  }
  return out;
}

/**
 * Is this a complete, drawable image?
 * @returns {string|null} a reason it is not, or null if it looks sound
 */
export function imageComplaint(buf, mime) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return "That file is too small to be a real image.";

  if (mime === "image/png") {
    const chunks = pngChunks(buf);
    if (chunks.some((c) => c.truncated)) return "That PNG is truncated — the file ended mid-way through.";
    if (chunks[0]?.type !== "IHDR") return "That PNG has no header chunk.";
    if (!chunks.some((c) => c.type === "IEND")) return "That PNG has no end marker, so it never finished uploading.";
    // IDAT is the picture. Split across chunks in real files; absent or
    // near-empty in the stubs that cause a broken-image icon.
    const idat = chunks.filter((c) => c.type === "IDAT").reduce((n, c) => n + c.len, 0);
    if (idat === 0) return "That PNG contains no image data — only a header. Re-export it and try again.";
    // Even a solid-colour 48×48 compresses to more than this.
    if (idat < 16) return "That PNG's image data is empty. It may have been copied while still saving.";
    return null;
  }

  if (mime === "image/jpeg") {
    // Must end with EOI. Trailing padding is common, so look at the tail.
    const tail = buf.subarray(Math.max(0, buf.length - 32));
    let eoi = false;
    for (let i = 0; i < tail.length - 1; i++) if (tail[i] === 0xff && tail[i + 1] === 0xd9) { eoi = true; break; }
    if (!eoi) return "That JPEG is truncated — the file ended before the image did.";
    // SOS marks the start of the actual scan data.
    let sos = false;
    for (let i = 2; i < buf.length - 1; i++) if (buf[i] === 0xff && buf[i + 1] === 0xda) { sos = true; break; }
    if (!sos) return "That JPEG contains no image data.";
    return null;
  }

  if (mime === "image/gif") {
    if (buf[buf.length - 1] !== 0x3b) return "That GIF is truncated — it has no end marker.";
    return null;
  }

  if (mime === "image/webp") {
    // The RIFF header states the payload length; it must match what arrived.
    const stated = buf.readUInt32LE(4) + 8;
    if (stated > buf.length) return "That WEBP is truncated — it declares more data than the file contains.";
    if (buf.length < 30) return "That WEBP contains no image data.";
    return null;
  }

  if (mime === "image/svg+xml") {
    const s = buf.toString("utf8");
    if (!/<\/svg\s*>\s*$/i.test(s.trim())) return "That SVG is incomplete — it has no closing tag.";
    // An SVG with no drawable element renders as nothing at all.
    if (!/<(path|rect|circle|ellipse|line|polyline|polygon|text|image|use|g)\b/i.test(s)) {
      return "That SVG has no shapes in it, so it would render as an empty box.";
    }
    return null;
  }

  return null;
}
