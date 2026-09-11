/**
 * The spec-table paste.
 *
 * Every fixture here is shaped like text actually copied out of a browser:
 * Amazon's tables arrive tab-separated with invisible bidi marks around each
 * value, its "Product details" list arrives as "Label ‏ : ‎ Value", and some
 * browsers turn a table into alternating lines. The rules that matter most are
 * the negative ones — a retailer's star rating and sales rank must never ride
 * in on a paste, and nothing the editor already typed may be overwritten.
 *
 *   node src/lib/amazonpaste.test.mjs
 */
import { parseSpecTable, mergeSpecs, SPEC_TEMPLATES, foldLabel } from "./amazonpaste.js";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL " + what); } };
const labels = (rows) => rows.map((r) => r.label).join(" | ");
const valueOf = (rows, l) => rows.find((r) => r.label === l)?.value;
const LRM = "‎", RLM = "‏";

// --- Amazon "Technical details": tabs, bidi marks, and rows that are not specs
{
  const text = [
    `Screen Size\t${LRM}27 Inches`,
    `Resolution\t${LRM}FHD 1080p`,
    `Customer Reviews\t4.5 out of 5 stars 1,234 ratings`,
    `Best Sellers Rank\t#12 in Computer Monitors`,
    `Brand\t${LRM}ASUS`,
    `Refresh Rate\t${LRM}75 Hz`,
  ].join("\n");
  const { rows, skipped } = parseSpecTable(text);
  ok(labels(rows) === "Screen Size | Resolution | Refresh Rate", "technical details: kept the three specs — got " + labels(rows));
  ok(valueOf(rows, "Screen Size") === "27 Inches", "bidi marks stripped from values");
  ok(!rows.some((r) => /stars|ratings|#\d/.test(r.value)), "a retailer's rating and sales rank never come through");
  ok(skipped === 3, "reviews, rank and brand counted as skipped — got " + skipped);
}

// --- Amazon "Product details": "Label ‏ : ‎ Value"
{
  const text = `Brand ${RLM} : ${LRM} ASUS\nModel Name ${RLM} : ${LRM} VA27DQ\nScreen Size ${RLM} : ${LRM} 27 Inches`;
  const { rows } = parseSpecTable(text);
  ok(labels(rows) === "Screen Size", "brand and model skipped — they have their own fields — got " + labels(rows));
}

// --- a bulleted spec sheet, including a value that itself contains a colon
{
  const { rows } = parseSpecTable("• Refresh rate: 165Hz\n• Panel: IPS\nAspect Ratio: 16:9");
  ok(labels(rows) === "Refresh rate | Panel | Aspect Ratio", "bullets stripped — got " + labels(rows));
  ok(valueOf(rows, "Aspect Ratio") === "16:9", "a colon inside the value is not split on");
}

// --- a table that came through as alternating lines
{
  const { rows } = parseSpecTable("Resolution\n2560 x 1440\nPanel\nVA");
  ok(labels(rows) === "Resolution | Panel" && valueOf(rows, "Panel") === "VA", "alternating label/value lines");
}

// --- labels fold onto the ones the guide already uses
{
  const { rows } = parseSpecTable("Refresh Rate\t75 Hz\nScreen size\t27 in", ["Refresh rate", "Screen Size"]);
  ok(labels(rows) === "Refresh rate | Screen Size", "folded onto the guide's labels — got " + labels(rows));
}

// --- duplicates, disguised ratings, and text that is not a table
{
  ok(parseSpecTable("Panel\tIPS\nPanel\tVA").rows.length === 1, "a repeated label is kept once");
  ok(parseSpecTable("Rating\t4.6 out of 5 stars").rows.length === 0, "a rating under an innocent label is still refused");
  ok(parseSpecTable("just a sentence with no structure").rows.length === 0, "prose is not guessed into a row");
  ok(parseSpecTable("").rows.length === 0 && parseSpecTable("").skipped === 0, "empty paste");
}

// --- merging never overwrites what was typed
{
  const existing = [{ label: "Size", value: "27 in" }, { label: "Panel", value: "" }, { label: "", value: "" }];
  const incoming = [{ label: "Size", value: "32 in" }, { label: "panel", value: "IPS" }, { label: "Ports", value: "HDMI" }];
  const { specs, added, filled, kept } = mergeSpecs(existing, incoming);
  ok(specs.find((s) => s.label === "Size").value === "27 in", "a typed value is never overwritten");
  ok(specs.find((s) => s.label === "Panel").value === "IPS", "an empty value is filled");
  ok(specs.some((s) => s.label === "Ports"), "a new label is appended");
  ok(!specs.some((s) => !s.label && !s.value), "blank rows are dropped");
  ok(added === 1 && filled === 1 && kept === 1, `counts reported — added ${added}, filled ${filled}, kept ${kept}`);
}

// --- folding at either end of the label
{
  ok(foldLabel("Size", ["Screen Size"]) === "Screen Size", "Size folds onto Screen Size");
  ok(foldLabel("Screen size", ["Size"]) === "Size", "and the other way round");
  ok(foldLabel("Weight", ["Item Weight"]) === "Item Weight", "Weight folds onto Item Weight");
  ok(foldLabel("Ports", ["Port power"]) === "Ports", "Ports still does not swallow Port power");
  ok(foldLabel("OS", ["Photos"]) === "OS", "a two-letter label does not match on a suffix");
}

// --- a template applied after a paste, on the same pick — the case the
//     browser drive caught: it used to leave "Screen Size" and "Size" side by side
{
  const pasted = [{ label: "Screen Size", value: "27 Inches" }, { label: "Refresh Rate", value: "165 Hz" }];
  const own = pasted.map((s) => s.label);
  const template = SPEC_TEMPLATES.Monitor.map((l) => ({ label: foldLabel(l, own), value: "" }));
  const { specs } = mergeSpecs(pasted, template);
  ok(specs.filter((s) => /size/i.test(s.label)).length === 1, "one size row, not two — got " + specs.map((s) => s.label).join(", "));
  ok(specs.filter((s) => /refresh/i.test(s.label)).length === 1, "one refresh row");
  ok(specs.find((s) => s.label === "Screen Size").value === "27 Inches", "and the pasted value is untouched");
}

// --- templates
ok(SPEC_TEMPLATES.Monitor.includes("Refresh rate"), "monitor template carries the labels a monitor is compared on");
ok(Object.values(SPEC_TEMPLATES).every((l) => l.length <= 14), "no template exceeds the 14 rows the server keeps");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
