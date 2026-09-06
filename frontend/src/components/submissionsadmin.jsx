/**
 * The submissions desk.
 *
 * Built around the decision rather than the record. A queue is only worth
 * having if the next thing to look at is obvious, so the filters lead with what
 * is waiting on you, and opening a submission puts everything needed to judge
 * it — and the three things you can do about it — on one screen.
 *
 * The decision form makes one thing structurally impossible: requesting changes
 * or declining without writing a message. Both of those states send an email
 * whose entire content is that message, and an empty one leaves the person on
 * the other end with a status change and no idea what to do about it.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, ExternalLink, Check, X, MessageSquare, Clock, ChevronLeft } from "lucide-react";
import { listSubmissions, getSubmission, reviewSubmission } from "../api/client.js";

const field = "w-full border border-rule rounded-ui bg-paper px-3 py-2.5 outline-none focus:border-accent transition-colors";
const label = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";

const STATE = {
  pending: { label: "Pending", tone: "border-ink text-ink" },
  under_review: { label: "Under review", tone: "border-accentDeep text-accentDeep" },
  approved: { label: "Approved", tone: "border-green-700 text-green-700" },
  published: { label: "Live", tone: "border-green-700 text-green-700 bg-green-700/10" },
  changes_requested: { label: "Changes asked", tone: "border-accent text-accentDeep" },
  declined: { label: "Declined", tone: "border-ink/40 text-ink2" },
};

const when = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const whenExact = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");

function Chip({ status }) {
  const s = STATE[status] || STATE.pending;
  return (
    <span className={`inline-flex items-center font-mono text-nano uppercase tracking-[.12em] px-2.5 py-1 rounded-ui border whitespace-nowrap ${s.tone}`}>
      {s.label}
    </span>
  );
}

export function SubmissionsAdmin({ token }) {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState("waiting");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const d = await listSubmissions(token);
      setItems(d.items || []);
      setCounts(d.counts || {});
    } catch (e) {
      setError(e?.response?.data?.error || "Couldn't load the queue.");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((s) => {
      if (term && !(`${s.toolName} ${s.contactName} ${s.email} ${s.category || ""}`).toLowerCase().includes(term)) return false;
      // "Waiting" is the only filter most days: everything that needs a person.
      if (filter === "waiting") return s.status === "pending" || s.status === "under_review";
      if (filter === "all") return true;
      return s.status === filter;
    });
  }, [items, q, filter]);

  const waiting = (counts.pending || 0) + (counts.under_review || 0);
  const TABS = [
    ["waiting", "Waiting on you", waiting],
    ["approved", "Approved", counts.approved || 0],
    ["published", "Live", counts.published || 0],
    ["changes_requested", "Changes asked", counts.changes_requested || 0],
    ["declined", "Declined", counts.declined || 0],
    ["all", "Everything", items.length],
  ];

  if (openId) {
    return <ReviewPanel id={openId} token={token} onBack={() => { setOpenId(null); load(); }} />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {TABS.map(([key, text, n]) => (
          <button key={key} type="button" onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide border border-rule rounded-ui px-4 transition-colors ${filter === key ? "bg-ink text-paper" : "bg-paper hover:bg-paper2"}`}>
            {text}<span className="tabular-nums opacity-60">{n}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 border border-rule rounded-ui px-4 mb-5 bg-paper">
        <Search size={16} strokeWidth={2.5} aria-hidden="true" className="text-accentDeep shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by tool, person or email…"
          aria-label="Search submissions" className="flex-1 min-w-0 bg-transparent outline-none min-h-touch" />
        <span className="font-mono text-label text-ink2 shrink-0 tabular-nums">{shown.length}</span>
      </div>

      {error && <p className="font-mono text-sm text-accentDeep mb-4">{error}</p>}
      {loading && <p className="text-ink2">Loading…</p>}

      {!loading && shown.length === 0 && (
        <div className="border border-dashed border-rule rounded-card px-6 py-12 text-center">
          <p className="font-display text-xl font-semibold mb-1">
            {filter === "waiting" ? "Nothing waiting on you." : "Nothing here."}
          </p>
          <p className="text-ink2 text-pretty">
            {filter === "waiting"
              ? "Every submission has been through a decision."
              : "Try another filter, or clear the search."}
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {shown.map((s) => (
          <button key={s.id} type="button" onClick={() => setOpenId(s.id)}
            className="w-full text-left border border-rule rounded-card bg-paper p-4 hover:bg-paper2/50 transition-colors">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h3 className="font-display text-lg font-semibold leading-tight">{s.toolName}</h3>
              <Chip status={s.status} />
              {s.resubmitCount > 0 && (
                <span className="font-mono text-nano uppercase tracking-[.12em] text-ink2">
                  revision {s.resubmitCount}
                </span>
              )}
              <span className="ml-auto font-mono text-nano uppercase tracking-[.12em] text-ink2 tabular-nums">
                {when(s.submittedAt || s.createdAt)}
              </span>
            </div>
            <p className="font-mono text-nano uppercase tracking-[.1em] text-ink2 mt-1.5">
              {s.contactName} · {s.email}{s.category ? ` · ${s.category}` : ""}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── the review panel ────────────────────────────────────────────────────── */

// Mirrors the server's state machine. The server is still the authority —
// this only stops the desk offering a move it is about to refuse.
const ALLOWED_FROM = {
  pending: ["under_review", "approved", "changes_requested", "declined"],
  under_review: ["approved", "changes_requested", "declined", "pending"],
  approved: ["published", "changes_requested", "declined", "under_review"],
  published: ["under_review", "declined"],
  changes_requested: ["pending", "under_review", "declined"],
  declined: ["under_review", "pending"],
};

const DECISIONS = [
  { key: "under_review", label: "Start reviewing", icon: Clock,
    blurb: "Tells them someone has picked it up. No message needed." },
  { key: "approved", label: "Approve", icon: Check,
    blurb: "It's going in. Doesn't publish it — that's a separate step." },
  { key: "changes_requested", label: "Ask for changes", icon: MessageSquare,
    blurb: "Your message is the whole email they get, so it has to say what to fix.", needsMessage: true },
  { key: "declined", label: "Decline", icon: X,
    blurb: "Your reason goes to them verbatim.", needsMessage: true },
  { key: "published", label: "Publish", icon: Check,
    blurb: "Marks it live and emails them the link. Approve it first." },
];

function ReviewPanel({ id, token, onBack }) {
  const [data, setData] = useState(null);
  const [decision, setDecision] = useState(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await getSubmission(id, token);
      setData(d.submission);
      setNote(d.submission.reviewerNote || "");
    } catch (e) { setError(e?.response?.data?.error || "Couldn't load that submission."); }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!decision) return;
    setBusy(true); setError(""); setDone("");
    try {
      const res = await reviewSubmission(id, {
        status: decision,
        submitterMessage: message || undefined,
        reviewerNote: note,
      }, token);
      setDecision(null); setMessage("");
      // Report what actually happened to the email rather than implying one went.
      setDone(res?.email?.ok ? "Saved, and they've been emailed."
        : res?.email?.skipped ? `Saved. No email sent — ${res.email.skipped}.`
          : "Saved, but the email didn't go through. Check the mail settings.");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || "That didn't save.");
    } finally { setBusy(false); }
  };

  const back = (
    <button onClick={onBack}
      className="inline-flex items-center gap-1.5 min-h-touch font-mono text-label uppercase tracking-wide text-ink2 hover:text-ink mb-5">
      <ChevronLeft size={14} aria-hidden="true" /> Back to the queue
    </button>
  );

  if (!data) {
    return <div>{back}{error
      ? <p className="font-mono text-sm text-accentDeep">{error}</p>
      : <p className="text-ink2">Loading…</p>}</div>;
  }

  const chosen = DECISIONS.find((d) => d.key === decision);
  const apiOrigin = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");
  const logo = data.logoUpload ? `${apiOrigin}/api/uploads/${data.logoUpload.id}` : data.logoUrl;

  return (
    <div>
      {back}
      {/* items-start, or a short submission stretches its card to match the
          decision column beside it and leaves a tall empty box. */}
      <div className="grid lg:grid-cols-[1fr_20rem] gap-6 items-start">
        {/* what was submitted */}
        <div className="border border-rule rounded-card bg-paper p-5 sm:p-6">
          <div className="flex items-start gap-4 mb-5">
            {logo && (
              <span className="grid place-items-center w-14 h-14 shrink-0 rounded-ui border border-rule overflow-hidden bg-paper2/40">
                <img src={logo} alt="" className="w-full h-full object-contain p-1.5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-semibold leading-tight">{data.toolName}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Chip status={data.status} />
                {data.resubmitCount > 0 && (
                  <span className="font-mono text-nano uppercase tracking-[.12em] text-ink2">revision {data.resubmitCount}</span>
                )}
              </div>
            </div>
          </div>

          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mb-5">
            {[
              ["Website", data.websiteUrl, data.websiteUrl],
              ["Category", data.category],
              ["Pricing", data.pricing],
              ["Affiliate", data.affiliateProgram],
              ["Submitted by", data.contactName],
              ["Email", data.email, "mailto:" + data.email],
              ["Company", data.companyName],
              ["Submitted", when(data.submittedAt || data.createdAt)],
            ].filter(([, v]) => v).map(([k, v, href]) => (
              <div key={k}>
                <dt className="font-mono text-nano uppercase tracking-[.12em] text-ink2">{k}</dt>
                <dd className="text-sm mt-0.5 break-words">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      className="text-accentDeep underline underline-offset-2 inline-flex items-center gap-1">
                      {v} <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  ) : v}
                </dd>
              </div>
            ))}
          </dl>

          {data.pitch && (
            <div className="border-l-4 border-rule pl-4 mb-4">
              <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-1">The pitch</p>
              <p className="text-base text-ink2 text-pretty">{data.pitch}</p>
            </div>
          )}
          {data.description && <p className="text-sm text-ink2 leading-relaxed mb-4 text-pretty">{data.description}</p>}
          {data.details && <p className="text-sm text-ink2 leading-relaxed mb-4 whitespace-pre-line text-pretty">{data.details}</p>}

          {[["Features", data.features], ["Use cases", data.useCases], ["Links", data.socialLinks]]
            .filter(([, arr]) => arr?.length).map(([title, arr]) => (
              <div key={title} className="mb-4">
                <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-1.5">{title}</p>
                <ul className="text-sm space-y-1">
                  {arr.map((x, i) => <li key={i} className="break-words">{x}</li>)}
                </ul>
              </div>
            ))}
        </div>

        {/* the decision */}
        <div className="space-y-5">
          <div className="border border-rule rounded-card bg-paper p-5">
            <p className="font-mono text-label uppercase tracking-[.16em] text-accentDeep mb-3">Decision</p>

            {/* Only moves that would actually do something.
                Offering "Start reviewing" on a submission already under review
                produced a save that changed nothing and reported "no email sent
                — no status change", which reads as a broken feature rather than
                as the no-op it was. */}
            <div className="space-y-2 mb-4">
              {DECISIONS.map((d) => {
                const isCurrent = d.key === data.status;
                const allowed = !isCurrent && ALLOWED_FROM[data.status]?.includes(d.key);
                return (
                  <label key={d.key}
                    className={`flex gap-3 p-3 rounded-ui border transition-colors
                      ${!allowed ? "border-rule opacity-45 cursor-not-allowed"
                        : decision === d.key ? "border-ink bg-paper2/60 cursor-pointer"
                          : "border-rule hover:border-ink/50 cursor-pointer"}`}>
                    <input type="radio" name="decision" value={d.key} checked={decision === d.key}
                      disabled={!allowed}
                      onChange={() => { setDecision(d.key); setError(""); setDone(""); }}
                      className="mt-1 w-4 h-4 shrink-0 accent-current" />
                    <span className="min-w-0">
                      <span className="block font-mono text-label uppercase tracking-wide">
                        {d.label}
                        {isCurrent && <span className="ml-2 text-ink2 normal-case tracking-normal">— already here</span>}
                      </span>
                      <span className="block text-xs text-ink2 leading-snug mt-0.5 text-pretty">
                        {isCurrent ? "This is its current status." : allowed ? d.blurb : `Not available from “${STATE[data.status]?.label || data.status}”.`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {chosen?.needsMessage && (
              <div className="mb-4">
                <label htmlFor="rp-msg" className={label}>Message to them &middot; required</label>
                <textarea id="rp-msg" rows={4} className={field + " resize-y"} value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={decision === "declined"
                    ? "It sits outside what we cover, rather than anything being wrong with it."
                    : "The pricing page 404s. Could you check the link and resubmit?"} />
                <p className="font-mono text-nano text-ink2/80 mt-1 text-pretty">
                  This is the entire email they receive. Write it to them, not about them.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="rp-note" className={label}>Internal note</label>
              <textarea id="rp-note" rows={2} className={field + " resize-y"} value={note}
                onChange={(e) => setNote(e.target.value)} placeholder="Only you see this." />
            </div>

            {error && <p className="font-mono text-sm text-accentDeep mb-3 text-pretty">{error}</p>}
            {done && <p className="font-mono text-sm text-green-700 mb-3 text-pretty">{done}</p>}

            <button onClick={save} disabled={!decision || busy || (chosen?.needsMessage && !message.trim())}
              className="stamp w-full justify-center text-xs disabled:opacity-50">
              {busy ? "Saving…" : "Save decision"}
            </button>
            <p className="font-mono text-nano text-ink2/80 mt-2 text-center text-pretty">
              The status is written first. They are only emailed once it has saved.
            </p>
          </div>

          {data.emailEvents?.length > 0 && (
            <div className="border border-rule rounded-card p-4">
              <p className="font-mono text-nano uppercase tracking-[.14em] text-ink2 mb-2">Emails sent</p>
              <ul className="space-y-1.5 font-mono text-nano text-ink2">
                {data.emailEvents.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3">
                    <span className={e.status === "sent" ? "" : "text-accentDeep"}>{e.eventType}</span>
                    <span className="opacity-70 tabular-nums">{when(e.sentAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.events?.length > 0 && (
            <div className="border border-rule rounded-card p-4">
              <p className="font-mono text-nano uppercase tracking-[.14em] text-ink2 mb-2">History</p>
              <ul className="space-y-2 font-mono text-nano text-ink2">
                {data.events.slice(0, 8).map((e) => (
                  <li key={e.id}>
                    <span className="text-ink">{e.type}</span>
                    {e.fromStatus && e.toStatus ? " · " + e.fromStatus + " → " + e.toStatus : ""}
                    <span className="block opacity-70 tabular-nums">{whenExact(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
