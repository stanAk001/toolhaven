import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";

const r = Router();

// Public origin of the *site*, not the API. Set SITE_URL in production.
const SITE = (process.env.SITE_URL || "https://toolhaven.net").replace(/\/$/, "");

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const url = ({ loc, lastmod, changefreq, priority }) =>
  [
    "  <url>",
    `    <loc>${esc(SITE + loc)}</loc>`,
    lastmod ? `    <lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : "",
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : "",
    priority ? `    <priority>${priority}</priority>` : "",
    "  </url>",
  ].filter(Boolean).join("\n");

// Hand-maintained routes. /admin is deliberately absent — it is noindex and
// disallowed, and listing it would only advertise it.
const STATIC = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/tools", changefreq: "daily", priority: "0.9" },
  { loc: "/compare", changefreq: "weekly", priority: "0.8" },
  { loc: "/blog", changefreq: "daily", priority: "0.8" },
  { loc: "/best", changefreq: "weekly", priority: "0.9" },
  { loc: "/how-we-review", changefreq: "monthly", priority: "0.6" },
  { loc: "/stacks", changefreq: "weekly", priority: "0.6" },
  { loc: "/submit", changefreq: "monthly", priority: "0.6" },
  { loc: "/about", changefreq: "monthly", priority: "0.5" },
  { loc: "/contact", changefreq: "monthly", priority: "0.4" },
  { loc: "/disclosure", changefreq: "yearly", priority: "0.3" },
  { loc: "/privacy", changefreq: "yearly", priority: "0.2" },
  { loc: "/terms", changefreq: "yearly", priority: "0.2" },
];

/* Built from the database on request rather than shipped as a file, so a tool
 * published this morning is crawlable this afternoon without a redeploy. Only
 * live rows are listed: a sitemap that points at inactive tools or unpublished
 * drafts teaches the crawler the file is unreliable. */
r.get("/", ah(async (_req, res) => {
  const [tools, categories, posts, lists] = await Promise.all([
    prisma.tool.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true, categoryId: true },
      orderBy: { popularity: "desc" },
    }),
    prisma.category.findMany({ select: { slug: true } }),
    prisma.blogPost.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.bestList.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  /* Comparison pairs worth having a page for.
   *
   * 41 tools is 820 possible pairs, and publishing all of them would be the
   * thin-content farm this site exists not to be. Two constraints keep the set
   * meaningful: both tools must be in the same category (nobody searches
   * "Figma vs QuickBooks"), and only the most popular few per category are
   * paired, because those are the comparisons people actually make.
   *
   * Slugs are sorted so the URL matches the canonical order the router
   * enforces — otherwise the sitemap would advertise URLs that redirect. */
  const PER_CATEGORY = 4;
  const byCategory = new Map();
  for (const t of tools) {
    if (!t.categoryId) continue;
    const list = byCategory.get(t.categoryId) || [];
    if (list.length < PER_CATEGORY) { list.push(t); byCategory.set(t.categoryId, list); }
  }

  const pairs = [];
  for (const list of byCategory.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]].sort((x, y) => (x.slug < y.slug ? -1 : 1));
        pairs.push({
          slug: `${a.slug}-vs-${b.slug}`,
          // the pair is as fresh as the more recently updated half
          updatedAt: a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt,
        });
      }
    }
  }

  const entries = [
    ...STATIC,
    ...categories.map((c) => ({ loc: `/categories/${c.slug}`, changefreq: "weekly", priority: "0.8" })),
    ...tools.map((t) => ({ loc: `/tools/${t.slug}`, lastmod: t.updatedAt, changefreq: "weekly", priority: "0.9" })),
    ...posts.map((p) => ({ loc: `/blog/${p.slug}`, lastmod: p.updatedAt, changefreq: "monthly", priority: "0.7" })),
    // best-of pages carry the highest commercial intent on the site
    ...lists.map((l) => ({ loc: `/best/${l.slug}`, lastmod: l.updatedAt, changefreq: "weekly", priority: "0.9" })),
    // "x vs y" — high intent, and the query a buyer types last before deciding
    ...pairs.map((p) => ({ loc: `/compare/${p.slug}`, lastmod: p.updatedAt, changefreq: "weekly", priority: "0.8" })),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map(url).join("\n") +
    `\n</urlset>\n`;

  res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(xml);
}));

export default r;
