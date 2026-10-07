/**
 * Turning a stored image path into one the browser can actually fetch.
 *
 * Uploads are held in the API's database and served from the API, so the paths
 * written into records are relative to it: "/api/uploads/149.png". The site is
 * served from somewhere else — Vercel against Render in production, :5173
 * against :4000 in development — so a relative path in an <img src> resolves
 * against the *site* and asks the wrong host for the picture.
 *
 * That is why 56 of 57 tools had a logo on file and every card on the homepage
 * showed a letter in a coloured square instead. Nothing was missing; the
 * address was wrong, and ToolLogo's onError fallback made the failure look
 * like an absence.
 *
 * Four components had each written their own copy of this. One definition
 * means the next component to need it cannot get it subtly wrong.
 */

/** The API's origin, without the trailing /api. */
export function apiOrigin() {
  return (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");
}

/**
 * Resolve a stored media path for use in the browser.
 *
 * Two kinds of root-relative path live in the database and they are served by
 * different hosts:
 *
 *   /api/uploads/149.png   an upload, held in the API's database
 *   /logos/chatgpt.webp    a file shipped with the site, in public/
 *
 * Only the first belongs to the API. Sending both there turned 47 working
 * logos into monograms while fixing 9 broken ones — and a same-origin test
 * build hid it completely, because with VITE_API_URL="/api" the API origin is
 * an empty string and both shapes resolve correctly by accident. The bug only
 * appears when the site and the API are genuinely different hosts, which is
 * every real deployment and the normal dev setup.
 *
 * Absolute URLs and data URIs are returned untouched: a vendor's own logo on
 * their own domain is already addressable, and prefixing it would break it.
 *
 * @param {string|null|undefined} path
 * @returns {string|null}
 */
export function mediaUrl(path) {
  if (!path) return null;
  const s = String(path).trim();
  if (!s) return null;
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (s.startsWith("/api/")) return apiOrigin() + s;
  return s;   // the site's own file, or already relative to it
}
