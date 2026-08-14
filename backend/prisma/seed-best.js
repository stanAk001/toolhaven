// Seeds one best-of list per category, composed entirely from tools already in
// the database.
//
// Nothing about a product is invented here: the ranking is each tool's existing
// rating and popularity, and every factual claim on the rendered page (price,
// free tier, strengths, the catch) is read live from the Tool row at request
// time. The only new prose is the framing — what the list covers and how the
// picks were ordered — which is editorial, not product information.
//
// Safe to re-run: lists are upserted by slug and entries are rebuilt.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Lower a sentence's first letter so it can sit mid-sentence — but leave it
// alone when the opening word is an initialism (AI, CRM, HR) or a proper noun
// already carrying internal capitals.
const lowerLead = (s = "") => {
  const first = s.split(/\s+/)[0] || "";
  const looksLikeInitialism = /^[A-Z]{2,}/.test(first);
  return looksLikeInitialism ? s : s.charAt(0).toLowerCase() + s.slice(1);
};

// The award a tool earns is derived from its own data, so it stays true if the
// underlying numbers change on the next run.
function awardFor(tool, index, all) {
  if (index === 0) return "Best overall";
  const freeOnes = all.filter((t) => t.freeTier);
  if (tool.freeTier && freeOnes[0]?.id === tool.id) return "Best free tier";
  const cheapest = [...all].sort((a, b) => (a.priceMax || 0) - (b.priceMax || 0))[0];
  if (cheapest?.id === tool.id && (tool.priceMax || 0) > 0) return "Best value";
  if (tool.freeTrial && index === all.length - 1) return "Worth a trial";
  return null;
}

async function main() {
  const categories = await prisma.category.findMany({
    orderBy: { orderDisplay: "asc" },
    include: {
      tools: {
        where: { isActive: true },
        orderBy: [{ rating: "desc" }, { popularity: "desc" }],
        take: 6,
      },
    },
  });

  let made = 0;

  for (const cat of categories) {
    // A list of one or two is not a shortlist; skip until there's enough to rank.
    if (cat.tools.length < 3) {
      console.log(`  skipped ${cat.name} — only ${cat.tools.length} tool(s)`);
      continue;
    }

    // Category names are inconsistent about carrying the noun: "AI Tools" has
    // it, "Customer Support" doesn't. Without this, titles read "Best Customer
    // Support in 2026" and subtitles "4 Customer Support compared".
    const noun = /tools?$/i.test(cat.name) ? cat.name : `${cat.name} tools`;

    const slug = `${cat.slug}-tools`;
    const title = `Best ${noun} in ${new Date().getFullYear()}`;
    const subtitle = `${cat.tools.length} ${noun.toLowerCase()} compared on price, free tier and the catch on each one.`;

    const intro =
      `We reviewed every tool in our ${cat.name} category and ranked the ones worth your time. ` +
      `Each pick below carries what it costs, who it suits, and the thing you'd wish someone had mentioned a month in.\n\n` +
      `Prices and free tiers are read live from each tool's page, so this list can't quietly go stale.`;

    const criteria =
      `Picks are ordered by our own rating, which comes from the eight criteria on our method page — ` +
      `functionality, ease of use, features, value, pricing, reliability, support and who the tool actually suits.\n\n` +
      `Position is **not** influenced by whether a tool has an affiliate programme. Tools we earn nothing from ` +
      `appear above tools we do.`;

    const list = await prisma.bestList.upsert({
      where: { slug },
      update: { title, subtitle, intro, criteria, categoryId: cat.id },
      create: {
        slug, title, subtitle, intro, criteria,
        audience: cat.description || `Anyone choosing ${noun.toLowerCase()} for the first time, or reconsidering what they already pay for.`,
        categoryId: cat.id,
      },
    });

    // rebuild entries so re-running reflects the current ranking
    await prisma.bestListEntry.deleteMany({ where: { bestListId: list.id } });
    await prisma.bestListEntry.createMany({
      data: cat.tools.map((t, i) => ({
        bestListId: list.id,
        toolId: t.id,
        rank: i + 1,
        award: awardFor(t, i, cat.tools),
        // The tool's own positioning line, not a new claim about it. bestFor is
        // stored sentence-cased ("Writers, researchers…"), so it needs lowering
        // to read as a clause after "Best for" — unless it starts with an
        // initialism like "AI" or a proper noun, which must keep its capital.
        blurb: t.bestFor
          ? `Best for ${lowerLead(t.bestFor).replace(/\.$/, "")}. ${t.description}`
          : t.description,
      })),
    });

    await prisma.bestListFaq.deleteMany({ where: { bestListId: list.id } });
    await prisma.bestListFaq.createMany({
      data: [
        {
          bestListId: list.id, orderIndex: 0,
          question: `How did you rank these ${cat.name.toLowerCase()}?`,
          answer: "By our own rating, which comes from the eight criteria on our How We Review page. Affiliate relationships play no part in the order.",
        },
        {
          bestListId: list.id, orderIndex: 1,
          question: "Is there a free option here?",
          answer: cat.tools.some((t) => t.freeTier)
            ? "Yes — the table above marks which tools have a genuine free tier, and each entry states what the free plan actually limits."
            : "Not in this category at the moment. Several offer a free trial, which is marked on each entry.",
        },
        {
          bestListId: list.id, orderIndex: 2,
          question: "Do you make money from these links?",
          answer: "Some outbound links are partner links, which pay us a commission at no extra cost to you. They never affect the ranking — see our affiliate disclosure.",
        },
      ],
    });

    made++;
    console.log(`  ${slug}: ${cat.tools.length} entries`);
  }

  console.log(`\n${made} best-of list(s) seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
