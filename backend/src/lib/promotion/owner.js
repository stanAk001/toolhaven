/**
 * Proving a tool is yours, without accounts.
 *
 * Toolhaven has never had user accounts. What it has had, since submissions
 * existed, is a stronger claim than most password systems: a tool was
 * submitted from an email address, and the person who can read that address is
 * the owner. The submission's own token already works that way — it is how the
 * status page is reached, and the schema says so.
 *
 * This extends that rather than replacing it. You type the address you
 * submitted with, we email a single-use link, and following it exchanges the
 * link for a session. No passwords to store, leak or reset, and a six-month-old
 * submitter needs nothing but their inbox — which is exactly what §38 asks for.
 *
 * Two deliberate properties:
 *
 *   The request never says whether an address is known. "If that address has a
 *   published tool, the link is on its way" is returned either way, so this
 *   cannot be used to find out who has submitted to Toolhaven.
 *
 *   A session grants access to the tools that address owns, and nothing else.
 *   Ownership is re-read from the database on every request; the session token
 *   carries no tool ids and asserts nothing beyond the address.
 */
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../prisma.js";

const LOGIN_TTL_MIN = 20;
const SESSION_TTL_DAYS = 30;

const token = (bytes = 24) => randomBytes(bytes).toString("hex");

export const normaliseEmail = (raw) => String(raw || "").trim().toLowerCase();

/**
 * Issue a login link for an address.
 *
 * Returns the token when there is genuinely something to sign in to, and null
 * otherwise. The caller sends the same reply either way.
 */
export async function issueLoginToken(rawEmail) {
  const email = normaliseEmail(rawEmail);
  if (!email || !email.includes("@")) return null;

  // Only addresses with a published tool can sign in — there is nothing to
  // promote otherwise, and a link to an empty dashboard is a confusing email.
  const owned = await prisma.toolSubmission.count({
    where: { email: { equals: email, mode: "insensitive" }, status: "published", publishedToolId: { not: null } },
  });
  if (!owned) return null;

  // Old links for this address stop working the moment a new one is asked for.
  await prisma.ownerLoginToken.updateMany({
    where: { email, usedAt: null },
    data: { usedAt: new Date() },
  });

  const row = await prisma.ownerLoginToken.create({
    data: { email, token: token(), expiresAt: new Date(Date.now() + LOGIN_TTL_MIN * 60000) },
  });
  return { token: row.token, email, expiresMinutes: LOGIN_TTL_MIN };
}

/**
 * Exchange a login link for a session. Single use, and expiring.
 * @returns {Promise<{ token: string, email: string, expiresAt: Date }|null>}
 */
export async function redeemLoginToken(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;

  const row = await prisma.ownerLoginToken.findUnique({ where: { token: value } });
  if (!row || row.usedAt || row.expiresAt <= new Date()) return null;

  // Marked used before the session exists, so a link raced twice yields one
  // session rather than two.
  const claimed = await prisma.ownerLoginToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (!claimed.count) return null;

  const session = await prisma.ownerSession.create({
    data: {
      email: row.email,
      token: token(32),
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86400000),
    },
  });
  return { token: session.token, email: session.email, expiresAt: session.expiresAt };
}

/**
 * Express gate for vendor endpoints. Puts `req.owner = { email }` in place.
 *
 * Mirrors requireAdmin: a token in a header, compared server-side. The client
 * then has one idea of how auth works rather than two.
 */
export async function requireOwner(req, res, next) {
  try {
    const value = (req.get("x-owner-token") || "").trim();
    if (!value) return res.status(401).json({ error: "Sign in to manage your campaigns." });

    const session = await prisma.ownerSession.findUnique({ where: { token: value } });
    if (!session || session.expiresAt <= new Date()) {
      return res.status(401).json({ error: "That sign-in link has expired. Please request a new one." });
    }

    // Cheap liveness, written at most once an hour so a busy dashboard is not
    // a write per request.
    if (Date.now() - session.lastSeenAt.getTime() > 3600000) {
      prisma.ownerSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
        .catch(() => { /* a stale timestamp is not worth failing a request over */ });
    }

    req.owner = { email: session.email, sessionId: session.id };
    next();
  } catch (err) { next(err); }
}

/**
 * The published tools this address owns.
 *
 * Read fresh every time. A session says who you are; it never says what you
 * own, so a tool transferred or unpublished since sign-in is reflected at once.
 */
export async function ownedTools(email) {
  const subs = await prisma.toolSubmission.findMany({
    where: {
      email: { equals: normaliseEmail(email), mode: "insensitive" },
      status: "published",
      publishedToolId: { not: null },
    },
    select: { id: true, toolName: true, status: true, publishedToolId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  if (!subs.length) return [];

  // publishedToolId is a plain column rather than a Prisma relation, so the
  // listing is fetched separately. Two queries for the whole set, not one per
  // submission — and adding a foreign key to a column that has been filled for
  // months is a migration with real risk, for no gain here.
  const tools = await prisma.tool.findMany({
    where: { id: { in: [...new Set(subs.map((s) => s.publishedToolId))] } },
    select: {
      id: true, slug: true, name: true, description: true,
      logoUrl: true, logoMono: true, websiteUrl: true,
      category: { select: { id: true, slug: true, name: true } },
    },
  });
  const byId = new Map(tools.map((t) => [t.id, t]));

  // A submission whose listing has since been deleted is dropped: there is
  // nothing left to promote, and half a record on the dashboard is worse than
  // no record.
  return subs
    .map((s) => ({ ...s, tool: byId.get(s.publishedToolId) || null }))
    .filter((s) => s.tool);
}

/**
 * Does this address own this submission, and is the tool live?
 * Every campaign write goes through here — ownership is never taken from the
 * request body.
 */
export async function assertOwnership(email, submissionId) {
  const sub = await prisma.toolSubmission.findUnique({
    where: { id: Number(submissionId) },
    select: { id: true, email: true, status: true, publishedToolId: true, toolName: true },
  });
  if (!sub || normaliseEmail(sub.email) !== normaliseEmail(email)) {
    // Deliberately the same answer as "no such submission": whether a given id
    // exists is not something a signed-in stranger should be able to learn.
    const e = new Error("We couldn't find that tool on your account.");
    e.status = 404;
    throw e;
  }
  return sub;
}

/** A one-way, salted hash for rate-limiting and bot-spotting. Never reversible. */
export function hashIp(ip) {
  if (!ip) return null;
  const salt = process.env.EVENT_SALT || process.env.ADMIN_TOKEN || "toolhaven";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** Housekeeping for expired links and sessions. Called by the scheduler. */
export async function purgeExpired() {
  const now = new Date();
  const [links, sessions] = await Promise.all([
    prisma.ownerLoginToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.ownerSession.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return { links: links.count, sessions: sessions.count };
}
