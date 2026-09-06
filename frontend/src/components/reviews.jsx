import { useState } from "react";
import { Star, ThumbsUp } from "lucide-react";
import { createReview, voteHelpful } from "../api/client.js";
import { Stars } from "./ui.jsx";
import { Reveal } from "./motion.jsx";

// remember which reviews this browser has already found helpful, so the vote is
// one-per-person-ish without needing accounts
const VOTED = "toolhaven-voted";
const readVoted = () => { try { return JSON.parse(localStorage.getItem(VOTED) || "[]"); } catch { return []; } };
const hasVoted = (id) => readVoted().includes(id);
const markVoted = (id) => { try { const a = readVoted(); if (!a.includes(id)) { a.push(id); localStorage.setItem(VOTED, JSON.stringify(a)); } } catch { /* ignore */ } };

function StarInput({ value, onChange }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)} className="p-0.5 transition-transform hover:scale-110">
          <Star size={26} strokeWidth={0} fill={n <= value ? "#C8841E" : "rgb(var(--ink) / .18)"} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

const EMPTY = { authorName: "", rating: 5, title: "", useCase: "", content: "", website: "" };

export function ReviewsSection({ toolId, color = "#0E1116", initial = [] }) {
  const [reviews, setReviews] = useState(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState(null); // null | sending | sent | error
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const vote = async (id) => {
    if (hasVoted(id)) return;
    markVoted(id);
    setReviews((rs) => rs.map((r) => (r.id === id ? { ...r, helpful: (r.helpful || 0) + 1 } : r)));
    try { await voteHelpful(id); } catch { /* keep the optimistic bump */ }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.content.trim().length < 12) { setError("Please write at least a sentence."); setStatus("error"); return; }
    setStatus("sending"); setError("");
    try { await createReview({ ...form, toolId }); setStatus("sent"); setForm(EMPTY); }
    catch (err) { setError(err?.response?.data?.error || "Couldn't post that — try again."); setStatus("error"); }
  };

  const field = "w-full border border-rule rounded-card bg-paper px-4 py-3 outline-none focus:border-accent transition-colors";
  const lab = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="font-mono text-xs uppercase tracking-[.14em] text-ink2">
          Reader reviews{reviews.length > 0 ? ` · ${reviews.length}` : ""}
        </h2>
        <button onClick={() => setOpen((o) => !o)}
          className="font-mono text-label uppercase tracking-wide border border-rule rounded-ui px-3 py-1.5 hover:bg-paper2 transition-colors">
          {open ? "Close" : "Write a review"}
        </button>
      </div>

      {open && status !== "sent" && (
        <Reveal as="form" onSubmit={submit} noValidate
          className="border border-rule rounded-card bg-paper p-5 mb-6 space-y-4" >
          {/* honeypot */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} className="hidden" aria-hidden="true" />
          <div>
            <span className={lab}>Your rating</span>
            <StarInput value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={lab}>Name (optional)</label><input className={field} placeholder="e.g. Jane" value={form.authorName} onChange={set("authorName")} /></div>
            <div><label className={lab}>How you use it (optional)</label><input className={field} placeholder="e.g. Daily standups" value={form.useCase} onChange={set("useCase")} /></div>
          </div>
          <div><label className={lab}>Headline (optional)</label><input className={field} placeholder="Sum it up in a few words" value={form.title} onChange={set("title")} /></div>
          <div><label className={lab}>Your review *</label>
            <textarea className={`${field} min-h-[110px] resize-y`} placeholder="What's genuinely good, and what's the catch? Honesty helps everyone." value={form.content} onChange={set("content")} />
          </div>
          <button type="submit" disabled={status === "sending"} className="stamp disabled:opacity-60">{status === "sending" ? "Posting…" : "Post review →"}</button>
          {status === "error" && <p className="font-mono text-sm text-accentDeep">{error}</p>}
        </Reveal>
      )}

      {status === "sent" && (
        <div className="border border-rule rounded-card bg-paper2/50 p-5 mb-6">
          <p className="font-display text-lg font-semibold mb-1">Thanks — your review is in.</p>
          <p className="text-ink2 text-sm">We read every review before it goes live (it keeps the fakes out). It'll appear here once approved.</p>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-ink2">No reader reviews yet — be the first to share an honest take.</p>
      ) : (
        <div className="space-y-5">
          {reviews.map((r) => (
            <div key={r.id} className="border-b border-rule pb-5 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-3 mb-1">
                <Stars r={r.rating} size={15} showNum={false} />
                <span className="font-mono text-label text-ink2">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              {r.title && <h3 className="font-display text-lg font-semibold leading-tight">{r.title}</h3>}
              <p className="mt-1 leading-relaxed whitespace-pre-wrap">{r.content}</p>
              <div className="flex items-center justify-between gap-3 mt-3 font-mono text-label uppercase tracking-wide text-ink2">
                <span className="truncate">{r.authorName || "Anonymous"}{r.useCase ? ` · ${r.useCase}` : ""}</span>
                <button onClick={() => vote(r.id)} disabled={hasVoted(r.id)}
                  className="inline-flex items-center gap-1.5 shrink-0 hover:text-accentDeep disabled:opacity-50">
                  <ThumbsUp size={13} aria-hidden="true" /> Helpful{r.helpful ? ` · ${r.helpful}` : ""}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
