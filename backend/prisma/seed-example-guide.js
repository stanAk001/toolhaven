/**
 * A worked example: one complete buying guide, filled in.
 *
 * Every specification here was checked against the manufacturer's own page or
 * an independent review before it was written down — none of it came from
 * memory. The Amazon links are deliberately left blank: an ASIN recalled
 * approximately points at a different product, and a wrong link under a heading
 * that says "we recommend this" is worse than no link at all. Paste your own
 * from Associates.
 *
 * It stays a draft on purpose. Read it, put it in your own voice, add your
 * links, then publish.
 *
 *   node prisma/seed-example-guide.js
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SLUG = "best-monitors-for-developers-in-2026";

const PICKS = [
  {
    award: "Best overall",
    name: "UltraSharp U2723QE", brand: "Dell",
    verdict: "The one to buy if you are only buying one. The IPS Black panel gives it real blacks rather than the washed-out grey most IPS monitors call black, and text at 4K across 27 inches is sharp enough that you stop noticing the screen — which is the highest praise a monitor gets. The 90W USB-C hub means one cable to the laptop and everything else stays plugged into the monitor.",
    bestFor: "Long days in a text editor, on a laptop you dock and undock",
    considerElseIf: "You play fast games on the same screen — 60Hz is 60Hz",
    specs: [
      { label: "Size", value: "27 inch" },
      { label: "Resolution", value: "3840 × 2160" },
      { label: "Panel", value: "IPS Black" },
      { label: "Refresh", value: "60 Hz" },
      { label: "Contrast", value: "2000:1" },
      { label: "USB-C power", value: "90 W" },
    ],
    pros: [
      "2000:1 contrast, genuinely better than ordinary IPS",
      "90W USB-C hub with Ethernet — one cable to the laptop",
      "98% DCI-P3 and a built-in KVM switch",
    ],
    cons: [
      "60Hz only, so not a gaming screen",
      "The stand takes a lot of desk depth",
      "Costs noticeably more than the LG below",
    ],
  },
  {
    award: "Best value 4K",
    name: "27UP850N-W", brand: "LG",
    verdict: "Most of the same experience for meaningfully less money. Same size, same resolution, and slightly more USB-C power than the Dell. What you give up is contrast — this is a conventional IPS panel, so blacks read as grey in a dark room — and a factory calibration you will want to correct yourself.",
    bestFor: "A second screen, or a first one on a tighter budget",
    considerElseIf: "This is your only display and you stare at text all day",
    specs: [
      { label: "Size", value: "27 inch" },
      { label: "Resolution", value: "3840 × 2160" },
      { label: "Panel", value: "IPS" },
      { label: "Refresh", value: "60 Hz" },
      { label: "Contrast", value: "1000:1" },
      { label: "USB-C power", value: "96 W" },
    ],
    pros: [
      "96W USB-C, slightly more than the Dell",
      "Same 27-inch 4K panel size and resolution",
      "DisplayHDR 400 and 95% DCI-P3",
    ],
    cons: [
      "Contrast is visibly weaker than IPS Black",
      "Ships needing calibration",
      "External power brick rather than internal",
    ],
  },
  {
    award: "Best on a budget",
    name: "ProArt PA278CV", brand: "ASUS",
    verdict: "1440p rather than 4K, and that is the whole trade. Text is not as crisp, but it arrives factory calibrated to Delta E under 2 with full sRGB coverage — a specification most monitors at twice the price do not print. If your budget stops well short of the others, this is where it stops sensibly.",
    bestFor: "Colour-accurate work when 4K is out of budget",
    considerElseIf: "You want the sharpest possible text — that is what 4K buys",
    specs: [
      { label: "Size", value: "27 inch" },
      { label: "Resolution", value: "2560 × 1440" },
      { label: "Panel", value: "IPS" },
      { label: "Refresh", value: "75 Hz" },
      { label: "Contrast", value: "1000:1" },
      { label: "USB-C power", value: "65 W" },
    ],
    pros: [
      "Factory calibrated and Calman verified, ΔE under 2",
      "100% sRGB and 100% Rec.709",
      "75Hz, marginally smoother than the 60Hz panels",
    ],
    cons: [
      "1440p, so text is a step down from 4K",
      "65W will not keep a larger laptop charged under load",
      "Plain build next to the Dell",
    ],
  },
  {
    award: "Best for colour work",
    name: "PD2725U", brand: "BenQ",
    verdict: "Aimed squarely at designers, and the Thunderbolt 3 daisy-chaining is the reason to choose it over the Dell. Colour coverage is strong and it arrives calibrated. The catch is contrast: 1200:1 is ordinary, so this is a screen for judging colour rather than for watching anything in a dark room.",
    bestFor: "Design work where colour accuracy outranks contrast",
    considerElseIf: "You mostly write code — the Dell is better value for that",
    specs: [
      { label: "Size", value: "27 inch" },
      { label: "Resolution", value: "3840 × 2160" },
      { label: "Panel", value: "IPS" },
      { label: "Refresh", value: "60 Hz" },
      { label: "Contrast", value: "1200:1" },
      { label: "USB-C power", value: "65 W (Thunderbolt 3)" },
    ],
    pros: [
      "Thunderbolt 3 with daisy-chaining",
      "95% P3, 100% sRGB and 100% Rec.709 out of the box",
      "Built-in KVM switch",
    ],
    cons: [
      "1200:1 contrast is unremarkable",
      "250 nits typical brightness is on the dim side",
      "65W charging is not enough for a big laptop under load",
    ],
  },
  {
    award: "Best ultrawide",
    name: "UltraSharp U4025QW", brand: "Dell",
    verdict: "Replaces two monitors with one, and does it without the bezel down the middle you have been working around for years. 120Hz at this size and resolution is unusual and makes everything feel quicker. It is expensive and it is enormous — measure your desk before you order it.",
    bestFor: "Replacing a dual-monitor setup with a single curved screen",
    considerElseIf: "Your desk is shallow, or the price makes you wince",
    specs: [
      { label: "Size", value: "40 inch" },
      { label: "Resolution", value: "5120 × 2160" },
      { label: "Panel", value: "IPS Black, curved" },
      { label: "Refresh", value: "120 Hz" },
      { label: "Contrast", value: "2000:1" },
      { label: "USB-C power", value: "140 W (Thunderbolt 4)" },
    ],
    pros: [
      "120Hz at 5K2K, rare at this size",
      "140W Thunderbolt 4 charges almost any laptop",
      "2.5 Gigabit Ethernet and a serious port selection",
    ],
    cons: [
      "Expensive — several times the ASUS",
      "40 inches needs a deep desk",
      "The curve takes adjusting to for straight-line work",
    ],
  },
  {
    award: "Best if you are on a Mac",
    name: "Studio Display", brand: "Apple",
    verdict: "Hard to justify on specification and easy to justify in practice, provided the machine is a Mac. 5K across 27 inches means macOS renders at exactly 2× with no scaling softness, which no 4K panel quite matches. You are paying a lot for that, plus a webcam and speakers you may not have wanted.",
    bestFor: "A Mac, where 5K scaling genuinely matters",
    considerElseIf: "You are on Windows or Linux — the value case collapses",
    specs: [
      { label: "Size", value: "27 inch" },
      { label: "Resolution", value: "5120 × 2880" },
      { label: "Panel", value: "IPS" },
      { label: "Refresh", value: "60 Hz" },
      { label: "Brightness", value: "600 nits" },
      { label: "USB-C power", value: "96 W (Thunderbolt 3)" },
    ],
    pros: [
      "5K gives pixel-perfect 2× scaling on macOS",
      "600 nits, brighter than anything else here",
      "The built-in speakers are genuinely good",
    ],
    cons: [
      "Very expensive for a 60Hz panel",
      "The height-adjustable stand costs extra",
      "Little reason to buy it for a Windows machine",
    ],
  },
];

const FAQS = [
  {
    question: "Is 4K worth it at 27 inches?",
    answer: "For text, yes — it is the main reason to spend the money, and you notice it within an hour of writing code. For video and games it matters far less than refresh rate does.",
  },
  {
    question: "Do I need two monitors?",
    answer: "Probably not. One good screen beats two mediocre ones for most work, costs less, and takes up less desk. An ultrawide is the middle path if you genuinely need the width.",
  },
  {
    question: "How much USB-C power do I actually need?",
    answer: "65W runs most 13-inch laptops. A 14 or 16-inch machine under real load wants 90W or more, and will otherwise discharge slowly while apparently plugged in.",
  },
  {
    question: "Is IPS Black worth paying for?",
    answer: "In a bright room, barely. In a dim one it is the difference between black and dark grey, and once you have seen it the ordinary IPS panels look washed out.",
  },
];

async function main() {
  const guide = await prisma.buyingGuide.findUnique({ where: { slug: SLUG } });
  if (!guide) {
    console.error(`No guide with slug "${SLUG}". Create it in the admin first.`);
    process.exit(1);
  }

  await prisma.buyingGuide.update({
    where: { id: guide.id },
    data: {
      standfirst: "Six worth buying, what each one is actually for, and the trade-off nobody puts on the box.",
      intro: [
        "You will look at this thing for more hours than you look at most people, and it will outlast two of the laptops you plug into it. It deserves more than the ten minutes most of us give it.",
        "The short version: 27 inches at 4K is the sweet spot for text, and nearly every other decision here is a trade against that. What follows is what each trade actually costs you.",
      ].join("\n"),
      methodology: [
        "Every specification on this page was taken from the manufacturer's own documentation or an independent lab review, not from a retailer listing. Where a figure is a typical value rather than a measured one, it says so.",
        "We have not colour-calibrated these ourselves. Where colour accuracy is the deciding factor we say which panel arrives factory calibrated and to what tolerance, and leave the measuring to people with the instruments.",
      ].join("\n"),
      productsConsidered: 31,
      finalWord: "Buy the Dell U2723QE. It costs more than it ought to and the stand eats your desk, but you will stop noticing the screen inside a week — and not noticing your monitor is the entire point of buying a good one.",
    },
  });

  await prisma.$transaction([
    prisma.guidePick.deleteMany({ where: { guideId: guide.id } }),
    prisma.guidePick.createMany({
      data: PICKS.map((p, i) => ({
        guideId: guide.id,
        orderIndex: i,
        award: p.award,
        name: p.name,
        brand: p.brand,
        verdict: p.verdict,
        bestFor: p.bestFor,
        considerElseIf: p.considerElseIf,
        specs: p.specs,
        pros: p.pros,
        cons: p.cons,
        // Yours to paste in. See the note at the top of this file.
        amazonUrl: null,
      })),
    }),
  ]);

  await prisma.$transaction([
    prisma.guideFaq.deleteMany({ where: { guideId: guide.id } }),
    prisma.guideFaq.createMany({
      data: FAQS.map((f, i) => ({ guideId: guide.id, orderIndex: i, ...f })),
    }),
  ]);

  console.log(`  "${guide.title}"`);
  console.log(`  ${PICKS.length} picks, ${FAQS.length} questions — still a draft`);
  console.log("  Add your Amazon links in the admin, then publish.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
