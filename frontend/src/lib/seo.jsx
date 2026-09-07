// Per-page head management.
//
// Every route used to inherit the one <title> and description baked into
// index.html, so a search engine saw fifteen identical pages. This puts a real
// title, description, canonical and social card on each one, plus the JSON-LD
// that lets a tool page be understood as a product rather than as prose.
//
// Written by hand rather than pulled from a helmet library: React 18 has no
// native metadata hoisting, and the whole job is a few document.head writes
// that need to undo themselves on unmount. A dependency would be more code on
// the wire than the feature.
import { useEffect } from "react";
import { resolveOrigin } from "./origin.js";

/**
 * The one origin every canonical, og:url and schema URL is built from.
 *
 * It has to agree with the host that actually serves the site, because a
 * canonical pointing anywhere else tells Google the page it is on is a
 * duplicate of somewhere else.
 *
 * VITE_SITE_URL was set to the bare apex — https://toolhaven.net — while the
 * site is served from www and the apex 308-redirects to www. So every page
 * declared itself an alternate of a URL that redirects straight back to it.
 * The sitemap said www, the canonical said apex, and Search Console reported
 * "Alternate page with proper canonical tag" across the site.
 *
 * The configured value is therefore normalised rather than trusted. When it
 * differs from the served origin by nothing but a "www.", the served origin
 * wins: that is the host Google fetched, the host in the sitemap, and the host
 * the redirect settles on. A genuinely different origin — a preview build, a
 * staging domain — still honours the configured value, which is its purpose.
 */
const CONFIGURED = String(import.meta.env.VITE_SITE_URL || "").replace(/\/+$/, "");
const SERVED = typeof window !== "undefined" ? window.location.origin : "";


export const SITE_URL = resolveOrigin(CONFIGURED, SERVED);

export const SITE_NAME = "Toolhaven";
const DEFAULT_TITLE = "Toolhaven — Discover software worth using";
const DEFAULT_DESCRIPTION =
  "Explore, compare and evaluate useful software and digital tools. Independent reviews that list the downsides, not just the features.";

const absolute = (path = "") =>
  /^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

// Upsert a meta/link tag and remember whether we created it, so unmount can put
// the head back exactly as it was rather than stripping tags index.html owns.
function upsert(selector, make, attrs) {
  let el = document.head.querySelector(selector);
  const created = !el;
  if (!el) { el = make(); document.head.appendChild(el); }
  const previous = {};
  for (const [k, v] of Object.entries(attrs)) {
    previous[k] = el.getAttribute(k);
    if (v == null) el.removeAttribute(k); else el.setAttribute(k, v);
  }
  return () => {
    if (created) { el.remove(); return; }
    for (const [k, v] of Object.entries(previous)) {
      if (v == null) el.removeAttribute(k); else el.setAttribute(k, v);
    }
  };
}

const meta = (attr, key, content) =>
  upsert(`meta[${attr}="${key}"]`, () => {
    const m = document.createElement("meta");
    m.setAttribute(attr, key);
    return m;
  }, { content });

/**
 * @param {object}  o
 * @param {string}  o.title        page title, without the site suffix
 * @param {string}  o.description  meta description / og:description
 * @param {string}  o.path         canonical path, e.g. "/tools/notion"
 * @param {string}  o.image        absolute or root-relative social image
 * @param {string}  o.type         og:type — "website" | "article"
 * @param {boolean} o.noIndex      keep this page out of the index
 * @param {object|object[]} o.schema  JSON-LD to attach
 */
export function Seo({
  title, description = DEFAULT_DESCRIPTION, path, image = "/og.svg",
  type = "website", noIndex = false, schema, canonical,
}) {
  const fullTitle = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE;
  // An explicit canonical wins over the path. Buying guides can carry one set
  // by an editor, which is what you need when the same recommendation exists
  // somewhere else and this page should not compete with it.
  const url = canonical
    ? absolute(canonical)
    : absolute(path ?? (typeof window !== "undefined" ? window.location.pathname : "/"));
  const img = absolute(image);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = fullTitle;

    const undo = [
      meta("name", "description", description),
      meta("property", "og:title", fullTitle),
      meta("property", "og:description", description),
      meta("property", "og:url", url),
      meta("property", "og:image", img),
      meta("property", "og:type", type),
      meta("property", "og:site_name", SITE_NAME),
      meta("name", "twitter:card", "summary_large_image"),
      meta("name", "twitter:title", fullTitle),
      meta("name", "twitter:description", description),
      meta("name", "twitter:image", img),
      meta("name", "robots", noIndex ? "noindex, nofollow" : "index, follow"),
      upsert('link[rel="canonical"]', () => {
        const l = document.createElement("link");
        l.setAttribute("rel", "canonical");
        return l;
      }, { href: url }),
    ];

    return () => {
      document.title = prevTitle;
      // unwind in reverse so nested writes restore cleanly
      for (let i = undo.length - 1; i >= 0; i--) undo[i]();
    };
  }, [fullTitle, description, url, img, type, noIndex]);

  return schema ? <JsonLd data={schema} /> : null;
}

// A single <script type="application/ld+json">, kept in sync with its data and
// removed with the page. Only ever describe what the page actually shows.
export function JsonLd({ data }) {
  // Depend on the serialised form, not the object. Callers build these inline
  // (`schema={[toolSchema(t), breadcrumbSchema(trail)]}`), so a fresh array
  // arrives every render and an object dependency would tear the script out of
  // the head and re-insert it on each one.
  const json = data ? JSON.stringify(data) : null;
  useEffect(() => {
    if (!json) return;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = json;
    document.head.appendChild(el);
    return () => el.remove();
  }, [json]);
  return null;
}

/* ---------- schema builders ----------
   Each mirrors what is genuinely rendered on the page. Fields the database
   doesn't have are omitted rather than invented — a rating in markup that the
   page can't show is exactly the kind of thing that earns a manual action. */

export const orgSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: absolute("/favicon.svg"),
  description: DEFAULT_DESCRIPTION,
});

export const siteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/tools?search={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});

export const breadcrumbSchema = (trail = []) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.label,
    item: absolute(c.to),
  })),
});

export function toolSchema(tool) {
  if (!tool) return null;
  const s = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description: tool.description,
    applicationCategory: tool.category?.name,
    url: absolute(`/tools/${tool.slug}`),
  };
  if (tool.websiteUrl) s.sameAs = [tool.websiteUrl];

  // Offer schema comes from the verified pricing record and nowhere else.
  // It used to be built from the seeded priceMin/priceMax columns, which are
  // guesses of the same vintage as the invented review counts — and Google
  // treats a wrong Offer as a misrepresentation, not a typo. No verified
  // price means no offers block, which costs a rich-result feature and keeps
  // the site honest.
  const verified = tool.pricing && tool.pricing.status === "verified";
  if (verified && tool.pricing.startingPrice !== null && tool.pricing.startingPrice !== undefined) {
    const per = tool.pricing.billingPeriod === "year" ? "P1Y"
      : tool.pricing.billingPeriod === "month" ? "P1M" : null;
    s.offers = {
      "@type": "Offer",
      price: String(tool.pricing.startingPrice),
      priceCurrency: tool.pricing.currency || "USD",
      availability: "https://schema.org/InStock",
      ...(tool.pricing.pricingUrl ? { url: tool.pricing.pricingUrl } : {}),
      ...(per ? {
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: String(tool.pricing.startingPrice),
          priceCurrency: tool.pricing.currency || "USD",
          billingDuration: per,
        },
      } : {}),
    };
  }
  // Only claim an aggregate rating when enough reader reviews actually back it.
  // These columns were seeded with invented figures once — Canva claimed 15,000
  // reader reviews against none — and they feed Google directly, where a
  // self-serving fake aggregate is grounds for a manual action. They are now
  // derived from approved ToolReview rows, and three is the floor for calling
  // anything an average. Capterra's figures deliberately never appear here:
  // they are someone else's ratings and would be a misrepresentation as ours.
  if (Number(tool.rating) > 0 && Number(tool.reviewCount) >= 3) {
    s.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(tool.rating).toFixed(1),
      reviewCount: Number(tool.reviewCount),
      bestRating: "5", worstRating: "1",
    };
  }
  return s;
}

export const articleSchema = (post) => post && ({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: post.title,
  description: post.excerpt,
  datePublished: post.publishedAt,
  dateModified: post.updatedAt || post.publishedAt,
  author: { "@type": "Organization", name: post.author || SITE_NAME },
  publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: absolute("/favicon.svg") } },
  mainEntityOfPage: absolute(`/blog/${post.slug}`),
  ...(post.featuredImage ? { image: absolute(post.featuredImage) } : {}),
});
