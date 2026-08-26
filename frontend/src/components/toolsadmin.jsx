// The tools desk and the outbound-clicks board.
//
// Between them these answer the two questions the affiliate plan actually
// depends on: where does a tracking link go, and is the traffic we already send
// earning anything. The tools list leads with monetisation state for exactly
// that reason — a tool with clicks and no affiliate link is money on the floor,
// so it's flagged rather than left for you to notice.
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, ExternalLink, AlertTriangle, X, Plus } from "lucide-react";
import { listToolsAdmin, updateToolAdmin, getClickStats, saveToolScore, clearToolScore, saveToolFacts, saveExternalRatings, saveToolVerdict, saveToolAlternatives } from "../api/client.js";

// Mirrors SCORE_DIMENSIONS on the server. Kept as a literal rather than fetched
// so the form renders instantly; the server still validates every value.
const DIMENSIONS = [
  ["features", "Features"],
  ["easeOfUse", "Ease of use"],
  ["performance", "Performance"],
  ["value", "Value"],
  ["devExperience", "Developer experience"],
  ["support", "Support"],
];

// The editorial assessment. Deliberately separate from the commercial fields
// above it: a pricing correction and a re-scoring are different acts, and
// sharing one Save button would make every small edit look like a re-review.
function ScoreEditor({ tool, token }) {
  const [vals, setVals] = useState(() =>
    Object.fromEntries(DIMENSIONS.map(([k]) => [k, tool.score?.[k] ?? ""])));
  const [notes, setNotes] = useState(tool.score?.notes || "");
  const [scoredBy, setScoredBy] = useState(tool.score?.scoredBy || "");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  // The same mean the server computes, shown live so you can see the headline
  // move as you type rather than after saving.
  const nums = DIMENSIONS
    .map(([k]) => vals[k])
    .filter((v) => v !== "" && v !== null)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  const preview = nums.length ? (Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10).toFixed(1) : null;

  const save = async () => {
    setStatus("saving"); setError("");
    try {
      await saveToolScore(tool.id, { ...vals, notes, scoredBy }, token);
      setStatus("saved");
      setTimeout(() => setStatus(null), 2200);
    } catch (e) {
      setStatus("error");
      setError(e?.response?.data?.error || "Couldn't save the score.");
    }
  };

  const clear = async () => {
    if (!window.confirm(`Withdraw the Toolhaven Score for ${tool.name}? The page will show no score at all.`)) return;
    try {
      await clearToolScore(tool.id, token);
      setVals(Object.fromEntries(DIMENSIONS.map(([k]) => [k, ""])));
      setNotes(""); setScoredBy("");
      setStatus("saved");
      setTimeout(() => setStatus(null), 2200);
    } catch (e) { setError(e?.response?.data?.error || "Couldn't clear the score."); }
  };

  return (
    <div className="border-t-2 border-ink p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-label uppercase tracking-[.14em] text-accentDeep">
          Toolhaven Score · leave blank to not score a dimension
        </p>
        {preview && (
          <p className="font-mono text-label uppercase tracking-wide text-ink2">
            Overall <span className="font-display text-xl font-semibold text-ink tabular-nums ml-1">{preview}</span> / 10
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {DIMENSIONS.map(([k, l]) => (
          <div key={k}>
            <label htmlFor={`sc-${tool.id}-${k}`} className={label}>{l}</label>
            <input id={`sc-${tool.id}-${k}`} type="number" min="0" max="10" step="0.1" className={field}
              value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} />
          </div>
        ))}
      </div>

      <div>
        <label htmlFor={`sc-${tool.id}-notes`} className={label}>Why these numbers · shown with the score</label>
        <textarea id={`sc-${tool.id}-notes`} rows={2} className={field} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`sc-${tool.id}-by`} className={label}>Assessed by</label>
        <input id={`sc-${tool.id}-by`} className={field} value={scoredBy} onChange={(e) => setScoredBy(e.target.value)} />
      </div>

      {error && <p className="font-mono text-sm text-accentDeep">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={status === "saving"} className="stamp text-xs disabled:opacity-60">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save score"}
        </button>
        {tool.score && (
          <button onClick={clear}
            className="inline-flex items-center min-h-touch font-mono text-label uppercase tracking-wide border-2 border-ink rounded-ui px-4 text-accentDeep hover:bg-paper2 transition-colors">
            Withdraw score
          </button>
        )}
      </div>
    </div>
  );
}

const field = "w-full border-2 border-ink rounded-card bg-paper px-3 py-2.5 outline-none focus:border-accent transition-colors";
const label = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";

export function ToolsAdmin({ token }) {
  const [tools, setTools] = useState([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setTools((await listToolsAdmin(token)).items || []); }
    catch (e) { setError(e?.response?.data?.error || "Couldn't load the tools."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tools.filter((t) =>
      !term || t.name.toLowerCase().includes(term) || (t.category?.name || "").toLowerCase().includes(term));
  }, [tools, q]);

  const unmonetised = tools.filter((t) => !t.affiliateLink && t.clicks > 0);

  return (
    <div>
      {/* the one number worth leading with */}
      {unmonetised.length > 0 && (
        <div className="flex items-start gap-3 border-2 border-ink rounded-card bg-accent/10 p-4 mb-5">
          <AlertTriangle size={18} className="text-accentDeep shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-pretty">
            <strong>{unmonetised.length} tool{unmonetised.length === 1 ? "" : "s"} already sending clicks with no affiliate link.</strong>{" "}
            Those visits go out on the plain website URL and earn nothing —{" "}
            {unmonetised.slice(0, 4).map((t) => t.name).join(", ")}
            {unmonetised.length > 4 ? ` and ${unmonetised.length - 4} more` : ""}.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 border-2 border-ink rounded-ui px-4 mb-5 bg-paper">
        <Search size={16} strokeWidth={2.5} aria-hidden="true" className="text-accentDeep shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools…"
          aria-label="Search tools" className="flex-1 min-w-0 bg-transparent outline-none min-h-touch" />
        <span className="font-mono text-label text-ink2 shrink-0">{shown.length}</span>
      </div>

      {error && <p className="font-mono text-sm text-accentDeep mb-4">{error}</p>}
      {loading && <p className="text-ink2">Loading…</p>}

      <div className="space-y-3">
        {shown.map((t) => (
          <ToolRow key={t.id} tool={t} token={token} allTools={tools}
            open={openId === t.id}
            onToggle={() => setOpenId(openId === t.id ? null : t.id)}
            onSaved={(updated) => setTools((p) => p.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))} />
        ))}
      </div>
    </div>
  );
}

function ToolRow({ tool, token, allTools, open, onToggle, onSaved }) {
  const [form, setForm] = useState(tool);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { setForm(tool); }, [tool]);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async () => {
    setStatus("saving"); setError("");
    try {
      const updated = await updateToolAdmin(tool.id, {
        affiliateLink: form.affiliateLink, affiliateNetwork: form.affiliateNetwork,
        websiteUrl: form.websiteUrl, bestFor: form.bestFor, caveat: form.caveat,
        priceType: form.priceType, priceMin: form.priceMin, priceMax: form.priceMax,
        rating: form.rating, freeTrial: form.freeTrial, freeTier: form.freeTier,
        isFeatured: form.isFeatured, isActive: form.isActive,
      }, token);
      onSaved(updated);
      setStatus("saved");
      setTimeout(() => setStatus(null), 2200);
    } catch (e) {
      setStatus("error");
      setError(e?.response?.data?.error || "Save failed.");
    }
  };

  return (
    <div className="border-2 border-ink rounded-card bg-paper" style={{ boxShadow: "4px 4px 0 var(--shadow-cast)" }}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span aria-hidden="true"
          className="w-10 h-10 grid place-items-center rounded-ui border-2 border-ink font-display font-bold text-sm text-white shrink-0"
          style={{ background: tool.category?.colorPrimary || "#1C1714" }}>
          {tool.logoMono || tool.name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-semibold leading-tight">{tool.name}</span>
            {tool.affiliateLink ? (
              <span className="font-mono text-nano uppercase tracking-wide px-2 py-0.5 rounded-ui border-2 border-green-700 text-green-700">
                Monetised
              </span>
            ) : (
              <span className="font-mono text-nano uppercase tracking-wide px-2 py-0.5 rounded-ui border-2 border-ink/40 text-ink2">
                No link
              </span>
            )}
            {!tool.isActive && (
              <span className="font-mono text-nano uppercase tracking-wide px-2 py-0.5 rounded-ui border-2 border-accentDeep text-accentDeep">
                Hidden
              </span>
            )}
          </div>
          <p className="font-mono text-label text-ink2 mt-0.5">
            {tool.category?.name} · {tool.clicks} click{tool.clicks === 1 ? "" : "s"}
            {tool.affiliateNetwork ? ` · ${tool.affiliateNetwork}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to={`/tools/${tool.slug}`} target="_blank" aria-label={`View ${tool.name}`}
            className="grid place-items-center w-11 h-11 rounded-full border-2 border-ink hover:bg-paper2 transition-colors">
            <ExternalLink size={15} aria-hidden="true" />
          </Link>
          <button onClick={onToggle} aria-expanded={open}
            className="inline-flex items-center min-h-touch font-mono text-label uppercase tracking-wide border-2 border-ink rounded-ui px-4 hover:bg-paper2 transition-colors">
            {open ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t-2 border-ink p-4 space-y-4">
          <div>
            <label htmlFor={`aff-${tool.id}`} className={label}>Affiliate link · where the buttons send people</label>
            <input id={`aff-${tool.id}`} className={field} value={form.affiliateLink || ""} onChange={set("affiliateLink")}
              placeholder="https://…?via=toolhaven — blank falls back to the website URL" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`net-${tool.id}`} className={label}>Network</label>
              <input id={`net-${tool.id}`} className={field} value={form.affiliateNetwork || ""} onChange={set("affiliateNetwork")}
                placeholder="PartnerStack, Impact…" />
            </div>
            <div>
              <label htmlFor={`web-${tool.id}`} className={label}>Website URL</label>
              <input id={`web-${tool.id}`} className={field} value={form.websiteUrl || ""} onChange={set("websiteUrl")} />
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor={`pt-${tool.id}`} className={label}>Pricing</label>
              <select id={`pt-${tool.id}`} className={field} value={form.priceType || ""} onChange={set("priceType")}>
                {["free", "freemium", "paid", "subscription"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`pmin-${tool.id}`} className={label}>Min $/mo</label>
              <input id={`pmin-${tool.id}`} type="number" min="0" className={field}
                value={form.priceMin ?? ""} onChange={set("priceMin")} />
            </div>
            <div>
              <label htmlFor={`pmax-${tool.id}`} className={label}>Max $/mo</label>
              <input id={`pmax-${tool.id}`} type="number" min="0" className={field}
                value={form.priceMax ?? ""} onChange={set("priceMax")} />
            </div>
            <div>
              <label htmlFor={`rate-${tool.id}`} className={label}>Rating</label>
              <input id={`rate-${tool.id}`} type="number" min="0" max="5" step="0.1" className={field}
                value={form.rating ?? ""} onChange={set("rating")} />
            </div>
          </div>

          <div>
            <label htmlFor={`bf-${tool.id}`} className={label}>Best for</label>
            <input id={`bf-${tool.id}`} className={field} value={form.bestFor || ""} onChange={set("bestFor")} />
          </div>
          <div>
            <label htmlFor={`cav-${tool.id}`} className={label}>The catch</label>
            <textarea id={`cav-${tool.id}`} rows={2} className={field} value={form.caveat || ""} onChange={set("caveat")} />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {[["freeTrial", "Free trial"], ["freeTier", "Free tier"], ["isFeatured", "Featured"], ["isActive", "Visible"]].map(([k, l]) => (
              <label key={k} className="inline-flex items-center gap-2 min-h-touch cursor-pointer select-none">
                <input type="checkbox" checked={!!form[k]} onChange={set(k)} className="w-4 h-4 accent-accent cursor-pointer" />
                <span className="font-mono text-label uppercase tracking-wide">{l}</span>
              </label>
            ))}
          </div>

          {error && <p className="font-mono text-sm text-accentDeep">{error}</p>}
          <button onClick={save} disabled={status === "saving"} className="stamp text-xs disabled:opacity-60">
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save"}
          </button>
        </div>
      )}

      {open && <ScoreEditor tool={tool} token={token} />}
      {open && <ExternalEditor tool={tool} token={token} />}
      {open && <FactsEditor tool={tool} token={token} />}
      {open && <VerdictEditor tool={tool} token={token} />}
      {open && <AlternativesEditor tool={tool} token={token} allTools={allTools} />}
    </div>
  );
}

/* ── The outbound board ─────────────────────────────────────────────────── */

export function ClicksAdmin({ token }) {
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setError("");
      try { setStats(await getClickStats(token, days)); }
      catch (e) { setError(e?.response?.data?.error || "Couldn't load the click data."); }
    })();
  }, [token, days]);

  if (error) return <p className="font-mono text-sm text-accentDeep">{error}</p>;
  if (!stats) return <p className="text-ink2">Loading…</p>;

  const top = stats.byTool[0]?.clicks || 1;
  const lost = stats.byTool.filter((t) => !t.monetised).reduce((n, t) => n + t.clicks, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span>
            <span className="font-display text-3xl font-semibold tabular-nums">{stats.inRange}</span>
            <span className="font-mono text-label uppercase tracking-wide text-ink2 ml-2">clicks · {stats.days}d</span>
          </span>
          <span>
            <span className="font-display text-3xl font-semibold tabular-nums">{stats.total}</span>
            <span className="font-mono text-label uppercase tracking-wide text-ink2 ml-2">all time</span>
          </span>
          {lost > 0 && (
            <span>
              <span className="font-display text-3xl font-semibold tabular-nums text-accent">{lost}</span>
              <span className="font-mono text-label uppercase tracking-wide text-accentDeep ml-2">unmonetised</span>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`inline-flex items-center min-h-touch font-mono text-label uppercase tracking-wide border-2 border-ink rounded-ui px-3 transition-colors ${
                days === d ? "bg-ink text-paper" : "bg-paper hover:bg-paper2"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {stats.inRange === 0 ? (
        <p className="text-ink2 text-pretty max-w-measure">
          No outbound clicks recorded in this window yet. Every "Get it" and "Try" button logs one, so this fills in as
          traffic arrives.
        </p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-8">
          <section>
            <h3 className="font-mono text-label uppercase tracking-[.2em] text-accentDeep mb-3">By tool</h3>
            <ul className="space-y-2">
              {stats.byTool.map((t) => (
                <li key={t.toolId} className="flex items-center gap-3">
                  <span className="font-mono text-xs tabular-nums w-10 shrink-0 text-right">{t.clicks}</span>
                  <span className="flex-1 min-w-0 h-6 bg-paper2 rounded-tight overflow-hidden relative">
                    <span className={`block h-full ${t.monetised ? "bg-ink/70" : "bg-accent/60"}`}
                      style={{ width: `${Math.max(4, (t.clicks / top) * 100)}%` }} />
                    <span className="absolute inset-0 flex items-center px-2 text-xs truncate">{t.name}</span>
                  </span>
                  {!t.monetised && (
                    <span className="font-mono text-nano uppercase text-accentDeep shrink-0">no link</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-mono text-label uppercase tracking-[.2em] text-accentDeep mb-3">
              Which page sent them
            </h3>
            <ul className="space-y-1.5 mb-8">
              {stats.byReferrer.map((r) => (
                <li key={r.page} className="flex items-center justify-between gap-3 border-b border-ink/15 py-1.5">
                  <span className="font-mono text-xs truncate">{r.page}</span>
                  <span className="font-mono text-xs tabular-nums shrink-0">{r.clicks}</span>
                </li>
              ))}
            </ul>

            <h3 className="font-mono text-label uppercase tracking-[.2em] text-accentDeep mb-3">By category</h3>
            <ul className="space-y-1.5">
              {stats.byCategory.map((c) => (
                <li key={c.categoryId ?? "none"} className="flex items-center gap-2.5 border-b border-ink/15 py-1.5">
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: c.color || "#6A5F52" }} />
                  <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
                  <span className="font-mono text-xs tabular-nums shrink-0">{c.clicks}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

/* ── Verified facts ───────────────────────────────────────────────────────
 * Where a statistic gets a source and a date attached, or doesn't get
 * published. The form makes the source field required-looking for vendor and
 * third-party claims because those are the ones a reader can't otherwise
 * check — and the server rejects them anyway if the source is missing.
 */
const FACT_KINDS = [
  ["official", "Vendor's own figure"],
  ["external", "Third-party platform"],
  ["community", "Toolhaven readers"],
  ["editorial", "Toolhaven judgement"],
];

const today = () => new Date().toISOString().slice(0, 10);

export function FactsEditor({ tool, token }) {
  const [rows, setRows] = useState(() =>
    (tool.facts || []).map((f) => ({
      kind: f.kind || "official",
      label: f.label || "",
      value: f.value || "",
      sourceName: f.sourceName || "",
      sourceUrl: f.sourceUrl || "",
      verifiedAt: f.verifiedAt ? String(f.verifiedAt).slice(0, 10) : today(),
    })));
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  const patch = (i, k, v) => setRows((p) => p.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  const add = () => setRows((p) => [...p, {
    kind: "official", label: "", value: "", sourceName: "", sourceUrl: "", verifiedAt: today(),
  }]);

  const save = async () => {
    setStatus("saving"); setError("");
    try {
      const res = await saveToolFacts(tool.id, rows, token);
      setStatus("saved");
      setTimeout(() => setStatus(null), 2200);
      return res;
    } catch (e) {
      setStatus("error");
      setError(e?.response?.data?.error || "Couldn't save the facts.");
    }
  };

  return (
    <div className="border-t-2 border-ink p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-label uppercase tracking-[.14em] text-accentDeep">
          Verified facts · social proof
        </p>
        <p className="font-mono text-label uppercase tracking-wide text-ink2">
          {rows.length || "none"}
        </p>
      </div>

      <p className="text-sm text-ink2 text-pretty">
        Vendor and third-party claims need a source URL — they're the ones a reader can't check for
        themselves. Anything without one is refused rather than published.
      </p>

      {rows.map((r, i) => (
        <div key={i} className="border-2 border-ink rounded-card bg-paper2/30 p-3 space-y-3">
          <div className="flex items-start gap-2">
            <div className="grid sm:grid-cols-3 gap-2 flex-1 min-w-0">
              <div>
                <label htmlFor={`fk-${tool.id}-${i}`} className={label}>Kind</label>
                <select id={`fk-${tool.id}-${i}`} className={field}
                  value={r.kind} onChange={(e) => patch(i, "kind", e.target.value)}>
                  {FACT_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`fl-${tool.id}-${i}`} className={label}>Label</label>
                <input id={`fl-${tool.id}-${i}`} className={field} placeholder="Integrations"
                  value={r.label} onChange={(e) => patch(i, "label", e.target.value)} />
              </div>
              <div>
                <label htmlFor={`fv-${tool.id}-${i}`} className={label}>Value</label>
                <input id={`fv-${tool.id}-${i}`} className={field} placeholder="3,000+"
                  value={r.value} onChange={(e) => patch(i, "value", e.target.value)} />
              </div>
            </div>
            <button onClick={() => setRows((p) => p.filter((_, n) => n !== i))}
              aria-label={`Remove fact ${i + 1}`}
              className="grid place-items-center w-10 h-10 shrink-0 mt-6 rounded-full border-2 border-ink text-accentDeep hover:bg-paper2 transition-colors">
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-2">
            <div>
              <label htmlFor={`fs-${tool.id}-${i}`} className={label}>Source name</label>
              <input id={`fs-${tool.id}-${i}`} className={field} placeholder="Make"
                value={r.sourceName} onChange={(e) => patch(i, "sourceName", e.target.value)} />
            </div>
            <div>
              <label htmlFor={`fu-${tool.id}-${i}`} className={label}>
                Source URL{(r.kind === "official" || r.kind === "external") ? " · required" : ""}
              </label>
              <input id={`fu-${tool.id}-${i}`} className={field} placeholder="https://…"
                value={r.sourceUrl} onChange={(e) => patch(i, "sourceUrl", e.target.value)} />
            </div>
            <div>
              <label htmlFor={`fd-${tool.id}-${i}`} className={label}>Verified on</label>
              <input id={`fd-${tool.id}-${i}`} type="date" className={field}
                value={r.verifiedAt} onChange={(e) => patch(i, "verifiedAt", e.target.value)} />
            </div>
          </div>
        </div>
      ))}

      {error && <p className="font-mono text-sm text-accentDeep">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={add}
          className="inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide border-2 border-ink rounded-ui px-4 hover:bg-paper2 transition-colors">
          <Plus size={13} aria-hidden="true" /> Add a fact
        </button>
        <button onClick={save} disabled={status === "saving"} className="stamp text-xs disabled:opacity-60">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save facts"}
        </button>
      </div>
    </div>
  );
}

/* ── External ratings ─────────────────────────────────────────────────────
 * Where third-party ratings are entered — by a human who has actually opened
 * the page and read the number. The source URL is mandatory and enforced by
 * the server, because a rating a reader cannot go and check is exactly the
 * kind of borrowed authority this platform is supposed to be an antidote to.
 */
const today2 = () => new Date().toISOString().slice(0, 10);

export function ExternalEditor({ tool, token }) {
  const [rows, setRows] = useState(() =>
    (tool.externalRatings || []).map((r) => ({
      sourceName: r.sourceName || "",
      sourceUrl: r.sourceUrl || "",
      rating: r.rating ?? "",
      maxRating: r.maxRating ?? 5,
      reviewCount: r.reviewCount ?? "",
      retrievedAt: r.retrievedAt ? String(r.retrievedAt).slice(0, 10) : today2(),
      summary: r.summary || "",
    })));
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  const patch = (i, k, v) => setRows((p) => p.map((r, n) => (n === i ? { ...r, [k]: v } : r)));

  const save = async () => {
    setStatus("saving"); setError("");
    try {
      await saveExternalRatings(tool.id, rows, token);
      setStatus("saved");
      setTimeout(() => setStatus(null), 2200);
    } catch (e) {
      setStatus("error");
      setError(e?.response?.data?.error || "Couldn't save the ratings.");
    }
  };

  const total = rows.reduce((n, r) => n + (Number(r.reviewCount) || 0), 0);

  return (
    <div className="border-t-2 border-ink p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-label uppercase tracking-[.14em] text-accentDeep">
          External ratings · G2, Capterra, Trustpilot
        </p>
        {rows.length > 0 && (
          <p className="font-mono text-label uppercase tracking-wide text-ink2 tabular-nums">
            {rows.length} source{rows.length === 1 ? "" : "s"} · {total.toLocaleString()} reviews
          </p>
        )}
      </div>

      <p className="text-sm text-ink2 text-pretty">
        Open the platform, read the figure, enter it with the link. The source URL is required — the server
        refuses a rating nobody can check. Confidence, small-sample flags and platform disagreement are all
        worked out from what you enter here.
      </p>

      {rows.map((r, i) => (
        <div key={i} className="border-2 border-ink rounded-card bg-paper2/30 p-3 space-y-3">
          <div className="flex items-start gap-2">
            <div className="grid sm:grid-cols-4 gap-2 flex-1 min-w-0">
              <div>
                <label htmlFor={`xs-${tool.id}-${i}`} className={label}>Platform</label>
                <input id={`xs-${tool.id}-${i}`} className={field} placeholder="G2"
                  value={r.sourceName} onChange={(e) => patch(i, "sourceName", e.target.value)} />
              </div>
              <div>
                <label htmlFor={`xr-${tool.id}-${i}`} className={label}>Rating</label>
                <input id={`xr-${tool.id}-${i}`} type="number" step="0.1" min="0" className={field} placeholder="4.8"
                  value={r.rating} onChange={(e) => patch(i, "rating", e.target.value)} />
              </div>
              <div>
                <label htmlFor={`xm-${tool.id}-${i}`} className={label}>Out of</label>
                <input id={`xm-${tool.id}-${i}`} type="number" step="1" min="1" className={field}
                  value={r.maxRating} onChange={(e) => patch(i, "maxRating", e.target.value)} />
              </div>
              <div>
                <label htmlFor={`xc-${tool.id}-${i}`} className={label}>Reviews</label>
                <input id={`xc-${tool.id}-${i}`} type="number" min="0" className={field} placeholder="71"
                  value={r.reviewCount} onChange={(e) => patch(i, "reviewCount", e.target.value)} />
              </div>
            </div>
            <button onClick={() => setRows((p) => p.filter((_, n) => n !== i))}
              aria-label={`Remove ${r.sourceName || "rating"}`}
              className="grid place-items-center w-10 h-10 shrink-0 mt-6 rounded-full border-2 border-ink text-accentDeep hover:bg-paper2 transition-colors">
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label htmlFor={`xu-${tool.id}-${i}`} className={label}>Source URL · required</label>
              <input id={`xu-${tool.id}-${i}`} className={field} placeholder="https://www.g2.com/products/…"
                value={r.sourceUrl} onChange={(e) => patch(i, "sourceUrl", e.target.value)} />
            </div>
            <div>
              <label htmlFor={`xd-${tool.id}-${i}`} className={label}>Checked on</label>
              <input id={`xd-${tool.id}-${i}`} type="date" className={field}
                value={r.retrievedAt} onChange={(e) => patch(i, "retrievedAt", e.target.value)} />
            </div>
          </div>
        </div>
      ))}

      {error && <p className="font-mono text-sm text-accentDeep">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setRows((p) => [...p, {
          sourceName: "", sourceUrl: "", rating: "", maxRating: 5, reviewCount: "", retrievedAt: today2(), summary: "",
        }])}
          className="inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide border-2 border-ink rounded-ui px-4 hover:bg-paper2 transition-colors">
          <Plus size={13} aria-hidden="true" /> Add a platform
        </button>
        <button onClick={save} disabled={status === "saving"} className="stamp text-xs disabled:opacity-60">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save ratings"}
        </button>
      </div>
    </div>
  );
}

/* ── The editorial verdict ────────────────────────────────────────────────
 * The judgement fields: who a tool suits, who it does not, what the bill
 * really looks like, how hard it is to leave, and whether the company's own
 * headline claim survives contact with the evidence.
 *
 * Everything here is optional. A blank field publishes nothing at all, which
 * is the right output for a tool nobody has sat down with yet — the reader
 * sees no section rather than an empty one implying an absence of downsides.
 */
const SWITCHING_OPTS = [["", "Not assessed"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]];
const CLAIM_OPTS = [
  ["", "No verdict yet"],
  ["supported", "Supported"],
  ["partly-supported", "Partly supported"],
  ["unsupported", "Not supported by the evidence"],
  ["untested", "Not yet tested"],
];

// The five list fields are entered one item per line: quicker than a row of
// add/remove buttons for text this short, and it survives a paste.
const toLines = (a) => (a || []).join("\n");
const fromLines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

export function VerdictEditor({ tool, token }) {
  const v = tool.verdict || {};
  const [f, setF] = useState({
    bestFor: toLines(v.bestFor),
    notIdealFor: toLines(v.notIdealFor),
    loveIf: toLines(v.loveIf),
    regretIf: toLines(v.regretIf),
    costNotes: toLines(v.costNotes),
    switchingCost: v.switchingCost || "",
    switchingNote: v.switchingNote || "",
    companyClaim: v.companyClaim || "",
    claimEvidence: v.claimEvidence || "",
    claimVerdict: v.claimVerdict || "",
    biggestStrength: v.biggestStrength || "",
    biggestTradeoff: v.biggestTradeoff || "",
    valueAssessment: v.valueAssessment || "",
    finalVerdict: v.finalVerdict || "",
    reviewedBy: v.reviewedBy || "",
  });
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const id = (k) => "vd-" + tool.id + "-" + k;

  const save = async () => {
    setStatus("saving"); setError("");
    try {
      await saveToolVerdict(tool.id, {
        ...f,
        bestFor: fromLines(f.bestFor),
        notIdealFor: fromLines(f.notIdealFor),
        loveIf: fromLines(f.loveIf),
        regretIf: fromLines(f.regretIf),
        costNotes: fromLines(f.costNotes),
      }, token);
      setStatus("saved");
      setTimeout(() => setStatus(null), 2200);
    } catch (e) {
      setStatus("error");
      setError(e?.response?.data?.error || "Couldn't save the verdict.");
    }
  };

  return (
    <div className="border-t-2 border-ink p-4 space-y-4">
      <p className="font-mono text-label uppercase tracking-[.14em] text-accentDeep">Editorial verdict</p>
      <p className="text-sm text-ink2 text-pretty">
        Leave anything blank and it will not appear on the page. Write what you actually concluded —
        the value of this section is that it says the unflattering parts out loud.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <LinesField id={id("bestFor")} title="Best for" value={f.bestFor} onChange={set("bestFor")}
          hint="Teams automating repetitive admin" />
        <LinesField id={id("notIdealFor")} title="Not ideal for" value={f.notIdealFor} onChange={set("notIdealFor")}
          hint="Anyone who needs offline access" />
        <LinesField id={id("loveIf")} title="They will love it if" value={f.loveIf} onChange={set("loveIf")}
          hint="You think in flowcharts" />
        <LinesField id={id("regretIf")} title="They might regret it if" value={f.regretIf} onChange={set("regretIf")}
          hint="Your workflows outgrow the free tier fast" />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <LinesField id={id("costNotes")} title="Cost considerations" value={f.costNotes} onChange={set("costNotes")}
          hint="Extra seats billed per user, per month" />
        <div className="space-y-3">
          <div>
            <label htmlFor={id("switchingCost")} className={label}>Switching difficulty</label>
            <select id={id("switchingCost")} className={field} value={f.switchingCost} onChange={set("switchingCost")}>
              {SWITCHING_OPTS.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={id("switchingNote")} className={label}>Why (optional)</label>
            <textarea id={id("switchingNote")} rows={3} className={field + " resize-y"}
              value={f.switchingNote} onChange={set("switchingNote")}
              placeholder="Scenarios export as JSON, so most of the work is portable." />
          </div>
        </div>
      </div>

      <div className="border-2 border-ink rounded-card bg-paper2/30 p-3 space-y-3">
        <p className="font-mono text-label uppercase tracking-[.14em] text-ink2">Reality check</p>
        <div>
          <label htmlFor={id("companyClaim")} className={label}>What the company claims</label>
          <input id={id("companyClaim")} className={field} value={f.companyClaim} onChange={set("companyClaim")}
            placeholder="Automate anything without writing code." />
        </div>
        <div>
          <label htmlFor={id("claimEvidence")} className={label}>What the evidence shows</label>
          <textarea id={id("claimEvidence")} rows={3} className={field + " resize-y"}
            value={f.claimEvidence} onChange={set("claimEvidence")}
            placeholder="True for common integrations; anything custom still needs an API key." />
        </div>
        <div>
          <label htmlFor={id("claimVerdict")} className={label}>Verdict on the claim</label>
          <select id={id("claimVerdict")} className={field} value={f.claimVerdict} onChange={set("claimVerdict")}>
            {CLAIM_OPTS.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={id("biggestStrength")} className={label}>Biggest strength</label>
          <input id={id("biggestStrength")} className={field} value={f.biggestStrength} onChange={set("biggestStrength")} />
        </div>
        <div>
          <label htmlFor={id("biggestTradeoff")} className={label}>Biggest trade-off</label>
          <input id={id("biggestTradeoff")} className={field} value={f.biggestTradeoff} onChange={set("biggestTradeoff")} />
        </div>
      </div>

      <div>
        <label htmlFor={id("valueAssessment")} className={label}>Is it worth the money?</label>
        <textarea id={id("valueAssessment")} rows={3} className={field + " resize-y"}
          value={f.valueAssessment} onChange={set("valueAssessment")} />
      </div>

      <div>
        <label htmlFor={id("finalVerdict")} className={label}>Final verdict</label>
        <textarea id={id("finalVerdict")} rows={4} className={field + " resize-y"}
          value={f.finalVerdict} onChange={set("finalVerdict")} />
      </div>

      <div className="sm:max-w-xs">
        <label htmlFor={id("reviewedBy")} className={label}>Assessed by</label>
        <input id={id("reviewedBy")} className={field} value={f.reviewedBy} onChange={set("reviewedBy")}
          placeholder="The Toolhaven editors" />
      </div>

      {error && <p className="font-mono text-sm text-accentDeep">{error}</p>}

      <button onClick={save} disabled={status === "saving"} className="stamp text-xs disabled:opacity-60">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save verdict"}
      </button>
    </div>
  );
}

// Declared at module level on purpose: an inner component would be a new type
// on every keystroke, so React would unmount the textarea and the caret would
// jump to the end mid-sentence.
function LinesField({ id, title, value, onChange, hint }) {
  return (
    <div>
      <label htmlFor={id} className={label}>{title}</label>
      <textarea id={id} rows={4} className={field + " resize-y"}
        value={value} onChange={onChange} placeholder={hint} />
      <p className="font-mono text-nano uppercase tracking-wide text-ink2/70 mt-1">One per line</p>
    </div>
  );
}

/* ── Alternatives ─────────────────────────────────────────────────────────
 * A curated "if not this, then what" list. The reason field is mandatory and
 * the server enforces it: a bare list of rival names is just more links, and
 * the whole point of putting them on the page is telling a reader which one
 * answers the objection that brought them this far.
 */
export function AlternativesEditor({ tool, token, allTools }) {
  const [rows, setRows] = useState(() =>
    (tool.alternatives || []).map((a) => ({
      alternativeId: a.alternativeId || a.alternative?.id || a.id,
      reason: a.reason || "",
    })));
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  const chosen = new Set(rows.map((r) => Number(r.alternativeId)));
  const options = (allTools || [])
    .filter((t) => t.id !== tool.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const patch = (i, k, val) => setRows((p) => p.map((r, n) => (n === i ? { ...r, [k]: val } : r)));
  const add = () => setRows((p) => [...p, { alternativeId: "", reason: "" }]);

  const save = async () => {
    setStatus("saving"); setError("");
    try {
      await saveToolAlternatives(tool.id, rows.filter((r) => r.alternativeId), token);
      setStatus("saved");
      setTimeout(() => setStatus(null), 2200);
    } catch (e) {
      setStatus("error");
      setError(e?.response?.data?.error || "Couldn't save the alternatives.");
    }
  };

  return (
    <div className="border-t-2 border-ink p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-label uppercase tracking-[.14em] text-accentDeep">Alternatives</p>
        <p className="font-mono text-label uppercase tracking-wide text-ink2">{rows.length || "none"}</p>
      </div>
      <p className="text-sm text-ink2 text-pretty">
        The reason is what the reader actually reads — write it as the objection it answers,
        not as praise. Something like &ldquo;cheaper at small volumes&rdquo; or
        &ldquo;better if you need on-premise hosting&rdquo;.
      </p>

      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="grid sm:grid-cols-2 gap-2 flex-1 min-w-0">
            <div>
              <label htmlFor={"alt-" + tool.id + "-t-" + i} className={label}>Tool</label>
              <select id={"alt-" + tool.id + "-t-" + i} className={field}
                value={r.alternativeId} onChange={(e) => patch(i, "alternativeId", e.target.value)}>
                <option value="">Choose a tool…</option>
                {options.map((t) => (
                  <option key={t.id} value={t.id}
                    disabled={chosen.has(t.id) && Number(r.alternativeId) !== t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={"alt-" + tool.id + "-r-" + i} className={label}>Reason · required</label>
              <input id={"alt-" + tool.id + "-r-" + i} className={field} value={r.reason}
                onChange={(e) => patch(i, "reason", e.target.value)}
                placeholder="Cheaper if you only need one seat" />
            </div>
          </div>
          <button onClick={() => setRows((p) => p.filter((_, n) => n !== i))}
            aria-label={"Remove alternative " + (i + 1)}
            className="grid place-items-center w-10 h-10 shrink-0 mt-6 rounded-full border-2 border-ink text-accentDeep hover:bg-paper2 transition-colors">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}

      {error && <p className="font-mono text-sm text-accentDeep">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={add}
          className="inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide border-2 border-ink rounded-ui px-4 hover:bg-paper2 transition-colors">
          <Plus size={13} aria-hidden="true" /> Add an alternative
        </button>
        <button onClick={save} disabled={status === "saving"} className="stamp text-xs disabled:opacity-60">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save alternatives"}
        </button>
      </div>
    </div>
  );
}
