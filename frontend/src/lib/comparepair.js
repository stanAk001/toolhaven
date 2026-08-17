// Canonical "a-vs-b" comparison URLs.
//
// "notion-vs-obsidian" and "obsidian-vs-notion" describe the same comparison,
// so left unchecked they'd be two URLs competing for one query — the textbook
// way to split your own ranking. One ordering is canonical (alphabetical) and
// the other redirects to it.
//
// The logic lives here rather than in the page because the sitemap generator
// has to agree with the router about what a valid pair URL looks like. Two
// implementations of that rule would eventually disagree.

export const VS = "-vs-";

/** Canonical pair slug for two tool slugs, order-independent. */
export function pairSlug(a, b) {
  return [a, b].sort().join(VS);
}

/**
 * Parse "a-vs-b" into its two slugs.
 *
 * Tool slugs may themselves contain hyphens ("stock-trading-app"), so this
 * splits only on the "-vs-" delimiter. If a slug ever legitimately contained
 * "-vs-" the split would be ambiguous — so every candidate split is returned
 * and the caller resolves whichever pair actually matches real tools.
 */
export function parsePair(pair = "") {
  const parts = [];
  let from = 0;
  for (;;) {
    const at = pair.indexOf(VS, from);
    if (at === -1) break;
    parts.push([pair.slice(0, at), pair.slice(at + VS.length)]);
    from = at + 1;
  }
  return parts;
}

/** True when the given pair slug is already in canonical order. */
export function isCanonicalPair(pair, a, b) {
  return pair === pairSlug(a, b);
}
