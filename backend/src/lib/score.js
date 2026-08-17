// The Toolhaven Score.
//
// Six editorial dimensions, each out of 10. The overall figure is the mean of
// whichever ones are filled in — computed here, on read, and never written to
// the database. A stored aggregate is a lie waiting to happen: someone updates
// one dimension, forgets to recompute, and the headline number silently stops
// matching the breakdown it's printed next to.
//
// One place computes it, so the tool page, the comparison sheet and the admin
// can't disagree about what a tool scores.

export const SCORE_DIMENSIONS = [
  { key: "features", label: "Features", blurb: "Depth where it matters for the job, not a long list nobody switches on." },
  { key: "easeOfUse", label: "Ease of use", blurb: "How long before someone new is genuinely productive." },
  { key: "performance", label: "Performance", blurb: "Speed, and how it behaves under real load rather than in a demo." },
  { key: "value", label: "Value", blurb: "What you get for the money, judged against the free tier and the nearest rival." },
  { key: "devExperience", label: "Developer experience", blurb: "Docs, API, integrations, and whether you can get your data back out." },
  { key: "support", label: "Support", blurb: "Whether you can solve your own problem at 2am, and what happens when you can't." },
];

const KEYS = SCORE_DIMENSIONS.map((d) => d.key);

/**
 * Mean of the dimensions actually scored, to one decimal.
 * Returns null when nothing has been assessed — the caller then shows no score
 * at all rather than a zero, which would read as "we rated this 0/10".
 */
export function overallScore(score) {
  if (!score) return null;
  const values = KEYS.map((k) => score[k]).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(mean * 10) / 10;
}

/** Shape a ToolScore row for the API: dimensions + computed overall + coverage. */
export function presentScore(score) {
  if (!score) return null;
  const overall = overallScore(score);
  if (overall == null) return null;
  return {
    overall,
    // how complete the assessment is, so the UI can say "4 of 6 assessed"
    assessed: KEYS.filter((k) => typeof score[k] === "number").length,
    total: KEYS.length,
    dimensions: SCORE_DIMENSIONS.map((d) => ({
      key: d.key, label: d.label, blurb: d.blurb, value: score[d.key] ?? null,
    })),
    notes: score.notes || null,
    scoredBy: score.scoredBy || null,
    scoredAt: score.scoredAt,
    updatedAt: score.updatedAt,
  };
}

/** Validate and coerce an incoming score payload. Returns { data } or { error }. */
export function parseScoreInput(body = {}) {
  const data = {};
  for (const k of KEYS) {
    if (body[k] === undefined) continue;
    if (body[k] === null || body[k] === "") { data[k] = null; continue; }
    const n = Number(body[k]);
    if (Number.isNaN(n)) return { error: `${k} must be a number.` };
    if (n < 0 || n > 10) return { error: `${k} must be between 0 and 10.` };
    data[k] = Math.round(n * 10) / 10;
  }
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (body.scoredBy !== undefined) data.scoredBy = body.scoredBy?.trim() || null;
  return { data };
}
