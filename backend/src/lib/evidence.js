// Review confidence and the Toolhaven Trust Score.
//
// The idea this module exists to enforce: 4.9/5 from 12 reviews on one platform
// is not the same claim as 4.7/5 from 4,000 across four. Most sites print both
// as a number and let the reader assume they mean the same thing. These
// functions refuse to.
//
// Nothing here invents anything. Every output is derived from rows that were
// entered with a source URL and a date, and when there are no rows the answer
// is "insufficient", not a default.

// A platform's own scale normalised to /5 so different sources are comparable.
const norm = (r) => (r.maxRating ? (r.rating / r.maxRating) * 5 : r.rating);

const SMALL_SAMPLE = 30; // below this, a rating says more about who bothered

/**
 * How much weight the available external evidence can bear.
 *
 * Four inputs, because each fails differently on its own:
 *   volume       a big number is easy to trust and easy to be wrong about
 *   sources      one platform is one platform's moderation policy
 *   agreement    sources that disagree are telling you something
 *   freshness    a 2019 rating describes software that no longer exists
 *
 * @returns {{level, label, reasons, volume, sources, spread, stale}}
 */
export function reviewConfidence(ratings = []) {
  if (!ratings.length) {
    return {
      level: "insufficient",
      label: "Insufficient data",
      reasons: ["No external ratings recorded yet."],
      volume: 0, sources: 0, spread: null, stale: false,
    };
  }

  const volume = ratings.reduce((n, r) => n + (r.reviewCount || 0), 0);
  const sources = ratings.length;
  const scores = ratings.map(norm);
  const spread = sources > 1 ? Math.max(...scores) - Math.min(...scores) : 0;

  // "Old" is generous — most platforms move slowly — but two years is enough
  // for a product to have changed underneath its rating.
  const twoYears = Date.now() - 2 * 365 * 86400000;
  const stale = ratings.every((r) => {
    const d = r.ratingDate || r.retrievedAt;
    return d && new Date(d).getTime() < twoYears;
  });

  const reasons = [];
  let points = 0;

  if (volume >= 1000) { points += 3; reasons.push(`${volume.toLocaleString()} reviews in total`); }
  else if (volume >= 100) { points += 2; reasons.push(`${volume.toLocaleString()} reviews in total`); }
  else if (volume >= SMALL_SAMPLE) { points += 1; reasons.push(`${volume} reviews in total`); }
  else { reasons.push(`Only ${volume} review${volume === 1 ? "" : "s"} in total`); }

  if (sources >= 3) { points += 2; reasons.push(`${sources} independent platforms`); }
  else if (sources === 2) { points += 1; reasons.push("2 independent platforms"); }
  else { reasons.push("A single platform"); }

  // Agreement only means something once there is more than one source.
  if (sources > 1) {
    if (spread <= 0.5) { points += 1; reasons.push("Platforms broadly agree"); }
    else if (spread >= 1.5) { points -= 1; reasons.push("Platforms disagree noticeably"); }
  }

  if (stale) { points -= 1; reasons.push("Figures are more than two years old"); }

  // Calibrated so that "low" means the evidence is genuinely thin — a handful
  // of reviews, or figures old enough to describe different software. It used
  // to mean "only one platform", which stamped a warning on tools with
  // thousands of consistent reviews and made every page look uncertain. The
  // single-platform caveat is still said out loud; it is just said in the
  // reasons, where it belongs, rather than as a grade.
  const level = points >= 5 ? "high" : points >= 2 ? "medium" : "low";
  return {
    level,
    label: { high: "High", medium: "Medium", low: "Low" }[level],
    reasons, volume, sources,
    spread: sources > 1 ? Math.round(spread * 100) / 100 : null,
    stale,
  };
}

/**
 * The Trust Score — how much evidence exists, NOT how good the product is.
 *
 * Kept deliberately separate from ToolScore. A mediocre product with thousands
 * of consistent reviews scores high here; an excellent new one scores low. The
 * UI has to say so, or the number is worse than useless.
 *
 * Returns null when there is nothing to be confident about, so the badge is
 * omitted rather than showing a low score that reads as an accusation.
 */
export function trustScore({ ratings = [], facts = [], reviewCount = 0, hasScore = false } = {}) {
  const conf = reviewConfidence(ratings);
  if (conf.level === "insufficient" && !facts.length && !reviewCount && !hasScore) return null;

  const parts = [];
  let total = 0;

  // external evidence — the heaviest input, because it is the least ours
  const ext = { high: 45, medium: 30, low: 15, insufficient: 0 }[conf.level];
  total += ext;
  parts.push({ label: "External reviews", points: ext, max: 45 });

  // cited facts — each one is a claim someone can go and check
  const cited = facts.filter((f) => f.sourceUrl).length;
  const factPts = Math.min(20, cited * 5);
  total += factPts;
  parts.push({ label: "Cited facts", points: factPts, max: 20 });

  // our own assessment
  const scorePts = hasScore ? 20 : 0;
  total += scorePts;
  parts.push({ label: "Toolhaven assessment", points: scorePts, max: 20 });

  // this site's own readers
  const commPts = reviewCount >= 20 ? 15 : reviewCount >= 5 ? 8 : reviewCount > 0 ? 4 : 0;
  total += commPts;
  parts.push({ label: "Toolhaven reviews", points: commPts, max: 15 });

  return { score: Math.min(100, Math.round(total)), parts, confidence: conf };
}

/**
 * Shape external ratings for the page: each source with its own figure, an
 * explicit small-sample flag, and a note when sources disagree. Never averages
 * them into one number — averaging is what hides the disagreement.
 */
export function presentExternal(ratings = []) {
  if (!ratings.length) return null;
  const conf = reviewConfidence(ratings);
  const scores = ratings.map(norm);

  return {
    sources: ratings.map((r) => ({
      sourceName: r.sourceName,
      sourceUrl: r.sourceUrl,
      rating: r.rating,
      maxRating: r.maxRating,
      reviewCount: r.reviewCount,
      smallSample: r.reviewCount < SMALL_SAMPLE,
      summary: r.summary || null,
      retrievedAt: r.retrievedAt,
      ratingDate: r.ratingDate,
    })),
    totalReviews: conf.volume,
    confidence: conf,
    // Stated, not smoothed over. Which platform is the outlier is the useful part.
    disagreement: conf.spread != null && conf.spread >= 1.5
      ? {
        spread: conf.spread,
        lowest: ratings[scores.indexOf(Math.min(...scores))].sourceName,
        highest: ratings[scores.indexOf(Math.max(...scores))].sourceName,
      }
      : null,
  };
}

// The single figure a card can carry. Cards have room for one number, so it is
// the platform with the most reviews behind it — never a blend of platforms,
// which would be an average nobody published. Returns null when there is
// nothing real to show, and the card then shows no rating at all rather than
// announcing an absence.
export function headlineRating(ratings = []) {
  if (!ratings.length) return null;
  const top = [...ratings].sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))[0];
  if (!top) return null;
  // A card shows the figure without room for the caveat, so a thin sample must
  // not headline one. Looka's 5.0 from four reviews would otherwise outrank
  // every honest 4.6 on the page. The full rating still appears on the tool
  // page, where the sample size and the warning sit right beside it.
  if ((top.reviewCount || 0) < SMALL_SAMPLE) return null;
  return {
    rating: top.rating,
    maxRating: top.maxRating || 5,
    sourceName: top.sourceName,
    sourceUrl: top.sourceUrl,
    reviewCount: top.reviewCount,
  };
}
