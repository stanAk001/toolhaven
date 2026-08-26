// Seeds the five approved affiliate partners as real tool profiles.
//
// What is seeded here is only what can be stated durably: the partner's own
// name, official URL, the affiliate URL supplied by the programme, a category,
// and editorial positioning.
//
// Deliberately NOT seeded: integration counts, customer numbers, uptime, IP
// counts, prices. Those change, and none of them were verified against a
// current official source at the time of writing. They belong in ToolFact,
// entered through the admin with a source URL and a verification date, so a
// page can always say where a claim came from and when it was last checked.
//
// A partner therefore ships with no statistics at all rather than with numbers
// nobody stands behind. Safe to re-run: everything upserts by slug.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: "automation", name: "Automation", description: "Workflow automation, integrations and AI-driven processes.", iconKey: "Zap", colorPrimary: "#6D28D9", colorAccent: "#A78BFA", orderDisplay: 9 },
  { slug: "website", name: "Website Building", description: "Builders, page editors and funnels for getting a site live.", iconKey: "Palette", colorPrimary: "#DB2777", colorAccent: "#F9A8D4", orderDisplay: 10 },
  { slug: "hosting", name: "Domains & Hosting", description: "Domains, hosting, email and the infrastructure a site sits on.", iconKey: "Wrench", colorPrimary: "#0F766E", colorAccent: "#5EEAD4", orderDisplay: 11 },
  { slug: "webdata", name: "Web Data", description: "Proxies, scraping infrastructure and market-data collection.", iconKey: "Code2", colorPrimary: "#B45309", colorAccent: "#FCD34D", orderDisplay: 12 },
];

const PARTNERS = [
  { slug: "make", name: "Make", network: "Direct", officialUrl: "https://www.make.com/", affiliateUrl: "https://www.make.com/en/register?pc=bytoolhaven" },
  { slug: "shifter", name: "Shifter", network: "Direct", officialUrl: "https://shifter.io/", affiliateUrl: "https://shifter.io/r/NGoE/order" },
  { slug: "onepage", name: "Onepage", network: "Cello", officialUrl: "https://onepage.io/", affiliateUrl: "https://onepage.cello.so/mp8Nv4Ngj9W" },
  { slug: "namecheap", name: "Namecheap", network: "Impact", officialUrl: "https://www.namecheap.com/", affiliateUrl: "https://namecheap.pxf.io/c/7618072/1632743/5618" },
  { slug: "elementor", name: "Elementor", network: "Direct", officialUrl: "https://elementor.com/", affiliateUrl: "https://be.elementor.com/visit/?bta=232423&brand=elementor" },
];

// priceType is the pricing *model*, which is stable. priceMin/priceMax stay at
// 0 on purpose, so the UI prints "See pricing" rather than inventing a figure.
const TOOLS = [
  {
    slug: "make", partner: "make", category: "automation", logoMono: "Mk",
    name: "Make",
    description: "Visual automation for connecting apps and building multi-step workflows without writing much code.",
    fullDescription: "Make is a visual automation platform. You build a scenario on a canvas — a trigger on one side, then a chain of apps, routers and filters running left to right — rather than describing it in code. It sits between the simplest one-trigger-one-action tools and writing your own integration service, and most of its appeal is in that middle ground: branching logic, error handling and data transformation, which is exactly where simpler tools push you off a cliff.",
    bestFor: "Operations teams, agencies and developers who need branching, conditional workflows rather than single-step triggers.",
    caveat: "The visual canvas is powerful but not instant. Expect to spend real time on scenarios, routers and data mapping before it pays off — if you only want one trigger and one action, something simpler will get you there faster.",
    priceType: "freemium", freeTier: true, freeTrial: false,
  },
  {
    slug: "shifter", partner: "shifter", category: "webdata", logoMono: "Sh",
    name: "Shifter",
    description: "Residential proxy and web-data infrastructure for scraping, SEO monitoring, ad verification and geo-targeted research.",
    fullDescription: "Shifter provides residential proxy infrastructure — the plumbing behind collecting web data at scale. It is used for price and SEO monitoring, ad verification, and market research where requests need to originate from real residential addresses in specific locations. It is infrastructure rather than an application: you point your own tooling at it.",
    bestFor: "Data teams, SEO operations and market researchers who need geo-targeted requests at scale.",
    caveat: "This is infrastructure, not a finished product — you supply the scraper or monitoring tool. If you expected a dashboard that collects data for you, this is the layer underneath that, not a replacement for it.",
    priceType: "paid", freeTier: false, freeTrial: false,
  },
  {
    slug: "onepage", partner: "onepage", category: "website", logoMono: "Op",
    name: "Onepage",
    description: "Website and landing-page builder with funnels, forms and a built-in CRM, aimed at getting a page live quickly.",
    fullDescription: "Onepage is a hosted builder for landing pages, funnels and small sites. The pitch is speed and self-containment: pages, forms, a CRM and analytics in one place, rather than assembling a builder, a form tool and a CRM yourself. It targets marketers and small businesses who want a page converting rather than a site to maintain.",
    bestFor: "Marketers, solo founders and small businesses who need a landing page or funnel live quickly without managing hosting.",
    caveat: "A hosted, self-contained builder means a smaller plugin and theme ecosystem than WordPress. If you need a particular third-party integration, or expect to extend the site heavily later, check it is supported before committing.",
    priceType: "freemium", freeTier: true, freeTrial: false,
  },
  {
    slug: "namecheap", partner: "namecheap", category: "hosting", logoMono: "Nc",
    name: "Namecheap",
    description: "Domains, hosting, email and SSL — the infrastructure layer for getting and keeping a site online.",
    fullDescription: "Namecheap began as a domain registrar and now covers the surrounding infrastructure too: shared and WordPress hosting, VPS, business email, SSL certificates and privacy tooling. For most people it is the first stop — buy the domain — but the broader stack means a small site can live entirely inside it rather than being stitched across three vendors.",
    bestFor: "Anyone registering a domain, and small sites that want hosting, email and SSL from one place.",
    caveat: "Covering domains, hosting, email and certificates means breadth over depth. For demanding or high-traffic hosting specifically, specialist managed hosts are worth comparing before defaulting to the registrar you already use.",
    priceType: "paid", freeTier: false, freeTrial: false,
  },
  {
    slug: "elementor", partner: "elementor", category: "website", logoMono: "El",
    name: "Elementor",
    description: "Visual drag-and-drop website builder for WordPress, with a theme builder, popups and ecommerce support.",
    fullDescription: "Elementor is a visual editor for WordPress. Instead of picking a theme and living inside its constraints, you lay pages out directly and — with the theme builder — control headers, footers, archives and single-post templates too. It is the route most people take to designing a WordPress site without touching PHP.",
    bestFor: "WordPress users, freelancers and agencies who want visual control over layouts without writing theme code.",
    caveat: "It is WordPress-only, so it inherits WordPress's maintenance burden: updates, plugin conflicts and hosting that can keep up. Heavy page designs also need attention paid to performance, which a simpler hosted builder handles for you.",
    priceType: "freemium", freeTier: true, freeTrial: false,
  },
];

async function main() {
  const cats = {};
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
    cats[c.slug] = row.id;
  }
  console.log(`  categories ready: ${CATEGORIES.map((c) => c.slug).join(", ")}`);

  const partners = {};
  for (const p of PARTNERS) {
    const row = await prisma.partner.upsert({
      where: { slug: p.slug },
      update: { affiliateUrl: p.affiliateUrl, officialUrl: p.officialUrl, network: p.network, status: "active" },
      create: { ...p, status: "active", trackingEnabled: true },
    });
    partners[p.slug] = row.id;
  }
  console.log(`  partners ready: ${PARTNERS.map((p) => p.name).join(", ")}`);

  for (const t of TOOLS) {
    const { partner, category, ...rest } = t;
    const meta = PARTNERS.find((p) => p.slug === partner);
    const data = {
      ...rest,
      categoryId: cats[category],
      partnerId: partners[partner],
      // The tracking link lives on the Partner row. Left null here so there is
      // exactly one place an affiliate URL is ever edited.
      affiliateLink: null,
      affiliateNetwork: meta?.network || null,
      websiteUrl: meta?.officialUrl || null,
      isActive: true,
    };
    await prisma.tool.upsert({ where: { slug: t.slug }, update: data, create: data });
    console.log(`  ${t.name.padEnd(11)} -> /tools/${t.slug}  (${category})`);
  }

  const facts = await prisma.toolFact.count();
  console.log(`\n  ${TOOLS.length} partner profiles seeded.`);
  console.log(`  ${facts} verified facts on record — statistics are entered in the admin with a source and date.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
