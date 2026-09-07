/**
 * Deciding which origin the site's canonical URLs are built from.
 *
 * A canonical that names a different origin than the one serving the page tells
 * Google the page is a duplicate. That is not a subtle penalty — the page stops
 * being indexed.
 *
 * It happened here: VITE_SITE_URL was set to the bare apex,
 * https://toolhaven.net, while the site is served from www and the apex
 * 308-redirects to www. Every page declared itself an alternate of a URL that
 * redirects straight back to it, the sitemap said www while the canonical said
 * apex, and Search Console reported "Alternate page with proper canonical tag"
 * across the site.
 *
 * Kept in a plain module, separate from the JSX, so it can be tested directly.
 */

/**
 * @param {string} configured  VITE_SITE_URL, or ""
 * @param {string} served      window.location.origin, or ""
 * @returns {string} the origin to build canonicals from
 */
export function resolveOrigin(configured, served) {
  const conf = String(configured || "").replace(/\/+$/, "");
  const serv = String(served || "").replace(/\/+$/, "");
  if (!conf) return serv;
  if (!serv) return conf;

  // Compared without scheme or www, so the two spellings of one host match.
  const bare = (u) => u.replace(/^https?:\/\//, "").replace(/^www\./, "");

  // The same site differing only by "www": believe the browser over the
  // environment variable. The served host is the one Google fetched, the one in
  // the sitemap, and the one the redirect settles on. This is the mismatch that
  // de-indexed the site.
  if (bare(conf) === bare(serv)) return serv;

  // A genuinely different origin — a preview deployment, local development —
  // keeps the configured value, which is exactly what the setting is for.
  return conf;
}
