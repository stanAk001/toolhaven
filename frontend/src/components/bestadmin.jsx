// The best-of desk.
//
// The point of this screen is that publishing a shortlist stops being a code
// change. It has two modes: a table of every list (drafts included), and an
// editor for one list — its copy, its ranked picks, and its FAQs.
//
// Picks and FAQs are saved as whole ordered arrays rather than row by row,
// which is what makes reordering trivial: move an item in local state, save,
// and the server rewrites the order in one transaction.
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, X, ArrowUp, ArrowDown, Search, ExternalLink } from "lucide-react";
import {
  listBestAdmin, getBestAdmin, createBest, updateBest, deleteBest,
  saveBestEntries, saveBestFaqs, getTools, getCategories,
} from "../api/client.js";

const field = "w-full border border-rule rounded-card bg-paper px-4 py-3 outline-none focus:border-accent transition-colors";
const label = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";

export function BestAdmin({ token }) {
  const [lists, setLists] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setLists((await listBestAdmin(token)).items || []); }
    catch (e) { setError(e?.response?.data?.error || "Couldn't load the lists."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (editingId !== null) {
    return (
      <BestEditor
        id={editingId}
        token={token}
        onClose={() => { setEditingId(null); load(); }}
      />
    );
  }

  const create = async () => {
    try {
      const made = await createBest({ title: "Untitled list", isPublished: false }, token);
      setEditingId(made.id);
    } catch (e) { setError(e?.response?.data?.error || "Couldn't create the list."); }
  };

  const remove = async (l) => {
    if (!window.confirm(`Delete "${l.title}" and all its picks? This can't be undone.`)) return;
    try { await deleteBest(l.id, token); load(); }
    catch (e) { setError(e?.response?.data?.error || "Couldn't delete that."); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="font-mono text-label uppercase tracking-wide text-ink2">
          {lists.length} list{lists.length === 1 ? "" : "s"}
        </p>
        <button onClick={create} className="stamp text-xs">
          <Plus size={14} aria-hidden="true" /> New list
        </button>
      </div>

      {error && <p className="font-mono text-sm text-accentDeep mb-4">{error}</p>}
      {loading && <p className="text-ink2">Loading…</p>}

      <div className="space-y-3">
        {lists.map((l) => (
          <div key={l.id} className="border border-rule rounded-card bg-paper p-4 sm:p-5"
            >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-display text-lg sm:text-xl font-semibold leading-tight">{l.title}</h3>
                  <span className={`font-mono text-nano uppercase tracking-wide px-2 py-0.5 rounded-ui border ${
                    l.isPublished ? "border-green-700 text-green-700" : "border-ink/40 text-ink2"}`}>
                    {l.isPublished ? "Live" : "Draft"}
                  </span>
                </div>
                <p className="font-mono text-label text-ink2">
                  /best/{l.slug} · {l.entryCount} pick{l.entryCount === 1 ? "" : "s"} · {l.faqCount} FAQ
                  {l.category ? ` · ${l.category.name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {l.isPublished && (
                  <Link to={`/best/${l.slug}`} target="_blank" aria-label={`View ${l.title}`}
                    className="grid place-items-center w-11 h-11 rounded-full border border-rule hover:bg-paper2 transition-colors">
                    <ExternalLink size={15} aria-hidden="true" />
                  </Link>
                )}
                <button onClick={() => setEditingId(l.id)}
                  className="inline-flex items-center min-h-touch font-mono text-label uppercase tracking-wide border border-rule rounded-ui px-4 hover:bg-paper2 transition-colors">
                  Edit
                </button>
                <button onClick={() => remove(l)} aria-label={`Delete ${l.title}`}
                  className="grid place-items-center w-11 h-11 rounded-full border border-rule text-accentDeep hover:bg-paper2 transition-colors">
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && lists.length === 0 && (
          <p className="text-ink2">No lists yet. Create one to get started.</p>
        )}
      </div>
    </div>
  );
}

function BestEditor({ id, token, onClose }) {
  const [list, setList] = useState(null);
  const [entries, setEntries] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [cats, setCats] = useState([]);
  const [allTools, setAllTools] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(null); // null | saving | saved | error
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [l, c, t] = await Promise.all([
          getBestAdmin(id, token),
          getCategories(),
          getTools({ limit: 100, sort: "popular" }),
        ]);
        setList(l);
        setEntries((l.entries || []).map((e) => ({
          toolId: e.tool.id, name: e.tool.name, logoMono: e.tool.logoMono,
          color: e.tool.category?.colorPrimary, award: e.award || "", blurb: e.blurb || "",
        })));
        setFaqs((l.faqs || []).map((f) => ({ question: f.question, answer: f.answer })));
        setCats(c || []);
        setAllTools(t.items || []);
      } catch (e) { setError(e?.response?.data?.error || "Couldn't load that list."); }
    })();
  }, [id, token]);

  const set = (k) => (e) => setList((l) => ({ ...l, [k]: e.target.value }));

  const pool = useMemo(() => {
    const term = q.trim().toLowerCase();
    const chosen = new Set(entries.map((e) => e.toolId));
    return allTools
      .filter((t) => !chosen.has(t.id))
      .filter((t) => !term || t.name.toLowerCase().includes(term) || (t.category?.name || "").toLowerCase().includes(term))
      .slice(0, 6);
  }, [allTools, entries, q]);

  const addTool = (t) => {
    setEntries((p) => [...p, {
      toolId: t.id, name: t.name, logoMono: t.logoMono,
      color: t.category?.colorPrimary, award: "", blurb: "",
    }]);
    setQ("");
  };
  const move = (i, dir) => setEntries((p) => {
    const next = [...p];
    const j = i + dir;
    if (j < 0 || j >= next.length) return p;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const patchEntry = (i, k, v) => setEntries((p) => p.map((e, n) => (n === i ? { ...e, [k]: v } : e)));

  const save = async () => {
    setStatus("saving"); setError("");
    try {
      // Copy first, then picks, then FAQs — each is independent, and doing them
      // in sequence means a failure reports which step actually broke.
      await updateBest(id, {
        title: list.title, slug: list.slug, subtitle: list.subtitle, intro: list.intro,
        audience: list.audience, criteria: list.criteria,
        categoryId: list.categoryId || null, isPublished: list.isPublished,
      }, token);
      await saveBestEntries(id, entries.map((e) => ({ toolId: e.toolId, award: e.award, blurb: e.blurb })), token);
      await saveBestFaqs(id, faqs, token);
      setStatus("saved");
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      setStatus("error");
      setError(e?.response?.data?.error || "Save failed.");
    }
  };

  if (error && !list) return <p className="font-mono text-sm text-accentDeep">{error}</p>;
  if (!list) return <p className="text-ink2">Loading…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button onClick={onClose}
          className="inline-flex items-center min-h-touch font-mono text-label uppercase tracking-wide hover:text-accentDeep transition-colors">
          ← All lists
        </button>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 min-h-touch cursor-pointer select-none mr-1">
            <input type="checkbox" checked={!!list.isPublished}
              onChange={(e) => setList((l) => ({ ...l, isPublished: e.target.checked }))}
              className="w-4 h-4 accent-accent cursor-pointer" />
            <span className="font-mono text-label uppercase tracking-wide">Published</span>
          </label>
          <button onClick={save} disabled={status === "saving"} className="stamp text-xs disabled:opacity-60">
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      {error && <p className="font-mono text-sm text-accentDeep mb-4">{error}</p>}

      <div className="space-y-4 mb-8">
        <div>
          <label htmlFor="b-title" className={label}>Title</label>
          <input id="b-title" className={field} value={list.title || ""} onChange={set("title")} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="b-slug" className={label}>Slug · /best/…</label>
            <input id="b-slug" className={field} value={list.slug || ""} onChange={set("slug")} />
          </div>
          <div>
            <label htmlFor="b-cat" className={label}>Category</label>
            <select id="b-cat" className={field} value={list.categoryId || ""}
              onChange={(e) => setList((l) => ({ ...l, categoryId: e.target.value || null }))}>
              <option value="">None</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="b-sub" className={label}>Subtitle · the deck</label>
          <input id="b-sub" className={field} value={list.subtitle || ""} onChange={set("subtitle")} />
        </div>
        <div>
          <label htmlFor="b-aud" className={label}>Who this is for</label>
          <input id="b-aud" className={field} value={list.audience || ""} onChange={set("audience")} />
        </div>
        <div>
          <label htmlFor="b-intro" className={label}>Intro · markdown</label>
          <textarea id="b-intro" rows={4} className={field} value={list.intro || ""} onChange={set("intro")} />
        </div>
        <div>
          <label htmlFor="b-crit" className={label}>How we chose · markdown</label>
          <textarea id="b-crit" rows={3} className={field} value={list.criteria || ""} onChange={set("criteria")} />
        </div>
      </div>

      {/* ── the ranked picks ── */}
      <h3 className="font-display text-xl font-semibold mb-1">The picks</h3>
      <p className="font-mono text-label uppercase tracking-wide text-ink2 mb-4">
        Order here is the order on the page
      </p>

      <div className="space-y-3 mb-4">
        {entries.map((e, i) => (
          <div key={e.toolId} className="border border-rule rounded-card bg-paper p-4">
            <div className="flex items-start gap-3 mb-3">
              <span aria-hidden="true" className="font-mono text-xs tabular-nums text-ink2 pt-3 w-6 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span aria-hidden="true"
                className="w-10 h-10 grid place-items-center rounded-ui border border-rule font-display font-bold text-sm text-white shrink-0"
                style={{ background: e.color || "#0E1116" }}>
                {e.logoMono || e.name[0]}
              </span>
              <span className="font-display text-lg font-semibold leading-tight flex-1 min-w-0 pt-1.5">{e.name}</span>
              <span className="flex items-center gap-1 shrink-0">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${e.name} up`}
                  className="grid place-items-center w-10 h-10 rounded-full border border-rule disabled:opacity-30 hover:bg-paper2 transition-colors">
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === entries.length - 1} aria-label={`Move ${e.name} down`}
                  className="grid place-items-center w-10 h-10 rounded-full border border-rule disabled:opacity-30 hover:bg-paper2 transition-colors">
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
                <button onClick={() => setEntries((p) => p.filter((_, n) => n !== i))} aria-label={`Remove ${e.name}`}
                  className="grid place-items-center w-10 h-10 rounded-full border border-rule text-accentDeep hover:bg-paper2 transition-colors">
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            </div>
            <div className="grid sm:grid-cols-[1fr_2fr] gap-3">
              <input className={field} placeholder="Award — e.g. Best overall"
                aria-label={`Award for ${e.name}`}
                value={e.award} onChange={(ev) => patchEntry(i, "award", ev.target.value)} />
              <input className={field} placeholder="Why it earned this spot"
                aria-label={`Blurb for ${e.name}`}
                value={e.blurb} onChange={(ev) => patchEntry(i, "blurb", ev.target.value)} />
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-ink2">No picks yet — add tools below.</p>}
      </div>

      <div className="border border-rule rounded-card bg-paper2/40 p-4 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Search size={16} strokeWidth={2.5} aria-hidden="true" className="text-accentDeep shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools to add…"
            aria-label="Search tools to add" className="flex-1 min-w-0 bg-transparent outline-none min-h-touch" />
        </div>
        <div className="flex flex-wrap gap-2">
          {pool.map((t) => (
            <button key={t.id} onClick={() => addTool(t)}
              className="inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide border border-rule rounded-ui px-3 bg-paper hover:bg-paper2 transition-colors">
              <Plus size={12} aria-hidden="true" /> {t.name}
            </button>
          ))}
          {pool.length === 0 && <span className="font-mono text-label text-ink2">No matches</span>}
        </div>
      </div>

      {/* ── FAQs ── */}
      <h3 className="font-display text-xl font-semibold mb-4">Questions</h3>
      <div className="space-y-3 mb-4">
        {faqs.map((f, i) => (
          <div key={i} className="border border-rule rounded-card bg-paper p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0 space-y-3">
                <input className={field} placeholder="Question" aria-label={`Question ${i + 1}`}
                  value={f.question}
                  onChange={(e) => setFaqs((p) => p.map((x, n) => (n === i ? { ...x, question: e.target.value } : x)))} />
                <textarea rows={2} className={field} placeholder="Answer" aria-label={`Answer ${i + 1}`}
                  value={f.answer}
                  onChange={(e) => setFaqs((p) => p.map((x, n) => (n === i ? { ...x, answer: e.target.value } : x)))} />
              </div>
              <button onClick={() => setFaqs((p) => p.filter((_, n) => n !== i))} aria-label={`Remove question ${i + 1}`}
                className="grid place-items-center w-10 h-10 shrink-0 rounded-full border border-rule text-accentDeep hover:bg-paper2 transition-colors">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setFaqs((p) => [...p, { question: "", answer: "" }])}
        className="inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide border border-rule rounded-ui px-4 hover:bg-paper2 transition-colors">
        <Plus size={13} aria-hidden="true" /> Add a question
      </button>
    </div>
  );
}
