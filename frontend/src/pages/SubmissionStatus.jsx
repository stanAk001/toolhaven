/**
 * The submitter's view of their own submission.
 *
 * Reached by an unguessable token in the URL — Toolhaven has no accounts, so
 * that link is the credential, and it goes out in the receipt email and on the
 * success screen. Nothing here is behind a login because there is nothing to
 * log into.
 *
 * The job of this page is to answer one question — what is happening to my
 * submission — before any other consideration. So the status is the headline,
 * the reviewer's message is next when there is one, and the history is at the
 * bottom for anyone who wants it.
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { trackSubmission, updateSubmission_public } from "../api/client.js";
import { PageHead } from "../components/editorial.jsx";
import { Seo } from "../lib/seo.jsx";

/**
 * How each state is presented.
 *
 * `what` is written in the second person and says what happens next rather than
 * restating the label — "under review" tells someone nothing they cannot read
 * from the chip above it.
 */
const STATE = {
  pending: {
    label: "Pending review",
    tone: "border-ink text-ink",
    what: "It's in the queue. A person reads every submission, so this can take a few days.",
  },
  under_review: {
    label: "Under review",
    tone: "border-accentDeep text-accentDeep",
    what: "Someone is using the tool properly rather than reading the marketing page. That's the slow part.",
  },
  approved: {
    label: "Approved",
    tone: "border-green-700 text-green-700",
    what: "It's going in. The write-up still has to be finished, and you'll get an email the moment it's live.",
  },
  published: {
    label: "Live",
    tone: "border-green-700 text-green-700",
    what: "It's on the site.",
  },
  changes_requested: {
    label: "Changes needed",
    tone: "border-accent text-accentDeep",
    what: "There's something to sort out before this can go further. The note below is from the reviewer.",
  },
  declined: {
    label: "Not accepted",
    tone: "border-ink/40 text-ink2",
    what: "We aren't listing this one. More often than not that means it sits outside what Toolhaven covers.",
  },
};

const EVENT_LABEL = {
  created: "Submitted",
  "status-changed": "Status changed",
  resubmitted: "Updated and resubmitted",
  "note-added": "Reviewer notes updated",
  published: "Published",
};

const when = (iso) => (iso
  ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  : null);
const whenExact = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");

export default function SubmissionStatus() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await trackSubmission(token)); }
    catch (e) { setError(e?.response?.data?.error || "We couldn't find that submission."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="max-w-2xl mx-auto px-5 sm:px-6 py-16 text-ink2">Loading…</div>;
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-5 sm:px-6 py-14 sm:py-20 fade-in">
        <PageHead kicker="Submission" title="We can't find that one">
          {error}
        </PageHead>
        <p className="text-ink2 text-pretty mb-7 max-w-measure">
          The link may have been mistyped, or the submission may have been removed. If you still have the
          confirmation email, the link in it is the one that works.
        </p>
        <Link to="/submit" className="stamp">Submit a tool →</Link>
      </div>
    );
  }

  const s = data.submission;
  const state = STATE[s.status] || STATE.pending;
  const timeline = [...(data.timeline || [])].reverse();

  return (
    <div className="max-w-2xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      {/* A private page with a secret in the URL has no business in an index. */}
      <Seo title={`${s.toolName} — submission status`} noIndex path={`/submission/${token}`} />

      <PageHead kicker="Your submission" title={s.toolName}>
        Submitted {when(s.submittedAt)}
        {s.resubmitCount > 0 ? ` · revision ${s.resubmitCount}` : ""}
      </PageHead>

      {/* status */}
      <div className="border border-rule rounded-card bg-paper p-5 sm:p-6 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className={`inline-flex items-center font-mono text-label uppercase tracking-[.14em] px-3 py-1.5 rounded-ui border ${state.tone}`}>
            {state.label}
          </span>
          <span className="font-mono text-nano uppercase tracking-[.12em] text-ink2">
            Updated {when(s.lastStatusChange)}
          </span>
        </div>
        <p className="text-base leading-relaxed text-pretty">{state.what}</p>

        {s.status === "published" && s.toolSlug && (
          <Link to={`/tools/${s.toolSlug}`} className="stamp mt-5">
            View the listing <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* the reviewer's message, when there is one */}
      {s.message && (
        <div className="border-l-4 border-accent pl-5 py-1 mb-6">
          <p className="font-mono text-label uppercase tracking-[.16em] text-accentDeep mb-2">From the reviewer</p>
          <p className="text-base leading-relaxed whitespace-pre-line text-pretty">{s.message}</p>
        </div>
      )}

      {s.editable && <ResubmitPanel token={token} submission={s} onDone={load} />}

      {/* history */}
      {timeline.length > 0 && (
        <section className="mt-9">
          <h2 className="font-mono text-label uppercase tracking-[.16em] text-ink2 mb-4">History</h2>
          <ol className="border-t border-rule">
            {timeline.map((e, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 border-b border-rule">
                <span className="font-mono text-nano uppercase tracking-[.12em] text-ink2 tabular-nums w-40 shrink-0">
                  {whenExact(e.at)}
                </span>
                <span className="text-sm">
                  {EVENT_LABEL[e.type] || e.type}
                  {e.to && e.from ? (
                    <span className="text-ink2"> — {STATE[e.from]?.label || e.from} → {STATE[e.to]?.label || e.to}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mt-8">
        Keep this link — it stays current as the status changes.
      </p>
    </div>
  );
}

/**
 * Update and resubmit.
 *
 * Only the fields most likely to be what a reviewer asked about. Editing the
 * whole submission again would invite a rewrite when the ask is usually one
 * dead link or one unclear sentence — and it updates the original rather than
 * creating a second submission, so the history stays in one place.
 */
function ResubmitPanel({ token, submission, onDone }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    toolName: submission.toolName || "",
    websiteUrl: submission.websiteUrl || "",
    pitch: submission.pitch || "",
    description: submission.description || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const field = "w-full border border-rule rounded-ui bg-paper px-3 py-2.5 outline-none focus:border-accent transition-colors";
  const lab = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try { await updateSubmission_public(token, f); await onDone(); setOpen(false); }
    catch (err) { setError(err?.response?.data?.error || "That didn't save. Try again in a moment."); }
    finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="stamp">
        Update your submission →
      </button>
    );
  }

  return (
    <form onSubmit={save} className="border border-rule rounded-card bg-paper p-5 space-y-4">
      <p className="font-mono text-label uppercase tracking-[.16em] text-accentDeep">Update and resubmit</p>
      <div>
        <label htmlFor="r-name" className={lab}>Tool name</label>
        <input id="r-name" className={field} value={f.toolName} onChange={set("toolName")} />
      </div>
      <div>
        <label htmlFor="r-url" className={lab}>Website</label>
        <input id="r-url" className={field} value={f.websiteUrl} onChange={set("websiteUrl")} />
      </div>
      <div>
        <label htmlFor="r-pitch" className={lab}>One-line pitch</label>
        <input id="r-pitch" className={field} value={f.pitch} onChange={set("pitch")} maxLength={280} />
      </div>
      <div>
        <label htmlFor="r-desc" className={lab}>What it is</label>
        <textarea id="r-desc" rows={3} className={field + " resize-y"} value={f.description} onChange={set("description")} />
      </div>

      {error && <p className="font-mono text-sm text-accentDeep">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="stamp text-xs disabled:opacity-60">
          {busy ? <><RefreshCw size={13} className="animate-spin" aria-hidden="true" /> Sending…</> : "Resubmit for review"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="font-mono text-label uppercase tracking-wide text-ink2 hover:text-ink transition-colors">
          Cancel
        </button>
      </div>
      <p className="font-mono text-nano text-ink2/80">
        This updates your original submission rather than creating a second one.
      </p>
    </form>
  );
}
