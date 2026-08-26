import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getTools, getStacks, createStack } from "../api/client.js";
import { Loader } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { PageHead, SectionHead } from "../components/editorial.jsx";
import { Seo } from "../lib/seo.jsx";

const MAX = 12;
const TILTS = [-1.2, 0.9, -0.7, 1.1, -1, 0.7];

// a tool's monogram tile, links through to the tool
function ToolTile({ t }) {
  return (
    <Link to={`/tools/${t.slug}`} title={t.name}
      className="grid place-items-center min-w-[2rem] sm:min-w-[2.2rem] h-8 sm:h-9 px-1.5 sm:px-2 rounded-ui border-2 border-ink text-white font-display font-bold text-xs sm:text-sm transition-transform hover:-translate-y-0.5"
      style={{ background: t.category?.colorPrimary || "#1C1714", boxShadow: "2px 2px 0 var(--shadow-cast)" }}>
      {t.logoMono || t.name[0]}
    </Link>
  );
}

function StackCard({ stack, tilt = 0 }) {
  return (
    <figure className="relative bg-paper border-2 border-ink rounded-card p-4 sm:p-5 rotate-[var(--r)] hover:rotate-0 transition-transform duration-300"
      style={{ "--r": `${tilt}deg`, boxShadow: "5px 5px 0 var(--shadow-cast)" }}>
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
        {stack.tools.map((t) => <ToolTile key={t.slug} t={t} />)}
      </div>
      {stack.note && <p className="font-display text-sm sm:text-lg leading-snug mb-3 sm:mb-4 text-pretty">“{stack.note}”</p>}
      <figcaption className="font-mono text-label uppercase tracking-wide text-ink2">
        {stack.authorName || "Anonymous"}{stack.authorRole ? <span className="text-accentDeep"> · {stack.authorRole}</span> : null}
      </figcaption>
    </figure>
  );
}

const EMPTY = { authorName: "", authorRole: "", note: "", website: "" };

export default function Stacks() {
  const [all, setAll] = useState([]);
  const [stacks, setStacks] = useState(null);
  const [picked, setPicked] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null); // null | sending | sent | error
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => { getTools({ limit: 100, sort: "popular" }).then((d) => setAll(d.items || [])); }, []);
  useEffect(() => { getStacks({ limit: 30 }).then((d) => setStacks(d.items || [])).catch(() => setStacks([])); }, []);

  const toggle = (slug) =>
    setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : p.length < MAX ? [...p, slug] : p));

  const submit = async (e) => {
    e.preventDefault();
    if (picked.length < 2) { setError("Pick at least two tools you actually use."); setStatus("error"); return; }
    setStatus("sending"); setError("");
    try { await createStack({ ...form, toolSlugs: picked }); setStatus("sent"); setForm(EMPTY); setPicked([]); }
    catch (err) { setError(err?.response?.data?.error || "Couldn't share that — try again."); setStatus("error"); }
  };

  const field = "w-full border-2 border-ink rounded-card bg-paper px-4 py-3 outline-none focus:border-accent transition-colors";
  const lab = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-12 fade-in">
      <Seo title="Community stacks" description="Real toolkits shared by readers — what people actually use together to get work done." path="/stacks" />
      <PageHead kicker="Community" title="The stacks real people actually run.">
        No theory, no sponsored picks — just the tools readers reach for every day. Share yours and see what others use.
      </PageHead>

      {/* builder */}
      <div className="mb-14">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-mono text-xs uppercase tracking-[.2em] text-accentDeep">Share your stack</h2>
          <button onClick={() => setOpen((o) => !o)}
            className="font-mono text-label uppercase tracking-wide border-2 border-ink rounded-ui px-3 py-1.5 hover:bg-paper2 transition-colors">
            {open ? "Close" : "Build it →"}
          </button>
        </div>

        {open && status !== "sent" && (
          <Reveal as="form" onSubmit={submit} noValidate
            className="border-2 border-ink rounded-card bg-paper p-5 md:p-6 space-y-5" style={{ boxShadow: "6px 6px 0 var(--shadow-cast)" }}>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} className="hidden" aria-hidden="true" />

            <div>
              <span className={lab}>Pick the tools you use ({picked.length}/{MAX})</span>
              {all.length === 0 ? <Loader /> : (
                <div className="flex flex-wrap gap-2">
                  {all.map((t) => {
                    const on = picked.includes(t.slug);
                    const disabled = !on && picked.length >= MAX;
                    return (
                      <button type="button" key={t.slug} onClick={() => toggle(t.slug)} disabled={disabled}
                        className={`font-mono text-xs uppercase px-3.5 py-1.5 rounded-ui border-2 border-ink transition-colors ${on ? "text-white" : "bg-paper hover:bg-paper2"} ${disabled ? "opacity-40" : ""}`}
                        style={on ? { background: t.category?.colorPrimary } : undefined}>
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={lab}>Name (optional)</label><input className={field} placeholder="e.g. Jane" value={form.authorName} onChange={set("authorName")} /></div>
              <div><label className={lab}>What you do (optional)</label><input className={field} placeholder="e.g. Freelance designer" value={form.authorRole} onChange={set("authorRole")} /></div>
            </div>
            <div>
              <label className={lab}>Why this stack? (optional)</label>
              <textarea className={`${field} min-h-[90px] resize-y`} placeholder="What ties these together, or the one you couldn't live without…" value={form.note} onChange={set("note")} />
            </div>

            <button type="submit" disabled={status === "sending"} className="stamp disabled:opacity-60">{status === "sending" ? "Sharing…" : "Share my stack →"}</button>
            {status === "error" && <p className="font-mono text-sm text-accentDeep">{error}</p>}
          </Reveal>
        )}

        {status === "sent" && (
          <div className="border-2 border-ink rounded-card bg-paper2/50 p-5">
            <p className="font-display text-lg font-semibold mb-1">Thanks — your stack is in. ✦</p>
            <p className="text-ink2 text-sm">We give every stack a quick look before it goes live (keeps the spam out). It'll appear below once approved.</p>
          </div>
        )}
      </div>

      {/* gallery */}
      <SectionHead folio="01" kicker="In the wild" title="Reader stacks" />
      {stacks === null ? <Loader /> : stacks.length === 0 ? (
        <p className="text-ink2">No stacks shared yet — be the first to show what you run.</p>
      ) : (
        <Reveal stagger className="columns-2 lg:columns-3 gap-3 sm:gap-4 [column-fill:_balance]">
          {stacks.map((s, i) => (
            <div key={s.id} className="break-inside-avoid mb-4">
              <StackCard stack={s} tilt={TILTS[i % TILTS.length]} />
            </div>
          ))}
        </Reveal>
      )}
    </div>
  );
}
