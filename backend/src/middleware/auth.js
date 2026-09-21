/**
 * The editor's gate.
 *
 * This single header guards everything an editor can do: publishing and
 * unpublishing tools, deleting submissions, approving and rejecting campaigns,
 * marking refunds, changing prices. It is the most valuable credential in the
 * system, so two things matter about how it is checked.
 *
 * Constant time. The previous check was `sent !== token`, which returns as
 * soon as two characters differ. That leaks, in the response time, how much of
 * a guess was right — enough to recover a token character by character rather
 * than guessing the whole thing. Comparing fixed-length digests instead takes
 * the same time whatever the input, and hashing first means two different
 * lengths compare safely.
 *
 * Strength. A short or numeric token is guessable at the rate the network
 * allows regardless of how carefully it is compared, so the server says so at
 * startup rather than leaving it to be discovered.
 */
import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s) => createHash("sha256").update(String(s), "utf8").digest();

/** Same time for a right answer, a wrong one, and a missing one. */
function sameToken(sent, expected) {
  if (!sent || !expected) return false;
  return timingSafeEqual(digest(sent), digest(expected));
}

/** Is this request carrying the editor's token? For relaxing limits, not for
 *  granting access — anything protected uses requireAdmin. */
export function isAdmin(req) {
  return sameToken(req.get("x-admin-token"), process.env.ADMIN_TOKEN);
}

export function requireAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: "Admin access isn't configured." });
  if (!sameToken(req.get("x-admin-token"), token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

/**
 * How guessable is the configured token? Reported at boot, never at runtime.
 *
 * @returns {{ ok: boolean, reason: string|null, combinations: number|null }}
 */
export function adminTokenStrength(token = process.env.ADMIN_TOKEN) {
  if (!token) return { ok: false, reason: "ADMIN_TOKEN is not set", combinations: null };

  const s = String(token);
  const classes =
    (/[a-z]/.test(s) ? 26 : 0) +
    (/[A-Z]/.test(s) ? 26 : 0) +
    (/[0-9]/.test(s) ? 10 : 0) +
    (/[^A-Za-z0-9]/.test(s) ? 30 : 0);
  const combinations = Math.pow(classes || 1, s.length);

  if (/^\d+$/.test(s) && s.length <= 10) {
    return { ok: false, reason: `${s.length} digits — ${combinations.toLocaleString("en-US")} possibilities`, combinations };
  }
  if (s.length < 20) {
    return { ok: false, reason: `only ${s.length} characters`, combinations };
  }
  return { ok: true, reason: null, combinations };
}
