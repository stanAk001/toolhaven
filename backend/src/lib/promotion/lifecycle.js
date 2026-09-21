/**
 * The life of a campaign.
 *
 * Modelled the same way as the submission workflow: statuses are strings with
 * an explicit table of legal moves, rather than a boolean somebody flips. A
 * campaign is not "boosted = true" — it is bought, paid for, reviewed,
 * scheduled, run and finished, and every one of those is a state a person or a
 * job can be answerable for.
 *
 * The rule that matters most: nothing reaches ACTIVE without a verified
 * payment and an editor's approval. Both are checked against the database, so
 * neither a browser nor a provider redirect can talk a campaign into going
 * live on its own.
 */

export const STATUS = {
  DRAFT: "DRAFT",
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  SCHEDULED: "SCHEDULED",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  EXPIRED: "EXPIRED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  REFUND_PENDING: "REFUND_PENDING",
  REFUNDED: "REFUNDED",
};

export const STATUSES = Object.values(STATUS);

/** Where each status may legally go next. Anything not listed is refused. */
const MOVES = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  // Payment is confirmed by our own verification call, never by a redirect.
  PENDING_PAYMENT: ["PAYMENT_RECEIVED", "CANCELLED"],
  PAYMENT_RECEIVED: ["PENDING_REVIEW", "REFUND_PENDING"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["SCHEDULED", "ACTIVE", "CANCELLED"],
  SCHEDULED: ["ACTIVE", "CANCELLED", "PAUSED"],
  ACTIVE: ["PAUSED", "COMPLETED", "EXPIRED", "CANCELLED"],
  PAUSED: ["ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"],
  COMPLETED: [],
  EXPIRED: [],
  // A campaign that never ran can be refunded; one that did is a support matter.
  REJECTED: ["REFUND_PENDING"],
  CANCELLED: ["REFUND_PENDING"],
  REFUND_PENDING: ["REFUNDED", "APPROVED"],
  REFUNDED: [],
};

export function canMove(from, to) {
  if (!STATUSES.includes(to)) return false;
  return (MOVES[from] || []).includes(to);
}

/** Why a move was refused, in words an editor can act on. */
export function refusal(from, to) {
  if (!STATUSES.includes(to)) return `"${to}" is not a campaign status.`;
  if (from === to) return `This campaign is already ${to.toLowerCase().replace(/_/g, " ")}.`;
  const allowed = MOVES[from] || [];
  if (!allowed.length) return `A ${from.toLowerCase().replace(/_/g, " ")} campaign is finished and cannot change.`;
  return `A ${from.toLowerCase().replace(/_/g, " ")} campaign can only become: ${allowed.join(", ")}.`;
}

/** Statuses whose campaigns may be rendered on a promotional surface. */
export const LIVE_STATUSES = [STATUS.ACTIVE];

/** Statuses the vendor should still consider "in flight" on their dashboard. */
export const OPEN_STATUSES = [
  STATUS.PENDING_PAYMENT, STATUS.PAYMENT_RECEIVED, STATUS.PENDING_REVIEW,
  STATUS.APPROVED, STATUS.SCHEDULED, STATUS.ACTIVE, STATUS.PAUSED,
];

/**
 * The filter every promotional surface uses.
 *
 * Expiry is decided by this clause, not only by the scheduler. If the job is
 * late, stopped or has never run, an ended campaign still cannot be rendered —
 * a paid placement outstaying its window is a refund and a broken promise, so
 * it is guarded in the query as well as in the job.
 */
export function liveWhere(now = new Date()) {
  return {
    status: STATUS.ACTIVE,
    startDate: { lte: now },
    endDate: { gt: now },
  };
}

/** Is this tool in a state where its owner may promote it at all? */
export function toolIsPromotable(submission) {
  return Boolean(submission)
    && submission.status === "published"
    && Boolean(submission.publishedToolId);
}

/** The sentence shown when it is not. */
export const NOT_PROMOTABLE =
  "Your tool needs to be approved before you can promote it.";
