/**
 * Carrying a half-built campaign from /promote into the signed-in flow.
 *
 * Someone builds a campaign on the public page before they have signed in —
 * that is the whole point of showing the price there. Without somewhere to put
 * the build, the "start this campaign" button can only drop them on the sign-in
 * screen and lose every choice they made, which is the worst possible moment
 * to ask a person to start again.
 *
 * sessionStorage rather than a URL: it survives the sign-in round trip, it is
 * gone when the tab closes, and it keeps the choices out of a link that might
 * be shared or logged. Nothing here is trusted — the server re-prices the
 * build from scratch, so at worst a tampered value produces a different quote
 * on screen, never a different charge.
 */
const KEY = "toolhaven-build";

export function saveBuild(build) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      placements: Array.isArray(build?.placements) ? build.placements : [],
      days: Number(build?.days) || null,
      at: Date.now(),
    }));
  } catch { /* private mode, blocked storage: the flow still works, just empty */ }
}

/** Read it back, once. Stale handoffs are dropped rather than resurrected. */
export function takeBuild({ maxAgeMs = 60 * 60 * 1000 } = {}) {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const b = JSON.parse(raw);
    if (!b?.placements?.length || !b?.days) return null;
    if (Date.now() - (b.at || 0) > maxAgeMs) return null;
    return { placements: b.placements, days: b.days };
  } catch {
    return null;
  }
}

export function hasBuild() {
  try { return Boolean(sessionStorage.getItem(KEY)); } catch { return false; }
}
