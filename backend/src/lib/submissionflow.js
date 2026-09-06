/**
 * The submission state machine.
 *
 * Two rules hold this together, and both exist because getting them wrong
 * produces the same failure: telling someone something that isn't true.
 *
 *  1. The status change commits before the email is even composed. If the
 *     write fails, nobody is told their tool is live. The email is a
 *     description of what happened, never the thing that makes it happen.
 *
 *  2. Approved and published are different states. Approving is a judgement;
 *     publishing is an act. A tool can be approved for days while its entry is
 *     written, and "your tool is live" must not go out during that time.
 */

export const STATUSES = [
  "pending", "under_review", "approved", "published", "changes_requested", "declined",
];

/** What may follow what. Anything not listed here is refused. */
const NEXT = {
  pending: ["under_review", "approved", "changes_requested", "declined"],
  under_review: ["approved", "changes_requested", "declined", "pending"],
  approved: ["published", "changes_requested", "declined", "under_review"],
  published: ["under_review", "declined"],
  changes_requested: ["pending", "under_review", "declined"],
  declined: ["under_review", "pending"],
};

export const LABELS = {
  pending: "Pending review",
  under_review: "Under review",
  approved: "Approved",
  published: "Published",
  changes_requested: "Changes requested",
  declined: "Declined",
};

export const canMove = (from, to) => (NEXT[from] || []).includes(to);

/** Why a particular move is refused, in words an editor can act on. */
export function refusal(from, to) {
  if (!STATUSES.includes(to)) return `"${to}" is not a status.`;
  if (from === to) return `It is already ${LABELS[to].toLowerCase()}.`;
  if (to === "published" && from !== "approved") {
    return "A submission has to be approved before it can be published.";
  }
  return `A ${LABELS[from].toLowerCase()} submission cannot move straight to ${LABELS[to].toLowerCase()}.`;
}

/** The timestamp column a transition stamps, if any. */
export const stampFor = (to) => ({
  under_review: "reviewStartedAt",
  approved: "approvedAt",
  published: "publishedAt",
  declined: "declinedAt",
  changes_requested: "changesRequestedAt",
}[to] || null);

/** Statuses a submitter is allowed to edit their submission from. */
export const isEditable = (status) => status === "changes_requested" || status === "pending";
