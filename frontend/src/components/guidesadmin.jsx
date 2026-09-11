/**
 * The buying-guides desk.
 *
 * Product details are typed in here by a person, deliberately. There is no
 * scraper behind this form: Amazon's terms forbid it, their markup shifts
 * constantly, and a guide assembled by a script is precisely the thin affiliate
 * page this section is meant not to be. The fields match what Amazon's Product
 * Advertising API would return, so if you ever qualify for it the shape is
 * already right.
 *
 * There is nowhere to type a price or a star rating, and that is not an
 * oversight — see the note in guidepick.jsx.
 */
import { useState, useEffect, useCallback } from "react";
import { Plus, X, ChevronLeft, ChevronUp, ChevronDown, ExternalLink, Trash2, Copy, Wand2, Check, AlertCircle } from "lucide-react";
import {
  listGuidesAdmin, getGuideAdmin, createGuide, updateGuide, deleteGuide,
  saveGuidePicks, saveGuideFaqs, getCategories, recentGuideUploads,
} from "../api/client.js";
import { PhotoSet } from "./photoset.jsx";
import { parseListingTitle, asinFromUrl, labelsInUse, foldLabel, parseSpecTable, mergeSpecs, SPEC_TEMPLATES } from "../lib/amazonpaste.js";

const field = "w-full border border-rule rounded-ui bg-paper px-3 py-2.5 outline-none focus:border-accent transition-colors";
const label = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";
const hint = "font-mono text-nano text-ink2/80 mt-1";

const when = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function GuidesAdmin({ token }) {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems((await listGuidesAdmin(token)).items || []); }
    catch (e) { setError(e?.response?.data?.error || "Couldn't load the guides."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getCategories().then(setCats).catch(() => {}); }, []);

  const start = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { guide } = await createGuide({ title }, token);
      setTitle(""); setCreating(false);
      await load();
      setOpenId(guide.id);
    } catch (err) { setError(err?.response?.data?.error || "Couldn't start that guide."); }
  };

  if (openId) {
    return <GuideEditor id={openId} token={token} cats={cats}
      onBack={() => { setOpenId(null); load(); }} />;
  }

  return (
    <div>
      {creating ? (
        <form onSubmit={start} className="border border-rule rounded-card bg-paper p-4 mb-5">
          <label htmlFor="ng-title" className={label}>What is the guide called?</label>
          <div className="flex flex-wrap gap-2">
            <input id="ng-title" className={field + " flex-1 min-w-[16rem]"} value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Best monitors for software developers in 2026" required autoFocus />
            <button type="submit" className="stamp text-xs">Start it</button>
            <button type="button" onClick={() => { setCreating(false); setTitle(""); }}
              className="font-mono text-label uppercase tracking-wide text-ink2 hover:text-ink px-2">Cancel</button>
          </div>
          <p className={hint}>Starts as a draft. Nothing is public until you publish it.</p>
        </form>
      ) : (
        <button onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide
            border border-rule rounded-ui px-4 bg-paper hover:bg-ink hover:text-paper transition-colors mb-5">
          <Plus size={14} aria-hidden="true" /> New guide
        </button>
      )}

      {error && <p className="font-mono text-sm text-accentDeep mb-4">{error}</p>}
      {loading && <p className="text-ink2">Loading…</p>}

      {!loading && items.length === 0 && (
        <div className="border border-dashed border-rule rounded-card px-6 py-12 text-center">
          <p className="font-display text-xl font-semibold mb-1">No guides yet.</p>
          <p className="text-ink2 text-pretty">A guide is worth writing when you'd actually recommend the thing.</p>
        </div>
      )}

      <div className="space-y-2.5">
        {items.map((g) => (
          <button key={g.id} onClick={() => setOpenId(g.id)}
            className="w-full text-left border border-rule rounded-card bg-paper p-4 hover:bg-paper2/50 transition-colors">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h3 className="font-display text-lg font-semibold leading-tight">{g.title}</h3>
              <span className={`inline-flex items-center font-mono text-nano uppercase tracking-[.12em] px-2.5 py-1 rounded-ui border ${
                g.status === "published" ? "border-green-700 text-green-700" : "border-ink/40 text-ink2"}`}>
                {g.status === "published" ? "Live" : "Draft"}
              </span>
              {!g.ready && (
                <span className="font-mono text-nano uppercase tracking-[.12em] text-accentDeep">no picks yet</span>
              )}
              <span className="ml-auto font-mono text-nano uppercase tracking-[.12em] text-ink2 tabular-nums">
                {when(g.updatedAt)}
              </span>
            </div>
            <p className="font-mono text-nano uppercase tracking-[.1em] text-ink2 mt-1.5">
              /guides/{g.slug} · {g.pickCount} pick{g.pickCount === 1 ? "" : "s"} · {g.faqCount} FAQ
              {g.category ? ` · ${g.category.name}` : ""}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── one guide ───────────────────────────────────────────────────────────── */

const BLANK_PICK = {
  award: "", name: "", brand: "", model: "", photos: [],
  verdict: "", bestFor: "", considerElseIf: "",
  specs: [{ label: "", value: "" }], pros: "", cons: "", amazonUrl: "", asin: "",
};

/**
 * The state of one save button: what is pending, what has been written, and
 * when. It sits next to the control that caused it, and it does not time out —
 * "saved at 15:45" is still true five minutes later, and is the thing you want
 * to see when you come back to the tab wondering whether you saved.
 */
function SaveState({ busy, dirty, savedAt, error }) {
  if (busy) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-nano uppercase tracking-[.12em] text-ink2">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" aria-hidden="true" />
        Saving&hellip;
      </span>
    );
  }
  if (error) {
    return (
      <span className="inline-flex items-start gap-1.5 font-mono text-nano text-accentDeep">
        <AlertCircle size={12} aria-hidden="true" className="shrink-0 mt-px" />
        <span className="normal-case tracking-normal">{error}</span>
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-nano uppercase tracking-[.12em] text-ink2">
        <span className="w-1.5 h-1.5 bg-accent" aria-hidden="true" />
        Unsaved changes
      </span>
    );
  }
  if (savedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-nano uppercase tracking-[.12em] text-ink2">
        <Check size={12} aria-hidden="true" className="text-green-700" />
        Saved {savedAt}
      </span>
    );
  }
  return null;
}

function GuideEditor({ id, token, cats, onBack }) {
  const [g, setG] = useState(null);
  const [picks, setPicks] = useState([]);
  const [faqs, setFaqs] = useState([]);
  // Which pick's full form is showing. Only ever one — a guide can carry
  // twenty picks and twenty open forms is a page nobody can work in.
  const [openPick, setOpenPick] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  // When each section was last written, and whether it has been touched since.
  // Keyed by the same names `busy` uses, so a button and its receipt cannot
  // drift apart.
  const [savedAt, setSavedAt] = useState({});
  const [specNote, setSpecNote] = useState({});
  const [dirty, setDirty] = useState({});
  const [sectionError, setSectionError] = useState({});
  const clock = () => new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const touch = (section) => {
    setDirty((d) => (d[section] ? d : { ...d, [section]: true }));
    setSectionError((e) => (e[section] ? { ...e, [section]: "" } : e));
  };
  const settled = (section) => {
    setSavedAt((a) => ({ ...a, [section]: clock() }));
    setDirty((d) => ({ ...d, [section]: false }));
    setSectionError((e) => ({ ...e, [section]: "" }));
  };

  /**
   * Fill whatever is still empty with a skeleton.
   *
   * Only the empty boxes: anything already written is left alone, so this is
   * safe to press on a half-finished guide. The square brackets are the point —
   * they are impossible to miss in a proof-read, so a skeleton cannot quietly
   * become published copy the way a plausible-sounding generated paragraph can.
   */
  const scaffold = () => {
    const subject = (g?.title || "these").replace(/^best\s+/i, "").replace(/\s+in \d{4}$/i, "");
    setG((prev) => ({
      ...prev,
      standfirst: prev.standfirst
        || `${picks.length || "[how many]"} worth buying, what each one is for, and [the trade-off nobody mentions].`,
      intro: prev.intro
        || `[Why choosing ${subject} is harder than it looks — the thing people get wrong.]\n`
         + `The short version: [your actual answer, in one sentence]. What follows is what each trade-off costs you.`,
      methodology: prev.methodology
        || `Every specification here came from [the manufacturer's own documentation / an independent lab review], not a retailer listing.\n`
         + `We have not [tested X ourselves]. Where that is the deciding factor we say so and point at someone who measured it.`,
      finalWord: prev.finalWord
        || `[Buy the first one.] [Buy the Nth if budget is the constraint.]`,
    }));
    setDone("Skeleton dropped into the empty boxes. Replace everything in [brackets].");
  };

  const load = useCallback(async () => {
    try {
      const { guide } = await getGuideAdmin(id, token);
      setG(guide);
      setPicks((guide.picks || []).map((p) => ({
        ...p,
        // One photo shape in the editor, whatever the server sent: `id` is the
        // image and there is a `url`. The API now sends that shape itself; this
        // normalises anyway, because the bug it prevents — a join-row id being
        // saved back as an image id — deletes photos silently, and a stale API
        // or a cached response should not be able to bring it back.
        photos: (p.photos || []).map((ph) => {
          const img = ph.uploadId ?? ph.id;
          return { ...ph, id: img, uploadId: img, url: ph.url || `/api/uploads/${img}` };
        }),
        specs: Array.isArray(p.specs) && p.specs.length ? p.specs : [{ label: "", value: "" }],
        pros: (p.pros || []).join("\n"),
        cons: (p.cons || []).join("\n"),
      })));
      setFaqs(guide.faqs || []);
    } catch (e) { setError(e?.response?.data?.error || "Couldn't load that guide."); }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => { touch("details"); setG((p) => ({ ...p, [k]: e.target.value })); };
  const flash = (msg) => { setDone(msg); setTimeout(() => setDone(""), 2600); };

  const saveDetails = async (extra = {}) => {
    setBusy("details"); setError("");
    try {
      await updateGuide(id, {
        title: g.title, slug: g.slug, standfirst: g.standfirst, intro: g.intro,
        methodology: g.methodology, finalWord: g.finalWord,
        productsConsidered: g.productsConsidered,
        categoryId: g.categoryId,
        seoTitle: g.seoTitle, metaDescription: g.metaDescription,
        canonicalUrl: g.canonicalUrl, ogTitle: g.ogTitle, ogDescription: g.ogDescription,
        ...extra,
      }, token);
      await load();
      settled("details");
      flash(extra.status === "published" ? "Published — it's live."
        : extra.status === "draft" ? "Withdrawn. Readers can't see it now."
          : "Saved.");
    } catch (e) {
      const msg = e?.response?.data?.error || "That didn't save.";
      setError(msg); setSectionError((x) => ({ ...x, details: msg }));
    }
    finally { setBusy(""); }
  };

  const savePicks = async () => {
    setBusy("picks"); setError("");
    try {
      await saveGuidePicks(id, picks.map((p) => ({
        ...p,
        specs: (p.specs || []).filter((s) => s.label || s.value),
      })), token);
      await load(); settled("picks"); flash("Picks saved.");
    } catch (e) {
      const msg = e?.response?.data?.error || "The picks didn't save.";
      setError(msg); setSectionError((x) => ({ ...x, picks: msg }));
    }
    finally { setBusy(""); }
  };

  const saveFaqs = async () => {
    setBusy("faqs"); setError("");
    try { await saveGuideFaqs(id, faqs, token); await load(); settled("faqs"); flash("Questions saved."); }
    catch (e) {
      const msg = e?.response?.data?.error || "The questions didn't save.";
      setError(msg); setSectionError((x) => ({ ...x, faqs: msg }));
    }
    finally { setBusy(""); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${g.title}" and everything in it? This cannot be undone.`)) return;
    try { await deleteGuide(id, token); onBack(); }
    catch (e) { setError(e?.response?.data?.error || "Couldn't delete it."); }
  };

  const move = (i, dir) => setPicks((p) => {
    const next = [...p];
    const j = i + dir;
    if (j < 0 || j >= next.length) return p;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const patchPick = (i, k, v) => {
    touch("picks");
    setPicks((p) => p.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  };

  if (!g) {
    return (
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 min-h-touch font-mono text-label uppercase tracking-wide text-ink2 hover:text-ink mb-5">
          <ChevronLeft size={14} aria-hidden="true" /> Back to the guides
        </button>
        {error ? <p className="font-mono text-sm text-accentDeep">{error}</p> : <p className="text-ink2">Loading…</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 min-h-touch font-mono text-label uppercase tracking-wide text-ink2 hover:text-ink">
          <ChevronLeft size={14} aria-hidden="true" /> Back to the guides
        </button>
        <span className={`inline-flex items-center font-mono text-nano uppercase tracking-[.12em] px-2.5 py-1 rounded-ui border ${
          g.status === "published" ? "border-green-700 text-green-700" : "border-ink/40 text-ink2"}`}>
          {g.status === "published" ? "Live" : "Draft"}
        </span>
        {g.status === "published" && (
          <a href={`/guides/${g.slug}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-nano uppercase tracking-wide text-accentDeep hover:text-ink">
            View it <ExternalLink size={11} aria-hidden="true" />
          </a>
        )}
        <div className="ml-auto flex items-center gap-2">
          {g.status === "draft" ? (
            <button onClick={() => saveDetails({ status: "published" })} disabled={busy === "details"}
              className="stamp text-xs disabled:opacity-60">Publish</button>
          ) : (
            <button onClick={() => saveDetails({ status: "draft" })} disabled={busy === "details"}
              className="inline-flex items-center min-h-touch font-mono text-label uppercase tracking-wide border border-rule rounded-ui px-4 hover:bg-paper2 transition-colors">
              Withdraw
            </button>
          )}
          <button onClick={remove} aria-label="Delete guide"
            className="grid place-items-center w-11 h-11 rounded-ui border border-rule text-accentDeep hover:bg-paper2 transition-colors">
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && <p className="font-mono text-sm text-accentDeep mb-4 text-pretty">{error}</p>}
      {done && <p className="font-mono text-sm text-green-700 mb-4">{done}</p>}

      {/* the editorial */}
      <section className="border border-rule rounded-card bg-paper p-4 sm:p-5 mb-5 space-y-4">
        <p className="font-mono text-label uppercase tracking-[.16em] text-accentDeep">The guide</p>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="ge-title" className={label}>Title</label>
            <input id="ge-title" className={field} value={g.title || ""} onChange={set("title")} />
          </div>
          <div>
            <label htmlFor="ge-cat" className={label}>Category</label>
            <select id="ge-cat" className={field} value={g.categoryId || ""}
              onChange={(e) => setG((p) => ({ ...p, categoryId: e.target.value ? Number(e.target.value) : null }))}>
              <option value="">None</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="ge-slug" className={label}>Web address</label>
            <input id="ge-slug" className={field} value={g.slug || ""} onChange={set("slug")} />
            <p className={hint}>/guides/{g.slug}</p>
          </div>
          <div>
            <label htmlFor="ge-considered" className={label}>How many considered</label>
            <input id="ge-considered" className={field} inputMode="numeric" value={g.productsConsidered ?? ""}
              onChange={(e) => setG((p) => ({ ...p, productsConsidered: e.target.value }))} placeholder="12" />
            <p className={hint}>Only shown if set. Leave blank rather than guessing.</p>
          </div>
        </div>

        <div>
          <label htmlFor="ge-stand" className={label}>The one-line pitch</label>
          <input id="ge-stand" className={field} value={g.standfirst || ""} onChange={set("standfirst")}
            placeholder="Six worth buying, and the trade-off nobody puts on the box." />
          <p className={hint}>
            Shows under the title, on the guides list, and in Google.{" "}
            <span className={(g.standfirst || "").length > 155 ? "text-accentDeep" : ""}>
              {(g.standfirst || "").length}/155
            </span>
            {(g.standfirst || "").length > 155 ? " — Google will cut it off. Shorten it, or write a separate meta description below." : ""}
          </p>
        </div>

        <div>
          <label htmlFor="ge-intro" className={label}>The opening &middot; two short paragraphs</label>
          <textarea id="ge-intro" rows={5} className={field + " resize-y"} value={g.intro || ""} onChange={set("intro")}
            placeholder={"Line 1 — why this decision is harder than it looks.\nLine 2 — \"The short version:\" and then give the answer away."} />
          <p className={hint}>
            The first thing they read on the page. One paragraph per line. Give the answer in the
            second line — making people scroll for it is what the sites you are beating do.
          </p>
        </div>

        <div>
          <label htmlFor="ge-method" className={label}>How you picked these</label>
          <textarea id="ge-method" rows={4} className={field + " resize-y"} value={g.methodology || ""} onChange={set("methodology")}
            placeholder={"Where the numbers came from.\nAnd what you did NOT test — say it plainly."} />
          <p className={hint}>
            Saying what you have not tested is worth more than claiming you tested everything. It is
            also the difference between this and every thin affiliate page in the results.
          </p>
        </div>

        <div>
          <label htmlFor="ge-final" className={label}>The short answer</label>
          <textarea id="ge-final" rows={3} className={field + " resize-y"} value={g.finalWord || ""} onChange={set("finalWord")}
            placeholder="Buy the first one. Buy the third if you are on a budget." />
          <p className={hint}>Sits at the bottom, for whoever scrolled straight there.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => saveDetails()} disabled={busy === "details"} className="stamp text-xs disabled:opacity-60">
            {busy === "details" ? "Saving…" : "Save the guide"}
          </button>
          <SaveState busy={busy === "details"} dirty={dirty.details}
            savedAt={savedAt.details} error={sectionError.details} />
          {/* The blank page is the expensive part, not the typing. This drops a
              skeleton with square brackets where your words go — obvious enough
              that a half-finished one cannot be published by accident. */}
          <button type="button" onClick={scaffold}
            className="inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide border border-rule rounded-ui px-3 hover:bg-paper2 transition-colors">
            <Wand2 size={13} aria-hidden="true" /> Fill the empty boxes with a skeleton
          </button>
        </div>
      </section>

      {/* the picks */}
      <section className="border border-rule rounded-card bg-paper p-4 sm:p-5 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <p className="font-mono text-label uppercase tracking-[.16em] text-accentDeep">The picks</p>
          <p className="font-mono text-nano uppercase tracking-wide text-ink2 tabular-nums">
            {picks.length} in order
          </p>
        </div>
        <p className="text-sm text-ink2 mb-4 text-pretty">
          Order here is the order on the page. Every pick needs a name; everything else is optional,
          but a pick with no drawbacks listed reads as an advert.
        </p>

        <div className="space-y-4">
          {picks.map((p, i) => (
            <div key={i} className="border border-rule rounded-card bg-paper2/25 p-3.5">
              {/* Collapsed by default.
                  A guide with twenty picks is a legitimate thing to write, and
                  twenty open forms is about sixteen thousand pixels of page —
                  you lose your place, and the save button is nowhere near the
                  thing you just typed. One open at a time. */}
              {openPick !== i ? (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-nano uppercase tracking-[.14em] text-ink2 tabular-nums shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <button type="button" onClick={() => setOpenPick(i)}
                    className="min-w-0 flex-1 text-left">
                    <span className="block font-display text-base font-semibold leading-tight truncate">
                      {p.name || <span className="text-ink2 font-normal">Untitled pick</span>}
                    </span>
                    <span className="block font-mono text-nano uppercase tracking-[.12em] text-ink2 mt-0.5 truncate">
                      {p.award || "no award"}
                      {p.brand ? ` · ${p.brand}` : ""}
                      {p.amazonUrl ? " · linked" : " · no link yet"}
                    </span>
                  </button>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                    className="grid place-items-center w-9 h-9 shrink-0 rounded-ui border border-rule disabled:opacity-30 hover:bg-paper2 transition-colors">
                    <ChevronUp size={13} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === picks.length - 1} aria-label="Move down"
                    className="grid place-items-center w-9 h-9 shrink-0 rounded-ui border border-rule disabled:opacity-30 hover:bg-paper2 transition-colors">
                    <ChevronDown size={13} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setOpenPick(i)}
                    className="inline-flex items-center min-h-touch shrink-0 font-mono text-nano uppercase tracking-wide border border-rule rounded-ui px-3 hover:bg-paper2 transition-colors">
                    Edit
                  </button>
                  <button type="button" aria-label="Remove pick"
                    onClick={() => { touch("picks"); setPicks((x) => x.filter((_, n) => n !== i)); setOpenPick(null); }}
                    className="grid place-items-center w-9 h-9 shrink-0 rounded-ui border border-rule text-accentDeep hover:bg-paper2 transition-colors">
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <>
                <div className="flex justify-end mb-2">
                  <button type="button" onClick={() => setOpenPick(null)}
                    className="inline-flex items-center gap-1.5 min-h-touch font-mono text-nano uppercase tracking-wide text-ink2 hover:text-ink">
                    Collapse <ChevronUp size={12} aria-hidden="true" />
                  </button>
                </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-nano uppercase tracking-[.14em] text-ink2 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <input className={field + " flex-1"} value={p.award || ""}
                  onChange={(e) => patchPick(i, "award", e.target.value)}
                  placeholder="Best overall / Best budget / Best for colour work" />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                  className="grid place-items-center w-9 h-9 shrink-0 rounded-ui border border-rule disabled:opacity-30 hover:bg-paper2 transition-colors">
                  <ChevronUp size={13} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === picks.length - 1} aria-label="Move down"
                  className="grid place-items-center w-9 h-9 shrink-0 rounded-ui border border-rule disabled:opacity-30 hover:bg-paper2 transition-colors">
                  <ChevronDown size={13} aria-hidden="true" />
                </button>
                {/* Two picks in a guide are usually the same product with one
                    thing changed. Copying the one above and editing the
                    difference beats retyping nine fields. */}
                <button type="button" aria-label="Duplicate this pick"
                  onClick={() => { touch("picks"); setPicks((x) => [...x.slice(0, i + 1),
                    { ...x[i], id: undefined, award: "", name: "", photos: [],
                      amazonUrl: "", asin: "", specs: (x[i].specs || []).map((sp) => ({ label: sp.label, value: "" })) },
                    ...x.slice(i + 1)]); }}
                  className="grid place-items-center w-9 h-9 shrink-0 rounded-ui border border-rule hover:bg-paper2 transition-colors">
                  <Copy size={13} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => { touch("picks"); setPicks((x) => x.filter((_, n) => n !== i)); }} aria-label="Remove pick"
                  className="grid place-items-center w-9 h-9 shrink-0 rounded-ui border border-rule text-accentDeep hover:bg-paper2 transition-colors">
                  <X size={13} aria-hidden="true" />
                </button>
              </div>

              {/* Copy the product title off the Amazon page and drop it here.
                  It reads the text you pasted and nothing else — no request is
                  made to Amazon, which is both their rule and the only version
                  of this that keeps working. Everything it proposes lands in an
                  editable field, because those titles are written for the search
                  box rather than to describe anything accurately. */}
              <div className="mb-3 border border-dashed border-rule rounded-ui p-3 bg-paper2/40">
                <label className={label}>Paste the Amazon listing title</label>
                <textarea rows={2} className={field + " resize-y"}
                  placeholder="Amazon Basics 24-inch Full HD IPS Monitor, 75 Hz, 1080P, HDMI…"
                  onChange={(e) => {
                    const parsed = parseListingTitle(e.target.value);
                    if (!parsed.name) return;
                    setPicks((x) => x.map((row, n) => {
                      if (n !== i) return row;
                      // Merge rather than replace: a spec you have already
                      // filled in wins over anything read out of the title.
                      const mine = (row.specs || []).map((sp) => sp.label).filter(Boolean);
                      const added = parsed.specs
                        // A guide already using "Refresh" should not gain a
                        // second row called "Refresh rate".
                        .map((sp) => ({ ...sp, label: foldLabel(sp.label, mine) }))
                        .filter((sp) => !mine.includes(sp.label));
                      const kept = (row.specs || []).filter((sp) => sp.label || sp.value);
                      return {
                        ...row,
                        brand: row.brand || parsed.brand,
                        name: row.name || parsed.name,
                        specs: [...kept, ...added],
                      };
                    }));
                  }} />
                <p className={hint}>Fills the brand, a short name and the specifications it can recognise. Check every one.</p>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mb-3">
                <div className="sm:col-span-2">
                  <label className={label}>Product name &middot; required</label>
                  <input className={field} value={p.name || ""} onChange={(e) => patchPick(i, "name", e.target.value)}
                    placeholder="Dell UltraSharp U2723QE" />
                </div>
                <div>
                  <label className={label}>Brand</label>
                  <input className={field} value={p.brand || ""} onChange={(e) => patchPick(i, "brand", e.target.value)}
                    placeholder="Dell" />
                </div>
              </div>

              <div className="mb-3">
                <PhotoSet
                  value={p.photos || []}
                  onChange={(next) => patchPick(i, "photos", next)}
                  loadRecent={() => recentGuideUploads(token)}
                  label="Product photos"
                  hint="The manufacturer's own shots, or your own. Do not hotlink Amazon's — their terms forbid it and the links rot."
                />
              </div>

              <div className="mb-3">
                <label className={label}>The verdict</label>
                <textarea rows={3} className={field + " resize-y"} value={p.verdict || ""}
                  onChange={(e) => patchPick(i, "verdict", e.target.value)}
                  placeholder="Why this one is here, in your voice." />
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={label}>Best for</label>
                  <input className={field} value={p.bestFor || ""} onChange={(e) => patchPick(i, "bestFor", e.target.value)}
                    placeholder="Long days in a text editor" />
                </div>
                <div>
                  <label className={label}>Look elsewhere if</label>
                  <input className={field} value={p.considerElseIf || ""}
                    onChange={(e) => patchPick(i, "considerElseIf", e.target.value)}
                    placeholder="You need colour accuracy for print work" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={label}>What&rsquo;s good &middot; one per line</label>
                  <textarea rows={4} className={field + " resize-y"} value={p.pros || ""}
                    onChange={(e) => patchPick(i, "pros", e.target.value)} />
                </div>
                <div>
                  <label className={label}>What&rsquo;s not &middot; one per line</label>
                  <textarea rows={4} className={field + " resize-y"} value={p.cons || ""}
                    onChange={(e) => patchPick(i, "cons", e.target.value)} />
                </div>
              </div>

              {/* Specs drive the comparison table, so labels have to match
                  across picks for a row to line up. */}
              <div className="mb-3">
                <label className={label}>Specifications</label>

                {/* Two ways in that are not typing one row at a time.
                    Paste: the whole spec table, straight off the product page.
                    Template: the labels every product of this kind is compared
                    on, so a guide starts from the right rows. Both merge rather
                    than replace — anything already typed is never overwritten. */}
                <div className="grid sm:grid-cols-[1fr_auto] gap-2 mb-2.5">
                  <textarea rows={2} className={field + " resize-y font-mono text-xs"}
                    placeholder={"Paste the spec table here \u2014 copy the \u201cTechnical details\u201d or \u201cProduct information\u201d table off the product page"}
                    onPaste={(e) => {
                      const text = e.clipboardData?.getData("text") || "";
                      if (!text.trim()) return;
                      e.preventDefault();
                      const known = [...new Set([...labelsInUse(picks, i), ...(p.specs || []).map((sp) => sp.label).filter(Boolean)])];
                      const { rows, skipped } = parseSpecTable(text, known);
                      if (!rows.length) {
                        setSpecNote((n) => ({ ...n, [i]: "Couldn\u2019t read any label/value rows from that. Paste a table, or lines like \u201cRefresh rate: 165 Hz\u201d." }));
                        return;
                      }
                      const { specs, added, filled, kept } = mergeSpecs(p.specs, rows);
                      patchPick(i, "specs", specs);
                      const bits = [
                        added && `${added} added`,
                        filled && `${filled} filled in`,
                        kept && `${kept} already set, left alone`,
                        skipped && `${skipped} skipped (ratings, IDs and lines that weren\u2019t specs)`,
                      ].filter(Boolean);
                      setSpecNote((n) => ({ ...n, [i]: bits.join(" \u00b7 ") }));
                    }} />
                  <select className={field + " sm:w-48"} defaultValue=""
                    aria-label="Start from a template"
                    onChange={(e) => {
                      const list = SPEC_TEMPLATES[e.target.value];
                      e.target.value = "";
                      if (!list) return;
                      const known = [...new Set([...labelsInUse(picks, i), ...(p.specs || []).map((sp) => sp.label).filter(Boolean)])];
                      const { specs, added } = mergeSpecs(p.specs,
                        list.map((l) => ({ label: foldLabel(l, known), value: "" })));
                      patchPick(i, "specs", specs);
                      setSpecNote((n) => ({ ...n, [i]: added ? `${added} rows added from the template \u2014 fill in the values.` : "Those rows are already here." }));
                    }}>
                    <option value="">Start from a template\u2026</option>
                    {Object.keys(SPEC_TEMPLATES).map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                {specNote[i] && <p className={hint + " mb-2"}>{specNote[i]}</p>}

                <div className="space-y-2">
                  {(p.specs || []).map((sp, si) => (
                    <div key={si} className="flex gap-2">
                      <input className={field + " sm:w-48"} value={sp.label || ""} placeholder="Size"
                        onChange={(e) => patchPick(i, "specs", p.specs.map((x, n) => (n === si ? { ...x, label: e.target.value } : x)))} />
                      <input className={field + " flex-1"} value={sp.value || ""} placeholder="27 inch"
                        onChange={(e) => patchPick(i, "specs", p.specs.map((x, n) => (n === si ? { ...x, value: e.target.value } : x)))} />
                      <button type="button" aria-label="Remove specification"
                        onClick={() => patchPick(i, "specs", p.specs.filter((_, n) => n !== si))}
                        className="grid place-items-center w-11 h-11 shrink-0 rounded-ui border border-rule text-accentDeep hover:bg-paper2 transition-colors">
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button"
                  onClick={() => patchPick(i, "specs", [...(p.specs || []), { label: "", value: "" }])}
                  className="inline-flex items-center gap-1.5 mt-2 min-h-touch font-mono text-nano uppercase tracking-wide border border-rule rounded-ui px-3 hover:bg-paper2 transition-colors">
                  <Plus size={12} aria-hidden="true" /> Add a specification
                </button>
                {/* A comparison row only lines up when every pick spells the
                    label identically. Offering the ones already in the guide is
                    more reliable than trusting anyone to retype "Refresh rate"
                    the same way twenty times. */}
                {labelsInUse(picks, i).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="font-mono text-nano uppercase tracking-wide text-ink2">Used elsewhere:</span>
                    {labelsInUse(picks, i)
                      .filter((l) => !(p.specs || []).some((sp) => sp.label === l))
                      .map((l) => (
                        <button key={l} type="button"
                          onClick={() => patchPick(i, "specs", [...(p.specs || []).filter((sp) => sp.label || sp.value), { label: l, value: "" }])}
                          className="font-mono text-nano border border-rule rounded-tight px-2 py-1 hover:bg-paper2 transition-colors">
                          + {l}
                        </button>
                      ))}
                  </div>
                )}
                {(p.specs || []).filter((sp) => sp.label || sp.value).length > 14 && (
                  <p className="font-mono text-nano text-accentDeep mt-2">
                    {(p.specs || []).filter((sp) => sp.label || sp.value).length} rows \u2014 only the first 14 are saved.
                    Remove the ones a buyer wouldn\u2019t compare on.
                  </p>
                )}
                <p className={hint}>Same label on every pick, and the row lines up in the comparison table.</p>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className={label}>Amazon affiliate link</label>
                  <input className={field} value={p.amazonUrl || ""} placeholder="https://www.amazon.com/dp/&hellip;?tag=&hellip;"
                    onChange={(e) => {
                      const url = e.target.value;
                      // The ASIN is already in the URL. Typing it twice only
                      // creates a second place for it to go stale.
                      const found = asinFromUrl(url);
                      setPicks((x) => x.map((row, n) => (n === i
                        ? { ...row, amazonUrl: url, asin: found || row.asin }
                        : row)));
                    }} />
                  <p className={hint}>
                    Only real Amazon domains are accepted. No price is ever printed on the page —
                    prices move, and quoting a stale one breaks Amazon&rsquo;s terms.
                  </p>
                </div>
                <div>
                  <label className={label}>ASIN</label>
                  <input className={field} value={p.asin || ""} placeholder="B09XYZ1234"
                    onChange={(e) => patchPick(i, "asin", e.target.value)} />
                  <p className={hint}>{asinFromUrl(p.amazonUrl) ? "Read from the link." : "Paste the link and this fills itself."}</p>
                </div>
              </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {/* A new pick starts with the specification labels the guide is
              already using, values blank. Every pick needs the same rows for the
              comparison table to work, so making you retype them was busywork
              with a typo in it. */}
          <button type="button" onClick={() => {
            const rows = labelsInUse(picks).map((l) => ({ label: l, value: "" }));
            touch("picks"); setPicks((x) => [...x, { ...BLANK_PICK, specs: rows.length ? rows : BLANK_PICK.specs }]);
            setOpenPick(picks.length);
          }}
            className="inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide border border-rule rounded-ui px-4 hover:bg-paper2 transition-colors">
            <Plus size={13} aria-hidden="true" /> Add a pick
          </button>
          <button onClick={savePicks} disabled={busy === "picks"} className="stamp text-xs disabled:opacity-60">
            {busy === "picks" ? "Saving…" : "Save the picks"}
          </button>
          <SaveState busy={busy === "picks"} dirty={dirty.picks}
            savedAt={savedAt.picks} error={sectionError.picks} />
        </div>
      </section>

      {/* the questions */}
      <section className="border border-rule rounded-card bg-paper p-4 sm:p-5">
        <p className="font-mono text-label uppercase tracking-[.16em] text-accentDeep mb-1">Questions people ask</p>
        <p className="text-sm text-ink2 mb-4 text-pretty">
          These are marked up as an FAQ for search engines, so answer them properly rather than
          padding the page out.
        </p>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1 min-w-0 space-y-2">
                <input className={field} value={f.question || ""} placeholder="Is 4K worth it at 27 inches?"
                  onChange={(e) => { touch("faqs"); setFaqs((x) => x.map((r, n) => (n === i ? { ...r, question: e.target.value } : r))); }} />
                <textarea rows={3} className={field + " resize-y"} value={f.answer || ""} placeholder="The honest answer."
                  onChange={(e) => { touch("faqs"); setFaqs((x) => x.map((r, n) => (n === i ? { ...r, answer: e.target.value } : r))); }} />
              </div>
              <button type="button" aria-label="Remove question"
                onClick={() => { touch("faqs"); setFaqs((x) => x.filter((_, n) => n !== i)); }}
                className="grid place-items-center w-11 h-11 shrink-0 mt-1 rounded-ui border border-rule text-accentDeep hover:bg-paper2 transition-colors">
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button type="button" onClick={() => { touch("faqs"); setFaqs((x) => [...x, { question: "", answer: "" }]); }}
            className="inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide border border-rule rounded-ui px-4 hover:bg-paper2 transition-colors">
            <Plus size={13} aria-hidden="true" /> Add a question
          </button>
          <button onClick={saveFaqs} disabled={busy === "faqs"} className="stamp text-xs disabled:opacity-60">
            {busy === "faqs" ? "Saving…" : "Save the questions"}
          </button>
          <SaveState busy={busy === "faqs"} dirty={dirty.faqs}
            savedAt={savedAt.faqs} error={sectionError.faqs} />
        </div>
      </section>

      {/* Search and social, folded away because it is the last thing you do. */}
      <details className="border border-rule rounded-card mt-5 p-4">
        <summary className="font-mono text-label uppercase tracking-[.16em] text-ink2 cursor-pointer min-h-touch flex items-center">
          Search and social
        </summary>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className={label}>SEO title</label>
            <input className={field} value={g.seoTitle || ""} onChange={set("seoTitle")} placeholder={g.title} />
            <p className={hint}>Falls back to the guide title if left blank</p>
          </div>
          <div>
            <label className={label}>Canonical URL</label>
            <input className={field} value={g.canonicalUrl || ""} onChange={set("canonicalUrl")}
              placeholder="Only if this exists somewhere else too" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Meta description</label>
            <textarea rows={2} className={field + " resize-y"} value={g.metaDescription || ""}
              onChange={set("metaDescription")} placeholder={g.standfirst || "Around 150 characters."} />
          </div>
          <div>
            <label className={label}>Social title</label>
            <input className={field} value={g.ogTitle || ""} onChange={set("ogTitle")} />
          </div>
          <div>
            <label className={label}>Social description</label>
            <input className={field} value={g.ogDescription || ""} onChange={set("ogDescription")} />
          </div>
        </div>
        <SaveState busy={busy === "details"} dirty={dirty.details}
          savedAt={savedAt.details} error={sectionError.details} />
        <button onClick={() => saveDetails()} disabled={busy === "details"} className="stamp text-xs mt-4 disabled:opacity-60">
          Save
        </button>
      </details>
    </div>
  );
}
