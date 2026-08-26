import { useState, useEffect, useCallback } from "react";
import {
  listSubmissions, updateSubmission, deleteSubmission,
  listPendingReviews, moderateReview, deleteReview,
  listPendingStacks, moderateStack, deleteStack,
} from "../api/client.js";
import { Link } from "react-router-dom";
import { PageHead } from "../components/editorial.jsx";
import { Stars } from "../components/ui.jsx";
import { BestAdmin } from "../components/bestadmin.jsx";
import { ToolsAdmin, ClicksAdmin } from "../components/toolsadmin.jsx";
import { PricingAdmin } from "../components/pricingadmin.jsx";
import { Seo } from "../lib/seo.jsx";

// The editor's desk — private, token-gated. Two views: tool submissions and
// pending reader reviews (the moderation queue that keeps fake reviews out).
const STATUSES = ["pending", "reviewing", "listed", "declined"];
const STATUS_COLOR = { pending: "#6A5F52", reviewing: "#1D4ED8", listed: "#15803D", declined: "#B83617" };
const KEY = "toolhaven-admin";

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem(KEY) || "");
  const [input, setInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState("submissions");
  const [items, setItems] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [stacks, setStacks] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (tk) => {
    setLoading(true); setError("");
    try {
      const [subs, revs, stks] = await Promise.all([listSubmissions(tk), listPendingReviews(tk), listPendingStacks(tk)]);
      setItems(subs.items || []);
      setReviews(revs.items || []);
      setStacks(stks.items || []);
      setAuthed(true); setToken(tk); localStorage.setItem(KEY, tk);
    } catch (e) {
      setAuthed(false);
      setError(e?.response?.status === 401 ? "That token doesn't match." : "Couldn't reach the server.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (token) load(token); /* eslint-disable-next-line */ }, []);

  // submissions
  const setSubStatus = async (id, status) => {
    const prev = items;
    setItems(items.map((i) => (i.id === id ? { ...i, status } : i)));
    try { await updateSubmission(id, status, token); } catch { setItems(prev); setError("Update failed."); }
  };
  const removeSub = async (id) => {
    if (!window.confirm("Delete this submission permanently?")) return;
    const prev = items;
    setItems(items.filter((i) => i.id !== id));
    try { await deleteSubmission(id, token); } catch { setItems(prev); setError("Delete failed."); }
  };

  // reviews
  const approveReview = async (id) => {
    const prev = reviews;
    setReviews(reviews.filter((r) => r.id !== id));
    try { await moderateReview(id, "approved", token); } catch { setReviews(prev); setError("Approve failed."); }
  };
  const rejectReview = async (id) => {
    if (!window.confirm("Reject and delete this review?")) return;
    const prev = reviews;
    setReviews(reviews.filter((r) => r.id !== id));
    try { await deleteReview(id, token); } catch { setReviews(prev); setError("Delete failed."); }
  };

  // stacks
  const approveStack = async (id) => {
    const prev = stacks;
    setStacks(stacks.filter((s) => s.id !== id));
    try { await moderateStack(id, "approved", token); } catch { setStacks(prev); setError("Approve failed."); }
  };
  const rejectStack = async (id) => {
    if (!window.confirm("Reject and delete this stack?")) return;
    const prev = stacks;
    setStacks(stacks.filter((s) => s.id !== id));
    try { await deleteStack(id, token); } catch { setStacks(prev); setError("Delete failed."); }
  };

  const lock = () => { localStorage.removeItem(KEY); setToken(""); setAuthed(false); setItems([]); setReviews([]); setStacks([]); setInput(""); };

  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-5 sm:px-6 py-16 sm:py-24 fade-in">
      <Seo title="Editor's desk" description="Private." path="/admin" noIndex />
        <PageHead kicker="Private" title="Editor's desk" />
        <p className="text-ink2 mb-5">Enter the admin token to manage submissions and reviews.</p>
        <form onSubmit={(e) => { e.preventDefault(); load(input.trim()); }} className="flex gap-2">
          <input type="password" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Admin token" autoFocus
            className="flex-1 border-2 border-ink rounded-card bg-paper px-4 py-3 outline-none focus:border-accent" />
          <button type="submit" disabled={loading} className="stamp disabled:opacity-60">{loading ? "…" : "Enter"}</button>
        </form>
        {error && <p className="font-mono text-sm text-accentDeep mt-3">{error}</p>}
      </div>
    );
  }

  const shown = filter === "all" ? items : items.filter((s) => s.status === filter);
  const count = (st) => items.filter((s) => s.status === st).length;

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-6 py-10 sm:py-12 fade-in">
      {/* the signed-in view needs the noindex too — it renders instead of the
          token screen, so without it this branch falls back to the site default */}
      <Seo title="Editor's desk" description="Private." path="/admin" noIndex />
      <PageHead kicker="Editor's desk" title="Moderation" />

      {/* view switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-2">
          {[["submissions", `Submissions · ${items.length}`], ["reviews", `Reviews · ${reviews.length}`], ["stacks", `Stacks · ${stacks.length}`], ["best", "Best-of"], ["tools", "Tools"], ["pricing", "Pricing"], ["clicks", "Clicks"]].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`font-mono text-label uppercase tracking-wide px-3.5 py-2 rounded-ui border-2 border-ink transition-colors ${view === v ? "bg-ink text-paper" : "bg-paper hover:bg-paper2"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-4">
          <button onClick={() => load(token)} className="font-mono text-xs uppercase tracking-wide hover:text-accentDeep">Refresh</button>
          <button onClick={lock} className="font-mono text-xs uppercase tracking-wide hover:text-accentDeep">Lock</button>
        </div>
      </div>

      {error && <p className="font-mono text-sm text-accentDeep mb-4">{error}</p>}
      {loading && <p className="text-ink2">Loading…</p>}

      {/* ---- SUBMISSIONS ---- */}
      {view === "submissions" && (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            {["all", ...STATUSES].map((st) => (
              <button key={st} onClick={() => setFilter(st)}
                className={`font-mono text-label uppercase tracking-wide px-3 py-1.5 rounded-ui border-2 border-ink transition-colors ${filter === st ? "bg-ink text-paper" : "bg-paper hover:bg-paper2"}`}>
                {st} {st === "all" ? `· ${items.length}` : `· ${count(st)}`}
              </button>
            ))}
          </div>
          {!loading && shown.length === 0 && <p className="text-ink2">Nothing here yet.</p>}
          <div className="space-y-4">
            {shown.map((s) => (
              <div key={s.id} className="border-2 border-ink rounded-card bg-paper p-5" style={{ boxShadow: "4px 4px 0 var(--shadow-cast)" }}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="min-w-0">
                    <a href={s.websiteUrl} target="_blank" rel="noreferrer"
                      className="font-display text-xl font-semibold hover:text-accentDeep underline-offset-2 hover:underline break-words">{s.toolName}</a>
                    <span className="font-mono text-label text-ink2 ml-2">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                  <select value={s.status} onChange={(e) => setSubStatus(s.id, e.target.value)}
                    className="shrink-0 font-mono text-label uppercase tracking-wide border-2 border-ink rounded-ui px-3 py-1.5 bg-paper cursor-pointer"
                    style={{ color: STATUS_COLOR[s.status] }}>
                    {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
                <p className="mb-2">{s.pitch}</p>
                {s.details && <p className="text-sm text-ink2 mb-3 whitespace-pre-wrap">{s.details}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-label uppercase tracking-wide text-ink2">
                  {s.category && <span>{s.category}</span>}
                  {s.pricing && <span>· {s.pricing}</span>}
                  {s.affiliateProgram && <span>· {s.affiliateProgram}</span>}
                  <a href={`mailto:${s.email}`} className="hover:text-accentDeep normal-case tracking-normal">· {s.contactName} ({s.email})</a>
                  <button onClick={() => removeSub(s.id)} className="ml-auto text-accentDeep hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---- REVIEWS (moderation queue) ---- */}
      {view === "reviews" && (
        <>
          {!loading && reviews.length === 0 && <p className="text-ink2">No reviews waiting — the queue is clear. ✦</p>}
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="border-2 border-ink rounded-card bg-paper p-5" style={{ boxShadow: "4px 4px 0 var(--shadow-cast)" }}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="min-w-0">
                    <span className="font-mono text-label uppercase tracking-wide text-ink2">on </span>
                    <a href={`/tools/${r.tool?.slug}`} className="font-display text-lg font-semibold hover:text-accentDeep">{r.tool?.name || "—"}</a>
                    <span className="font-mono text-label text-ink2 ml-2">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  <span className="shrink-0"><Stars r={r.rating} size={14} showNum={false} /></span>
                </div>
                {r.title && <h3 className="font-display text-lg font-semibold leading-tight">{r.title}</h3>}
                <p className="mt-1 mb-3 leading-relaxed whitespace-pre-wrap">{r.content}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-label uppercase tracking-wide text-ink2">
                  <span className="normal-case tracking-normal">{r.authorName || "Anonymous"}{r.useCase ? ` · ${r.useCase}` : ""}</span>
                  <span className="ml-auto flex gap-2">
                    <button onClick={() => approveReview(r.id)}
                      className="px-3 py-1.5 rounded-ui border-2 border-ink bg-paper hover:bg-paper2 transition-colors" style={{ color: "#15803D" }}>Approve</button>
                    <button onClick={() => rejectReview(r.id)}
                      className="px-3 py-1.5 rounded-ui border-2 border-ink bg-paper hover:bg-paper2 transition-colors text-accentDeep">Reject</button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---- STACKS (moderation queue) ---- */}
      {/* Best-of runs its own loading and saving — it edits rather than
          moderates, so it doesn't share the queue state above. */}
      {view === "best" && <BestAdmin token={token} />}
      {view === "tools" && <ToolsAdmin token={token} />}
      {view === "pricing" && <PricingAdmin token={token} />}
      {view === "clicks" && <ClicksAdmin token={token} />}

      {view === "stacks" && (
        <>
          {!loading && stacks.length === 0 && <p className="text-ink2">No stacks waiting — the queue is clear. ✦</p>}
          <div className="space-y-4">
            {stacks.map((s) => (
              <div key={s.id} className="border-2 border-ink rounded-card bg-paper p-5" style={{ boxShadow: "4px 4px 0 var(--shadow-cast)" }}>
                <div className="flex flex-wrap gap-2 mb-3">
                  {s.tools.map((t) => (
                    <Link key={t.slug} to={`/tools/${t.slug}`} title={t.name}
                      className="grid place-items-center min-w-[2rem] h-8 px-2 rounded-ui border-2 border-ink text-white font-display font-bold text-sm"
                      style={{ background: t.category?.colorPrimary || "#1C1714" }}>{t.logoMono || t.name[0]}</Link>
                  ))}
                </div>
                {s.note && <p className="mb-3 leading-relaxed whitespace-pre-wrap">“{s.note}”</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-label uppercase tracking-wide text-ink2">
                  <span className="normal-case tracking-normal">{s.authorName || "Anonymous"}{s.authorRole ? ` · ${s.authorRole}` : ""}</span>
                  <span>· {new Date(s.createdAt).toLocaleDateString()}</span>
                  <span className="ml-auto flex gap-2">
                    <button onClick={() => approveStack(s.id)} className="px-3 py-1.5 rounded-ui border-2 border-ink bg-paper hover:bg-paper2 transition-colors" style={{ color: "#15803D" }}>Approve</button>
                    <button onClick={() => rejectStack(s.id)} className="px-3 py-1.5 rounded-ui border-2 border-ink bg-paper hover:bg-paper2 transition-colors text-accentDeep">Reject</button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
