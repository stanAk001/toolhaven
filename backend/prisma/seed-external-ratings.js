/**
 * Real third-party ratings, read off Capterra product pages on 2026-08-21.
 *
 * Rules this file exists to keep:
 *  - Every figure below was read from the page at `sourceUrl`. Nothing is
 *    estimated, averaged, rounded from a different scale, or carried over from
 *    a search snippet — snippets conflate a vendor's seller-level review count
 *    with the product's own, which is how wrong numbers get published.
 *  - A tool with no verifiable rating is simply absent from this list. It gets
 *    no rating on the site, which is not the same as a bad one.
 *  - `listedAs` records the exact product name on the source page when it
 *    differs from ours, so a reader who clicks through is never surprised.
 *
 * Re-run safely: ratings are upserted on (toolId, sourceName).
 * Usage: node prisma/seed-external-ratings.js
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CHECKED = new Date("2026-08-21T00:00:00.000Z");

const CAPTERRA = [
  // slug,          rating, reviews, capterra path,                    listedAs
  ["notion",           4.7,   2802, "p/186596/Notion/"],
  ["canva",            4.7,  13413, "p/168956/Canva/"],
  ["figma",            4.7,    874, "p/175027/Figma/"],
  ["calendly",         4.7,   4139, "p/148036/Calendly/"],
  ["clickup",          4.6,   4618, "p/158833/ClickUp/"],
  ["monday",           4.6,   6094, "p/147657/monday-com/",           "monday.com AI Work Platform"],
  ["asana",            4.5,  13641, "p/184581/Asana-PM/"],
  ["todoist",          4.6,   2660, "p/149339/Todoist-for-Business/", "Todoist for Business"],
  ["grammarly",        4.7,   7222, "p/170306/Grammarly-Business/",   "Grammarly Business"],
  ["make",             4.8,    408, "p/154278/Integromat/",           "Make (formerly Integromat)"],
  ["elementor",        4.6,    906, "p/169468/Elementor/"],
  ["semrush",          4.6,   2325, "p/151962/SEMrush/"],
  ["mailchimp",        4.5,  17674, "p/110228/MailChimp/"],
  ["activecampaign",   4.6,   2568, "p/79367/ActiveCampaign/"],
  ["brevo",            4.6,   3512, "p/132996/brevo/"],
  ["intercom",         4.5,   1135, "p/134347/Intercom/"],
  ["freshdesk",        4.5,   3470, "p/124981/Freshdesk/"],
  ["tidio",            4.7,    590, "p/144040/Tidio-Chat/",           "Tidio"],
  ["loom",             4.7,    529, "p/191187/Loom/"],
  ["postman",          4.7,    512, "p/188497/Postman/"],
  ["digitalocean",     4.6,    159, "p/205055/DigitalOcean/"],
  ["vimeo",            4.6,   1052, "p/122348/Vimeo-Pro/",            "Vimeo Pro"],
  ["jasper",           4.8,   1855, "p/217242/Jasper/"],
  ["riverside",        4.8,    276, "p/10004414/Riverside/"],
  ["unbounce",         4.5,    257, "p/145639/Unbounce/"],
  ["convertkit",       4.6,    243, "p/175000/ConvertKit/",           "Kit (formerly ConvertKit)"],
  ["descript",         4.6,    183, "p/230702/Descript/"],
  ["gorgias",          4.6,    135, "p/155357/Gorgias/"],
  ["netlify",          4.6,     90, "p/154989/Netlify/"],
  ["chatgpt",          4.4,    389, "p/10009334/ChatGPT/"],
  ["claude",           4.4,     53, "p/10011218/Claude/"],
  ["copilot",          4.5,     50, "p/10011215/Copilot/",            "GitHub Copilot"],
  ["vercel",           4.4,     48, "p/203626/Vercel/"],
  ["perplexity",       4.2,     35, "p/10014721/Perplexity/"],
  ["framer",           4.3,     32, "p/178917/Framer/"],
  ["elevenlabs",       4.7,     25, "p/10013392/ElevenLabs/"],
  ["zapier",           4.7,   3070, "p/130182/Zapier/"],

  // Deliberately left out:
  //   Looka  - 5.0 from 4 reviews. Real, but four people is not a finding, and
  //            a flawless score off a sample that small misleads more than the
  //            absence of one does.
  //   Namecheap, Shifter, Onepage, TradingView, Midjourney, Supabase, Finviz,
  //   Benzinga Pro, Koyfin - no Capterra listing found. G2 and Trustpilot both
  //            refuse automated requests, so nothing there could be verified by
  //            reading the page, and nothing unread gets published.
];

async function main() {
  let written = 0, missing = [];

  for (const [slug, rating, reviewCount, path, listedAs] of CAPTERRA) {
    const tool = await prisma.tool.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!tool) { missing.push(slug); continue; }

    const data = {
      sourceName: "Capterra",
      sourceUrl: "https://www.capterra.com/" + path,
      rating,
      maxRating: 5,
      reviewCount,
      retrievedAt: CHECKED,
      summary: listedAs ? "Listed on Capterra as " + listedAs + "." : null,
      orderIndex: 0,
    };

    await prisma.externalRating.upsert({
      where: { toolId_sourceName: { toolId: tool.id, sourceName: "Capterra" } },
      update: data,
      create: { toolId: tool.id, ...data },
    });
    written++;
    console.log("  " + tool.name.padEnd(18) + rating + "/5 from " + reviewCount.toLocaleString() + " reviews");
  }

  console.log("\n" + written + " ratings written" + (missing.length ? "; no such tool: " + missing.join(", ") : ""));
  const total = await prisma.externalRating.count();
  console.log("external ratings in the database: " + total);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
