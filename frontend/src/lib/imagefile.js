/**
 * Checks a file before it is uploaded.
 *
 * The server is the authority and rejects anything it cannot verify. This runs
 * first for two reasons: it catches the problem in the same second rather than
 * after five megabytes cross the network, and — the part that matters — it asks
 * the browser to actually *decode* the file.
 *
 * That is a stronger test than any structural check. If the browser that will
 * later render the image cannot decode it now, the upload is pointless: it
 * would be stored, reported as successful, and drawn as a broken icon.
 */

export const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
export const MAX_BYTES = 5 * 1024 * 1024;
export const MIN_EDGE = 48;

/** Cheap checks that need no decoding. Returns a complaint, or null. */
export function basicComplaint(file) {
  if (!file) return "No file picked.";
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.type)) {
    return "That file type won't work. Use a PNG, JPG, WEBP, GIF or SVG.";
  }
  if (file.size === 0) return "That file is empty — it may still have been saving when you copied it.";
  if (file.size > MAX_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB — try exporting it smaller.`;
  }
  return null;
}

/**
 * Decode the file and report its real dimensions.
 *
 * @returns {Promise<{complaint: string|null, width: number, height: number}>}
 */
export function decodeCheck(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    const done = (complaint, width = 0, height = 0) => {
      URL.revokeObjectURL(url);
      resolve({ complaint, width, height });
    };

    // A file that never fires either event is as unusable as one that errors.
    const timer = setTimeout(() => done("That image took too long to open. It may be corrupt."), 10000);

    img.onload = () => {
      clearTimeout(timer);
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return done("That image opened with no size to it, so it would show as a blank box.");
      if (w < MIN_EDGE || h < MIN_EDGE) {
        return done(`That image is only ${w}×${h}. It needs to be at least ${MIN_EDGE}×${MIN_EDGE} — 800 wide or more looks best on a product shot.`, w, h);
      }
      done(null, w, h);
    };

    img.onerror = () => {
      clearTimeout(timer);
      done("Your browser couldn't open that image, so it wouldn't show on the page either. The file is probably damaged or was copied before it finished saving.");
    };

    img.src = url;
  });
}

/** Both checks, in the order that fails fastest. */
export async function checkImage(file) {
  const basic = basicComplaint(file);
  if (basic) return { complaint: basic, width: 0, height: 0 };
  return decodeCheck(file);
}

/** "412 KB" / "1.4 MB" — never "0 KB" for a file that has bytes in it. */
export function readableSize(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
