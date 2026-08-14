// One-off repair: the seed put plain product URLs in `affiliateLink` and left
// `websiteUrl` empty on all 41 tools. That inverts what the two fields mean and
// has three consequences:
//
//   1. Every tool reports as "monetised" when none of them earn anything.
//   2. There is no fallback — set a real tracking link, later clear it, and the
//      outbound button has nowhere to send anyone.
//   3. "How much unmonetised traffic am I sending?" can't be answered, which is
//      the number the whole affiliate plan turns on.
//
// This moves each plain URL to `websiteUrl` (the always-present destination) and
// clears `affiliateLink` so it means only what it says: a tracking link, present
// when you actually have one.
//
// Nothing breaks. The click endpoint resolves `affiliateLink || websiteUrl`, so
// every button keeps sending people to exactly the same place as before.
//
// Safe to re-run: tools that already have a websiteUrl are left alone, and a URL
// that looks like a genuine tracking link is never moved.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Real affiliate URLs almost always carry a partner parameter or live on a
// network's redirect domain. Anything matching this is left where it is.
const LOOKS_TRACKED =
  /[?&](via|ref|aff|affiliate|utm_|partner|fpr|r)=|impact\.com|partnerstack|refersion|shareasale|awin|cj\.com|clickbank/i;

async function main() {
  const tools = await prisma.tool.findMany({
    select: { id: true, name: true, affiliateLink: true, websiteUrl: true },
  });

  let moved = 0, kept = 0, skipped = 0;

  for (const t of tools) {
    if (!t.affiliateLink) { skipped++; continue; }

    if (LOOKS_TRACKED.test(t.affiliateLink)) {
      kept++;
      console.log(`  keeping tracking link on ${t.name}`);
      continue;
    }

    if (t.websiteUrl) { skipped++; continue; } // already correct

    await prisma.tool.update({
      where: { id: t.id },
      data: { websiteUrl: t.affiliateLink, affiliateLink: null },
    });
    moved++;
  }

  const after = await prisma.tool.findMany({ select: { affiliateLink: true, websiteUrl: true } });
  console.log(`\n  moved to websiteUrl : ${moved}`);
  console.log(`  left as tracking    : ${kept}`);
  console.log(`  untouched           : ${skipped}`);
  console.log(`\n  now: ${after.filter((t) => t.websiteUrl).length}/${after.length} have a destination, ` +
    `${after.filter((t) => t.affiliateLink).length}/${after.length} carry a tracking link.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
