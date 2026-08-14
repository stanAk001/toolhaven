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
      select: { slug: true, updatedAt: true },
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

  const entries = [
    ...STATIC,
    ...categories.map((c) => ({ loc: `/categories/${c.slug}`, changefreq: "weekly", priority: "0.8" })),
    ...tools.map((t) => ({ loc: `/tools/${t.slug}`, lastmod: t.updatedAt, changefreq: "weekly", priority: "0.9" })),
    ...posts.map((p) => ({ loc: `/blog/${p.slug}`, lastmod: p.updatedAt, changefreq: "monthly", priority: "0.7" })),
    // best-of pages carry the highest commercial intent on the site
    ...lists.map((l) => ({ loc: `/best/${l.slug}`, lastmod: l.updatedAt, changefreq: "weekly", priority: "0.9" })),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map(url).join("\n") +
    `\n</urlset>\n`;

  res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(xml);
}));

export default r;
