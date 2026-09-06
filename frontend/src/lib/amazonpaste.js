/**
 * Helpers for turning what you can legitimately copy off an Amazon page into
 * filled-in form fields.
 *
 * This is not a scraper and it never touches the network. You paste text you
 * are already looking at — the listing title, the product URL — and these
 * functions split it into the fields the form wants, so you stop retyping the
 * same five specification labels for the twentieth product in a guide.
 *
 * Everything here proposes. Nothing here decides: every value lands in an
 * editable input, because Amazon titles are written by sellers for the search
 * box, not by anyone trying to describe a product accurately.
 */

/** Pull the ASIN out of any Amazon URL shape. Returns null if there isn't one. */
export function asinFromUrl(url = "") {
  if (!url) return null;
  // /dp/ASIN, /gp/product/ASIN, /product/ASIN, ?asin=ASIN — all in the wild.
  const m = String(url).match(/(?:\/dp\/|\/gp\/product\/|\/product\/|[?&]asin=)([A-Z0-9]{10})\b/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Brands worth recognising as two words. Everything else is assumed to be the
 * first word of the title, which is how Amazon titles are overwhelmingly built.
 * A wrong guess costs one edit; the field is right there.
 */
const TWO_WORD_BRANDS = [
  "Amazon Basics", "Amazon Essentials", "Western Digital", "Corsair Gaming",
  "HP Inc", "LG Electronics", "Samsung Electronics", "Sony Electronics",
  "Cooler Master", "Thermaltake Technology", "Arctic Cooling", "Elgato Gaming",
];

/**
 * Clauses that are marketing rather than description, and belong in no field:
 * the audience pitch Amazon titles end on, and the colourway.
 */
const NOISE = /^(?:for |perfect for |ideal for |great for |designed for |compatible with )|^(?:black|white|silver|grey|gray|space gray|blue|red|graphite|midnight)$/i;

/**
 * The same pitch, arriving welded onto the end of a real clause — "Built-in
 * Speakers for Office and Home". "Built-in Speakers" is a specification worth
 * keeping, so the tail is cut rather than the clause thrown away.
 */
const TAIL = /\s+(?:for|perfect for|ideal for|great for|designed for)\s+(?:the\s+)?(?:office|home|work|school|travel|gaming|business|students?|professionals?|everyday)\b.*$/i;

/** A clause that reads like a specification: has a number, or a known keyword. */
const SPEC_HINTS = [
  [/(\d+(?:\.\d+)?)\s*[- ]?inch/i, "Size"],
  [/\b(\d{3,4}p|4K|8K|QHD|WQHD|UHD|FHD|Full HD|1440p|2160p)\b/i, "Resolution"],
  [/\b(\d+)\s*Hz\b/i, "Refresh rate"],
  [/\b(IPS|VA|TN|OLED|QLED|Mini[- ]?LED)\b/i, "Panel"],
  [/\b(\d+)\s*(?:GB|TB)\b/i, "Capacity"],
  [/\b(\d+)\s*W\b/i, "Power"],
  [/\b(USB[- ]?C|Thunderbolt|HDMI|DisplayPort|Display Port|VGA|Ethernet)\b/i, "Ports"],
  [/\bVESA\b/i, "VESA mount"],
  [/\b(?:built[- ]in )?speakers?\b/i, "Speakers"],
  [/\badjustable stand\b|\bheight adjust/i, "Stand"],
  [/\b(Wi[- ]?Fi\s*\d?|Bluetooth\s*[\d.]*)\b/i, "Wireless"],
  [/\b(\d+(?:\.\d+)?)\s*(?:mAh|Wh)\b/i, "Battery"],
];

/**
 * Split an Amazon listing title into the pieces the pick form wants.
 *
 * Amazon titles are one long comma-separated keyword run: brand, then a rough
 * product description, then every specification the seller could fit, then a
 * colour. That structure is consistent enough to be worth splitting on, and
 * wrong often enough that everything comes back as a suggestion.
 */
export function parseListingTitle(raw = "") {
  const title = String(raw).replace(/\s+/g, " ").trim();
  if (!title) return { brand: "", name: "", specs: [] };

  const brand = TWO_WORD_BRANDS.find((b) => title.toLowerCase().startsWith(b.toLowerCase()))
    || title.split(/[\s,]/)[0];

  const clauses = title.slice(brand.length).split(",").map((c) => c.trim()).filter(Boolean);

  // The name is the first clause that isn't already pure specification — the
  // human-readable "what is this", trimmed to something a heading can carry.
  const name = (clauses[0] || title).replace(/\s+/g, " ").trim();

  // Everything after it gets tested against the spec patterns. One row per
  // label: the first clause to claim a label wins, so "HDMI, Display Port and
  // VGA Input" does not become three separate Ports rows.
  const specs = [];
  const taken = new Set();
  for (const raw2 of clauses.slice(1)) {
    if (NOISE.test(raw2)) continue;
    const clause = raw2.replace(TAIL, "").trim();
    if (!clause) continue;
    for (const [re, lab] of SPEC_HINTS) {
      if (taken.has(lab) || !re.test(clause)) continue;
      specs.push({ label: lab, value: clause });
      taken.add(lab);
      break;
    }
  }

  // The first clause usually carries specs too ("24-inch Full HD IPS Monitor").
  for (const [re, lab] of SPEC_HINTS) {
    if (taken.has(lab)) continue;
    const m = name.match(re);
    if (m) { specs.push({ label: lab, value: m[0] }); taken.add(lab); }
  }

  specs.sort((a, b) => SPEC_HINTS.findIndex(([, l]) => l === a.label)
    - SPEC_HINTS.findIndex(([, l]) => l === b.label));

  return { brand, name, specs };
}

/**
 * Fold a proposed label onto one the guide already uses when they are plainly
 * the same thing.
 *
 * Without this, pasting a listing into a guide whose rows say "Refresh" adds a
 * second row called "Refresh rate", and the comparison table grows two columns
 * for one specification. Matching is deliberately narrow — identical once
 * case and spacing are stripped, or one is a whole-word prefix of the other —
 * so "Ports" never swallows "Port power".
 */
export function foldLabel(proposed, existing = []) {
  const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
  const p = norm(proposed);
  for (const e of existing) {
    const n = norm(e);
    if (!n) continue;
    if (n === p) return e;
    // One is the other plus a qualifying word: "Refresh" / "Refresh rate".
    if ((p.startsWith(n) || n.startsWith(p)) && Math.abs(p.length - n.length) <= 6) return e;
  }
  return proposed;
}

/**
 * The specification labels already used elsewhere in this guide, most-used
 * first. A comparison table only lines up when every pick uses the same labels,
 * so the form offers the ones already in play rather than trusting anyone to
 * retype "Refresh rate" identically twenty times.
 */
export function labelsInUse(picks = [], exceptIndex = -1) {
  const count = new Map();
  picks.forEach((p, i) => {
    if (i === exceptIndex) return;
    for (const s of p.specs || []) {
      const l = (s.label || "").trim();
      if (l) count.set(l, (count.get(l) || 0) + 1);
    }
  });
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
}
