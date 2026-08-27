// Resolve each partner's official logo from the vendor's own site.
//
// Deliberately no guessed URLs and nothing pulled from an image search: this
// fetches the partner's homepage, reads the icon and Open Graph tags they
// publish themselves, then verifies the chosen URL actually returns an image
// before it is stored. A logo that 404s later is worse than a monogram.
//
// Preference order favours scalable, square, brand-controlled assets:
//   1. <link rel="icon"> pointing at an SVG   — scalable, exact brand colours
//   2. apple-touch-icon                       — reliably square, high-res PNG
//   3. any other declared icon
//   4. og:image                               — last resort; often a wide banner
//
// Anything unresolved keeps its monogram tile. Safe to re-run.
import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();

// Logos are downloaded and served from our own /public, not hotlinked.
// Hotlinking fails three ways: vendors send Cross-Origin-Resource-Policy
// headers that make the browser refuse the image outright (Make does), asset
// URLs move without notice, and every page load then depends on someone else's
// CDN. Self-hosting costs a few KB and removes all three.
const HERE = dirname(fileURLToPath(import.meta.url));
// A logo in a 40px tile should not outweigh the page it sits on.
const MAX_LOGO_BYTES = 40 * 1024;

const LOGO_DIR = join(HERE, "..", "..", "frontend", "public", "logos");

const EXT = { "image/svg+xml": "svg", "image/png": "png", "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico", "image/jpeg": "jpg", "image/webp": "webp" };

async function download(url, slug, type) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) return null;
  const ext = EXT[(type || "").split(";")[0].trim()] || "png";
  await mkdir(LOGO_DIR, { recursive: true });
  const file = `${slug}.${ext}`;
  await writeFile(join(LOGO_DIR, file), buf);
  return { path: `/logos/${file}`, bytes: buf.length };
}

// Conventional icon locations, tried in addition to whatever the page declares.
const WELL_KNOWN = [
  ["/favicon.svg", "probe:svg"],
  ["/apple-touch-icon.png", "probe:apple"],
  ["/apple-touch-icon-precomposed.png", "probe:apple"],
  ["/favicon-192x192.png", "probe:192"],
  ["/favicon.ico", "probe:ico"],
];

const UA = "Mozilla/5.0 (compatible; ToolhavenBot/1.0; +https://www.toolhaven.net)";

const absolutise = (href, base) => {
  try { return new URL(href, base).href; } catch { return null; }
};

// Pull every declared icon out of the document head, with enough context to
// rank them afterwards.
function extractIcons(html, baseUrl) {
  const out = [];
  const linkRe = /<link\b[^>]*>/gi;
  for (const tag of html.match(linkRe) || []) {
    const rel = (tag.match(/\brel=["']([^"']+)["']/i) || [])[1]?.toLowerCase() || "";
    const href = (tag.match(/\bhref=["']([^"']+)["']/i) || [])[1];
    if (!href || !/icon/.test(rel)) continue;
    const sizes = (tag.match(/\bsizes=["']([^"']+)["']/i) || [])[1] || "";
    const type = (tag.match(/\btype=["']([^"']+)["']/i) || [])[1] || "";
    const url = absolutise(href, baseUrl);
    if (url) out.push({ url, rel, sizes, type });
  }

  const og = (html.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/i) || [])[0];
  if (og) {
    const href = (og.match(/\bcontent=["']([^"']+)["']/i) || [])[1];
    const url = href && absolutise(href, baseUrl);
    if (url) out.push({ url, rel: "og:image", sizes: "", type: "" });
  }
  return out;
}

const rank = (i) => {
  if (/\.svg(\?|$)/i.test(i.url) || /svg/i.test(i.type)) return 0;
  if (/apple-touch|probe:apple/.test(i.rel)) return 1;
  if (/probe:192/.test(i.rel)) return 2;
  const px = parseInt((i.sizes.match(/(\d+)x/) || [])[1] || "0", 10);
  if (i.rel.includes("icon")) return px >= 180 ? 2 : px >= 32 ? 3 : 4;
  return 5; // og:image
};

async function verifyImage(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!/^image\//i.test(type)) return null;
    const bytes = Number(res.headers.get("content-length") || 0);
    // A brand mark rendered into a 40px tile has no business weighing more than
    // a page of text. Multi-resolution .ico files and uncompressed hero images
    // routinely run to hundreds of kilobytes; reject them and let a lighter
    // candidate further down the list win, or fall back to the monogram.
    if (bytes > MAX_LOGO_BYTES) return null;
    return { url: res.url, type, bytes };
  } catch { return null; }
}

async function resolveLogo(officialUrl) {
  let html;
  try {
    const res = await fetch(officialUrl, { headers: { "User-Agent": UA }, redirect: "follow" });
    html = res.ok ? await res.text() : "";  // a 403 blocks parsing, not probing
  } catch (e) { html = ""; }
  if (html === undefined) html = "";

  const candidates = extractIcons(html, officialUrl);
  // Probe the conventional paths too, always — not only when parsing fails.
  // Plenty of sites serve a 180px apple-touch-icon without declaring it, and a
  // 32px favicon rendered into a 48px tile looks broken.
  for (const [path, rel] of WELL_KNOWN) {
    const url = absolutise(path, officialUrl);
    if (url && !candidates.some((c) => c.url === url)) candidates.push({ url, rel, sizes: "", type: "" });
  }
  candidates.sort((a, b) => rank(a) - rank(b));

  for (const c of candidates) {
    const ok = await verifyImage(c.url);
    if (ok) return { ...ok, via: c.rel };
  }

  // Last resort. Some vendors refuse automated requests outright (Namecheap
  // and TradingView both 403 everything), so their own markup is unreadable
  // even though the brand mark is public. DuckDuckGo's icon service resolves
  // the same asset from the same domain, and the file is still downloaded and
  // served from here rather than hotlinked. Tried only after the vendor's own
  // declarations have failed, never in preference to them.
  try {
    const host = new URL(officialUrl).hostname;
    const bare = host.replace(/^www\./, "");
    // Both spellings: the service indexes whichever hostname the brand actually
    // serves from, and they are not interchangeable — brevo.com 404s where
    // www.brevo.com resolves.
    for (const h of [...new Set([bare, `www.${bare}`, host])]) {
      const fallback = await verifyImage(`https://icons.duckduckgo.com/ip3/${h}.ico`);
      if (fallback) return { ...fallback, via: "icon service" };
    }
  } catch { /* fall through to the monogram */ }

  return { error: `${candidates.length} candidate(s), none returned an image` };
}

async function main() {
  // Every active tool. This began as a partners-only job, which left forty-three
  // tools wearing a two-letter tile while four carried real brand marks — an
  // inconsistency that read as the partners being the ones we cared about.
  //
  //   node prisma/fetch-logos.js            every tool still without one
  //   node prisma/fetch-logos.js zapier     just that tool
  //   node prisma/fetch-logos.js --force    redo the ones already resolved
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const force = process.argv.includes("--force");
  const tools = await prisma.tool.findMany({
    where: only.length ? { slug: { in: only } } : { isActive: true },
    select: { id: true, slug: true, name: true, websiteUrl: true, logoUrl: true, partner: { select: { officialUrl: true } } },
    orderBy: { name: "asc" },
  });

  let skipped = 0;
  for (const t of tools) {
    if (t.logoUrl && !force && !only.length) { skipped++; continue; }
    const site = t.partner?.officialUrl || t.websiteUrl;
    if (!site) { console.log(`  ${t.name.padEnd(11)} no official URL — skipped`); continue; }

    const r = await resolveLogo(site);
    if (r.error) {
      // clear any URL from an earlier run: a stale hotlink is worse than none
      await prisma.tool.update({ where: { id: t.id }, data: { logoUrl: null, logoAlt: null } });
      console.log(`  ${t.name.padEnd(11)} ${r.error} — monogram`);
      continue;
    }
    const saved = await download(r.url, t.slug, r.type);
    if (!saved) {
      await prisma.tool.update({ where: { id: t.id }, data: { logoUrl: null, logoAlt: null } });
      console.log(`  ${t.name.padEnd(11)} found but download failed — monogram`);
      continue;
    }
    await prisma.tool.update({
      where: { id: t.id },
      data: { logoUrl: saved.path, logoAlt: `${t.name} logo` },
    });
    console.log(`  ${t.name.padEnd(11)} ${r.via.padEnd(16)} ${saved.path.padEnd(22)} ${Math.round(saved.bytes / 1024)}kb`);
  }

  const done = await prisma.tool.count({ where: { logoUrl: { startsWith: "/logos/" } } });
  const all = await prisma.tool.count({ where: { isActive: true } });
  console.log(`\n  ${done}/${all} tools now carry a verified brand mark`
    + (skipped ? ` (${skipped} already had one — pass --force to redo them)` : "") + ".");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
