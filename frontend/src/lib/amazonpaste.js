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
    // One is the other plus a qualifying word, at either end: "Refresh" /
    // "Refresh rate", and "Size" / "Screen size". The length cap keeps it to
    // about one word, and the floor keeps two-letter labels from matching
    // everything — so "Ports" still never swallows "Port power".
    const close = Math.abs(p.length - n.length) <= 6 && Math.min(p.length, n.length) >= 3;
    if (close && (p.startsWith(n) || n.startsWith(p) || p.endsWith(n) || n.endsWith(p))) return e;
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

/* ─────────────────────────────── spec tables ─────────────────────────────── */

// Amazon wraps table cells in bidi control marks (U+200E, U+200F) that are
// invisible on screen and survive a copy — "Screen Size : 27 Inches". Left in,
// they make "27 Inches" and "27 Inches" two different strings.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

/**
 * Rows that appear in a retailer's spec table but are not a specification.
 *
 * The rating and sales-rank rows matter most: this site does not reprint a
 * retailer's star rating or popularity rank, and a spec paste must not become
 * the back door that puts them on the page. The rest are catalogue plumbing,
 * or already have their own field on the pick (brand, model).
 */
const NOT_A_SPEC = /^(customer reviews?|best ?sellers? rank|amazon best ?sellers? rank|asin|isbn|upc|ean|gtin|global trade identification number|date first available|release date|is discontinued( by manufacturer)?|item model number|model( name| number)?|manufacturer|brand( name)?|country of origin|batteries( required| included)?|units|warranty( description)?|package (dimensions|weight)|number of items|included components|customer ratings?)$/i;
const LOOKS_LIKE_A_RATING = /out of 5 stars|\bratings?\b|#\s?\d[\d,]* in /i;

const tidyLabel = (s) => {
  const t = String(s).replace(/[:：\s]+$/, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};
const tidyValue = (s) => String(s).replace(/\s+/g, " ").trim().slice(0, 160);
const normLabel = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Turn a pasted specification table into label/value rows.
 *
 * Handles the shapes a spec table actually arrives in when copied out of a
 * browser:
 *
 *   Screen Size<TAB>27 Inches           a table, copied from Amazon or a maker
 *   Brand  :  ASUS                      Amazon's "Product details" list
 *   • Refresh rate: 165Hz               a bulleted spec sheet
 *   Resolution                          label and value on alternate lines,
 *   2560 x 1440                         which some browsers produce from tables
 *
 * Labels are folded onto the ones this guide already uses, so a paste lines up
 * in the comparison table instead of adding "Refresh Rate" beside "Refresh".
 * Nothing is invented: a line that cannot be read as a label and a value is
 * skipped and counted, never guessed at.
 *
 * @returns {{ rows: {label:string,value:string}[], skipped: number }}
 */
export function parseSpecTable(text = "", knownLabels = []) {
  const lines = String(text)
    .replace(INVISIBLE, "")
    .replace(/\u00A0/g, " ")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[•·▪◦\-*]\s+/, "").trim())
    .filter(Boolean);

  const pairs = [];
  let structured = 0;
  for (const line of lines) {
    if (line.includes("\t")) {
      const [a, ...rest] = line.split(/\t+/);
      if (a && rest.length) { pairs.push([a, rest.join(" ")]); structured++; continue; }
    }
    // A label starts with a letter, so "16:9" or "12:30" is never split.
    const m = line.match(/^([A-Za-z][^:：\t]{0,59}?)\s*[:：]\s*(.+)$/);
    if (m) { pairs.push([m[1], m[2]]); structured++; }
  }

  // Nothing had a separator: read it as label, value, label, value.
  if (!structured && lines.length >= 2) {
    for (let n = 0; n + 1 < lines.length; n += 2) pairs.push([lines[n], lines[n + 1]]);
  }

  const seen = new Set();
  const rows = [];
  let skipped = Math.max(0, lines.length - (structured || pairs.length * 2));
  for (const [a, b] of pairs) {
    let label = tidyLabel(a);
    const value = tidyValue(b);
    if (!label || !value || NOT_A_SPEC.test(label) || LOOKS_LIKE_A_RATING.test(value)) { skipped++; continue; }
    label = foldLabel(label, knownLabels);
    const key = normLabel(label);
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    rows.push({ label, value });
  }
  return { rows, skipped };
}

/**
 * Merge incoming rows into a pick's specs without destroying anything typed.
 *
 *   same label, empty value  → filled from the incoming row
 *   same label, has a value  → left exactly as the editor wrote it
 *   new label                → appended
 *
 * @returns {{ specs, added: number, filled: number, kept: number }}
 */
export function mergeSpecs(existing = [], incoming = []) {
  const specs = (existing || []).filter((s) => s && (s.label || s.value)).map((s) => ({ ...s }));
  let added = 0, filled = 0, kept = 0;
  for (const row of incoming) {
    const at = specs.findIndex((s) => normLabel(s.label) === normLabel(row.label));
    if (at === -1) { specs.push({ label: row.label, value: row.value || "" }); added++; }
    else if (!specs[at].value && row.value) { specs[at].value = row.value; filled++; }
    else kept++;
  }
  return { specs, added, filled, kept };
}

/**
 * Starting label sets, one per kind of product.
 *
 * The labels a comparison is worth having are the same for every monitor, so
 * a guide starts from the right ones rather than from a blank row. They are a
 * starting point, not a schema: every label can be renamed or removed.
 */
export const SPEC_TEMPLATES = {
  Monitor: ["Size", "Resolution", "Refresh rate", "Panel", "Response time", "Brightness", "Ports", "Stand", "VESA mount"],
  Webcam: ["Resolution", "Frame rate", "Field of view", "Focus", "Microphone", "Connection", "Mount", "Privacy cover"],
  Laptop: ["Processor", "Memory", "Storage", "Display", "Graphics", "Battery", "Weight", "Ports", "Operating system"],
  Keyboard: ["Layout", "Switches", "Connection", "Backlight", "Battery", "Keycaps", "Weight"],
  Mouse: ["Sensor", "DPI", "Buttons", "Connection", "Battery", "Weight"],
  Headset: ["Type", "Connection", "Noise cancelling", "Microphone", "Battery", "Driver size", "Weight"],
  Microphone: ["Type", "Polar pattern", "Connection", "Sample rate", "Mount", "Headphone jack"],
  "Docking station": ["Connection", "Displays supported", "Power delivery", "Ports", "Ethernet", "Compatibility"],
};
