/**
 * The little bit of formatting an editor actually types.
 *
 * The guide fields are plain text, so a verdict written as
 *
 *     **Buy the KB272 G0bi if you want a big screen.** The 27-inch IPS panel…
 *
 * published with the asterisks showing. People write `**bold**` because every
 * other box they type into understands it, and telling them to stop is a worse
 * answer than supporting it.
 *
 * This does not parse Markdown and does not want to. It splits on the two
 * delimiters that get used — `**bold**` and `*italic*` — and returns React
 * elements. Nothing is ever handed to `dangerouslySetInnerHTML`, so a stray
 * angle bracket in someone's copy stays a stray angle bracket rather than
 * becoming a tag, and there is no sanitiser to keep up to date.
 */

// Bold first: `**` must win over `*`, or every bold run is read as two italics
// wrapped around nothing.
const TOKEN = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;

/**
 * @param {string} text
 * @returns {Array<string|JSX.Element>} safe to render directly
 */
export function formatInline(text) {
  const raw = String(text ?? "");
  if (!raw.includes("*")) return [raw];

  return raw.split(TOKEN).filter((part) => part !== "").map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      // Archivo ships no italic, so the browser would synthesise a slant.
      // Emphasis is carried by weight and colour instead.
      return <em key={i} className="not-italic font-medium">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

/**
 * The same thing for a block of copy where blank lines mean paragraphs.
 * Returns an array of paragraphs, each already formatted.
 */
export function formatParagraphs(text) {
  return String(text ?? "")
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(formatInline);
}
