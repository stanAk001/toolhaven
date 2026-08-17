// The tools desk and the outbound-clicks board.
//
// Between them these answer the two questions the affiliate plan actually
// depends on: where does a tracking link go, and is the traffic we already send
// earning anything. The tools list leads with monetisation state for exactly
// that reason — a tool with clicks and no affiliate link is money on the floor,
// so it's flagged rather than left for you to notice.
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, ExternalLink, AlertTriangle } from "lucide-react";
import { listToolsAdmin, updateToolAdmin, getClickStats, saveToolScore, clearToolScore } from "../api/client.js";

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
        <p className="font-mono text-[11px] uppercase tracking-[.14em] text-accentDeep">
          Toolhaven Score · leave blank to not score a dimension
        </p>
        {preview && (
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink2">
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
            className="inline-flex items-center min-h-touch font-mono text-[11px] uppercase tracking-wide border-2 border-ink rounded-full px-4 text-accentDeep hover:bg-paper2 transition-colors">
            Withdraw score
          </button>
        )}
      </div>
    </div>
  );
}

const field = "w-full border-2 border-ink rounded-xl bg-paper px-3 py-2.5 outline-none focus:border-accent transition-colors";
const label = "block font-mono text-[11px] uppercase tracking-[.14em] text-ink2 mb-1.5";

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
        <div className="flex items-start gap-3 border-2 border-ink rounded-2xl bg-accent/10 p-4 mb-5">
          <AlertTriangle size={18} className="text-accentDeep shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-pretty">
            <strong>{unmonetised.length} tool{unmonetised.length === 1 ? "" : "s"} already sending clicks with no affiliate link.</strong>{" "}
            Those visits go out on the plain website URL and earn nothing —{" "}
            {unmonetised.slice(0, 4).map((t) => t.name).join(", ")}
            {unmonetised.length > 4 ? ` and ${unmonetised.length - 4} more` : ""}.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 border-2 border-ink rounded-full px-4 mb-5 bg-paper">
        <Search size={16} strokeWidth={2.5} aria-hidden="true" className="text-accentDeep shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools…"
          aria-label="Search tools" className="flex-1 min-w-0 bg-transparent outline-none min-h-touch" />
        <span className="font-mono text-[11px] text-ink2 shrink-0">{shown.length}</span>
      </div>

      {error && <p className="font-mono text-sm text-accentDeep mb-4">{error}</p>}
      {loading && <p className="text-ink2">Loading…</p>}

      <div className="space-y-3">
        {shown.map((t) => (
          <ToolRow key={t.id} tool={t} token={token}
            open={openId === t.id}
            onToggle={() => setOpenId(openId === t.id ? null : t.id)}
            onSaved={(updated) => setTools((p) => p.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))} />
        ))}
      </div>
    </div>
  );
}

function ToolRow({ tool, token, open, onToggle, onSaved }) {
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
    <div className="border-2 border-ink rounded-2xl bg-paper" style={{ boxShadow: "4px 4px 0 var(--shadow-cast)" }}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span aria-hidden="true"
          className="w-10 h-10 grid place-items-center rounded-lg border-2 border-ink font-display font-bold text-sm text-white shrink-0"
          style={{ background: tool.category?.colorPrimary || "#1C1714" }}>
          {tool.logoMono || tool.name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-semibold leading-tight">{tool.name}</span>
            {tool.affiliateLink ? (
              <span className="font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border-2 border-green-700 text-green-700">
                Monetised
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border-2 border-ink/40 text-ink2">
                No link
              </span>
            )}
            {!tool.isActive && (
              <span className="font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border-2 border-accentDeep text-accentDeep">
                Hidden
              </span>
            )}
          </div>
          <p className="font-mono text-[11px] text-ink2 mt-0.5">
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
            className="inline-flex items-center min-h-touch font-mono text-[11px] uppercase tracking-wide border-2 border-ink rounded-full px-4 hover:bg-paper2 transition-colors">
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
                <span className="font-mono text-[11px] uppercase tracking-wide">{l}</span>
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
            <span className="font-mono text-[11px] uppercase tracking-wide text-ink2 ml-2">clicks · {stats.days}d</span>
          </span>
          <span>
            <span className="font-display text-3xl font-semibold tabular-nums">{stats.total}</span>
            <span className="font-mono text-[11px] uppercase tracking-wide text-ink2 ml-2">all time</span>
          </span>
          {lost > 0 && (
            <span>
              <span className="font-display text-3xl font-semibold tabular-nums text-accent">{lost}</span>
              <span className="font-mono text-[11px] uppercase tracking-wide text-accentDeep ml-2">unmonetised</span>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`inline-flex items-center min-h-touch font-mono text-[11px] uppercase tracking-wide border-2 border-ink rounded-full px-3 transition-colors ${
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
            <h3 className="font-mono text-[11px] uppercase tracking-[.2em] text-accentDeep mb-3">By tool</h3>
            <ul className="space-y-2">
              {stats.byTool.map((t) => (
                <li key={t.toolId} className="flex items-center gap-3">
                  <span className="font-mono text-xs tabular-nums w-10 shrink-0 text-right">{t.clicks}</span>
                  <span className="flex-1 min-w-0 h-6 bg-paper2 rounded-sm overflow-hidden relative">
                    <span className={`block h-full ${t.monetised ? "bg-ink/70" : "bg-accent/60"}`}
                      style={{ width: `${Math.max(4, (t.clicks / top) * 100)}%` }} />
                    <span className="absolute inset-0 flex items-center px-2 text-xs truncate">{t.name}</span>
                  </span>
                  {!t.monetised && (
                    <span className="font-mono text-[10px] uppercase text-accentDeep shrink-0">no link</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-mono text-[11px] uppercase tracking-[.2em] text-accentDeep mb-3">
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

            <h3 className="font-mono text-[11px] uppercase tracking-[.2em] text-accentDeep mb-3">By category</h3>
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
