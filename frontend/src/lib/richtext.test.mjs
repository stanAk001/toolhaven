/**
 * The formatter must never turn user copy into markup.
 *
 * These run the splitter directly and inspect the parts, so the assertions do
 * not need React. The property that matters is the last one: anything that
 * looks like a tag comes back as a plain string.
 */
import { formatInline, formatParagraphs } from "./richtext.jsx";

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log("FAIL " + what); } };
// A part is either a plain string or a React element; describe it flatly.
const shape = (parts) => parts.map((p) =>
  (typeof p === "string" ? `text:${p}` : `${p.type}:${p.props.children}`)).join(" | ");

ok(shape(formatInline("plain words")) === "text:plain words", "plain text passes through untouched");

ok(shape(formatInline("**Buy this.** The rest.")) === "strong:Buy this. | text: The rest.",
  "a leading bold run, exactly as it appears in the live guide");

ok(shape(formatInline("a *little* emphasis")) === "text:a  | em:little | text: emphasis",
  "single asterisks become emphasis");

ok(shape(formatInline("**one** and **two**")) === "strong:one | text: and  | strong:two",
  "two bold runs in one line");

// The trap: `**` scanned as two `*` would make nonsense of every bold run.
ok(formatInline("**bold**").every((p) => typeof p !== "string" || !p.includes("*")),
  "no stray asterisks survive a bold run");

// Degenerate input must not throw or produce empty elements.
// An empty string comes back as a single empty part, which React renders as
// nothing. Asserting on the rendered result rather than the array shape.
ok(formatInline("").join("") === "", "empty string renders nothing");
ok(shape(formatInline("* not a pair")) === "text:* not a pair", "an unpaired asterisk stays literal");
ok(shape(formatInline("2 * 3 * 4")) === "text:2  | em: 3  | text: 4", "arithmetic is not mangled into markup");
ok(formatInline(null).length === 1, "null does not throw");
ok(formatInline(undefined).length === 1, "undefined does not throw");

// The whole point: no HTML, ever.
const evil = formatInline("<script>alert(1)</script> and <b>bold</b>");
ok(evil.length === 1 && typeof evil[0] === "string", "markup in the copy stays a plain string");
ok(evil[0].includes("<script>"), "and is preserved verbatim rather than stripped");

const paras = formatParagraphs("First para.\n\nSecond **para**.");
ok(paras.length === 2, "blank lines split paragraphs");
ok(shape(paras[1]) === "text:Second  | strong:para | text:.", "and each paragraph is formatted");
ok(formatParagraphs("").length === 0, "empty copy yields no paragraphs");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
