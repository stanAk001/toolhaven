/**
 * Writing to the people who have submitted a tool.
 *
 * The shape of this screen is an argument about sending mail to strangers: you
 * see exactly who it reaches before you can send it, you are told how many of
 * them have had this message already, and the send button names the number. A
 * broadcast cannot be unsent, so the preview is not a courtesy — it is the
 * only point at which a mistake is still cheap.
 */
import { useCallback, useEffect, useState } from "react";
import { Send, Users, Check, Link2, AlertCircle } from "lucide-react";
import {
  broadcastAudiences, broadcastRecipients, broadcastHistory, sendBroadcast,
} from "../api/client.js";

const label = "block font-mono text-nano uppercase tracking-[.14em] text-ink2 mb-1.5";
const field = "w-full bg-paper border border-rule rounded-ui px-3 min-h-touch outline-none focus:border-ink transition-colors";

/** The announcement that prompted this screen, ready to send or edit. */
const PROMOTE_TEMPLATE = {
  subject: "You can now promote your tool on Toolhaven",
  message: `Your tool is listed on Toolhaven, and it stays listed for free — that hasn't changed.

What's new is that you can now pay to put it in front of more of our readers: on the homepage, on its category page, and across our discovery surfaces, for a set number of days. You pick the placements and the run length, and you see the price before you commit.

It buys placement and nothing else. It cannot change your review, your score, your rating, or where you rank in search or comparisons. Those stay ours, and paid placements are labelled wherever they appear.

If that's useful, the details are below. If not, nothing changes and your listing stays exactly as it is.`,
  linkUrl: "/promote",
  linkLabel: "See how promotion works",
};

export function BroadcastAdmin({ token }) {
  const [audiences, setAudiences] = useState([]);
  const [audience, setAudience] = useState("all");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  const [list, setList] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    broadcastAudiences(token).then((d) => setAudiences(d.audiences || [])).catch(() => {});
    broadcastHistory(token).then((d) => setHistory(d.items || [])).catch(() => {});
  }, [token]);

  const load = useCallback(() => {
    setList(null);
    broadcastRecipients(audience, subject, token).then(setList).catch(() => setList(null));
  }, [audience, subject, token]);

  // The recipient list follows the audience immediately, and the subject after
  // a pause — the subject is what decides who has had this message before.
  useEffect(() => {
    const t = setTimeout(load, subject ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, subject]);

  const site = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/+$/, "");
  const absoluteLink = linkUrl.startsWith("/") ? site + linkUrl : linkUrl;

  const useTemplate = () => {
    setSubject(PROMOTE_TEMPLATE.subject);
    setMessage(PROMOTE_TEMPLATE.message);
    setLinkUrl(PROMOTE_TEMPLATE.linkUrl);
    setLinkLabel(PROMOTE_TEMPLATE.linkLabel);
    setAudience("published");
    setDone(null); setError(""); setConfirming(false);
  };

  const send = async () => {
    setBusy("send"); setError(""); setDone(null);
    try {
      const r = await sendBroadcast({
        subject, message, audience,
        linkUrl: absoluteLink, linkLabel,
      }, token);
      setDone(r);
      setConfirming(false);
      load();
      broadcastHistory(token).then((d) => setHistory(d.items || [])).catch(() => {});
    } catch (e) {
      setError(e?.response?.data?.error || "That didn't send.");
    } finally { setBusy(""); }
  };

  const pending = list?.pending ?? 0;
  const ready = subject.trim() && message.trim() && pending > 0;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      {/* ── the message ── */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-display text-xl font-semibold tracking-tight">Write to vendors</h3>
          <button type="button" onClick={useTemplate} className="stamp-paper text-xs">
            Use the promotion announcement
          </button>
        </div>

        <div className="mb-4">
          <label htmlFor="b-aud" className={label}>Who it goes to</label>
          <select id="b-aud" value={audience} onChange={(e) => setAudience(e.target.value)} className={field}>
            {audiences.map((a) => (
              <option key={a.key} value={a.key}>{a.label} — {a.count}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="b-sub" className={label}>Subject</label>
          <input id="b-sub" value={subject} onChange={(e) => setSubject(e.target.value)}
            maxLength={140} className={field} placeholder="What this message is about" />
          <p className="font-mono text-nano text-ink2 mt-1.5">
            The subject is also the message's identity — nobody receives the same subject twice.
          </p>
        </div>

        <div className="mb-4">
          <label htmlFor="b-msg" className={label}>Message</label>
          <textarea id="b-msg" rows={11} value={message} onChange={(e) => setMessage(e.target.value)}
            maxLength={6000} className={field + " py-3 resize-y leading-relaxed"}
            placeholder={"Write it as you'd say it.\n\nA blank line starts a new paragraph."} />
          <p className="font-mono text-nano text-ink2 mt-1.5">
            Each person is greeted by their own first name. Sent one at a time — nobody sees another address.
          </p>
        </div>

        {/* ── the optional link ── */}
        <div className="border border-rule rounded-card p-4 mb-5">
          <p className="font-mono text-nano uppercase tracking-[.14em] text-ink2 mb-3 inline-flex items-center gap-1.5">
            <Link2 size={12} aria-hidden="true" /> A button, if you want one — optional
          </p>
          <div className="grid sm:grid-cols-[1fr_200px] gap-3">
            <div>
              <label htmlFor="b-url" className={label}>Where it goes</label>
              <input id="b-url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                className={field} placeholder="/promote or https://…" />
            </div>
            <div>
              <label htmlFor="b-lab" className={label}>Button text</label>
              <input id="b-lab" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)}
                maxLength={40} className={field} placeholder="Open" />
            </div>
          </div>
          {linkUrl && (
            <p className="font-mono text-nano text-ink2 mt-2 break-all">→ {absoluteLink}</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-accentDeep mb-3 inline-flex items-start gap-2">
            <AlertCircle size={14} aria-hidden="true" className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        {done && (
          <div className="border border-rule rounded-card bg-paper2/50 p-4 mb-4">
            <p className="font-display text-base font-semibold mb-1">
              Sent to {done.sent} {done.sent === 1 ? "person" : "people"}.
            </p>
            {done.skipped > 0 && (
              <p className="text-sm text-ink2">{done.skipped} had already received this one.</p>
            )}
            {done.failed?.length > 0 && (
              <p className="text-sm text-accentDeep mt-1">
                {done.failed.length} failed and can be sent again: {done.failed.map((f) => f.email).join(", ")}
              </p>
            )}
          </div>
        )}

        {/* Sending is one-way, so it takes two deliberate presses and the
            button says the number out loud rather than "Send". */}
        {!confirming ? (
          <button type="button" disabled={!ready} onClick={() => setConfirming(true)}
            className="stamp disabled:opacity-40">
            <Send size={14} aria-hidden="true" />
            {pending > 0 ? `Send to ${pending} ${pending === 1 ? "person" : "people"}` : "Nobody to send to"}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy === "send"} onClick={send}
              className="stamp disabled:opacity-60">
              {busy === "send" ? "Sending…" : `Yes — send ${pending}`}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="stamp-paper text-xs">
              Cancel
            </button>
            <span className="font-mono text-nano uppercase tracking-[.12em] text-ink2">
              This can't be unsent
            </span>
          </div>
        )}
      </div>

      {/* ── who gets it ── */}
      <aside className="w-full border border-rule rounded-card bg-surface p-4">
        <p className="font-mono text-nano uppercase tracking-[.14em] text-ink2 mb-3 inline-flex items-center gap-1.5">
          <Users size={12} aria-hidden="true" /> Recipients
        </p>

        {!list ? (
          <p className="text-sm text-ink2">Counting…</p>
        ) : (
          <>
            <p className="font-display text-3xl font-semibold tabular-nums leading-none mb-1">{list.pending}</p>
            <p className="text-sm text-ink2 mb-4">
              {list.total} in this audience
              {list.total - list.pending > 0 ? ` · ${list.total - list.pending} already had it` : ""}
            </p>

            <ul className="max-h-80 overflow-auto border-t border-rule">
              {list.items.map((r) => (
                <li key={r.email} className="flex items-start justify-between gap-2 border-b border-rule py-2">
                  <span className="min-w-0">
                    <span className="block text-sm truncate">{r.email}</span>
                    <span className="block font-mono text-nano uppercase tracking-[.1em] text-ink2 truncate">
                      {r.name || "—"}{r.tools.length > 1 ? ` · ${r.tools.length} tools` : ""}
                    </span>
                  </span>
                  {r.alreadySent && (
                    <span title="already received this message"
                      className="shrink-0 mt-0.5 text-green-700"><Check size={13} aria-hidden="true" /></span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {history.length > 0 && (
          <div className="mt-5 pt-4 border-t border-rule">
            <p className="font-mono text-nano uppercase tracking-[.14em] text-ink2 mb-2">Already sent</p>
            <ul className="space-y-1.5">
              {history.slice(0, 6).map((h) => (
                <li key={h.key} className="text-xs text-ink2 leading-snug">
                  <span className="tabular-nums">{h.sent}</span> · {h.key.replace(/^broadcast:/, "").replace(/-/g, " ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
