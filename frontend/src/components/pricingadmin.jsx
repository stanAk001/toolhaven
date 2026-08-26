/**
 * The pricing desk.
 *
 * Built around the two questions an operator actually has: what needs my
 * attention, and what did the crawler get wrong. Everything else — the full
 * catalogue, the logs, the history — is one click away rather than on screen
 * competing for it.
 *
 * The rule the interface enforces is that a person outranks the crawler.
 * Approving, rejecting or correcting a price marks the tool as overridden, and
 * from then on the automation reports but does not overwrite.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Check, X, AlertTriangle, Search, ExternalLink, Lock } from "lucide-react";
import {
  listPricingAdmin, verifyPricing, runPricingSweep, getPricingLogs,
  approvePricing, rejectPricing, overridePricing, clearPricingOverride,
} from "../api/client.js";

const field = "w-full border-2 border-ink rounded-card bg-paper px-3 py-2.5 outline-none focus:border-accent transition-colors";
const label = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";

const STATUS_TONE = {
  verified: "border-green-700 text-green-700",
  custom_pricing: "border-ink text-ink",
  partially_verified: "border-accentDeep text-accentDeep",
  unverified: "border-accentDeep text-accentDeep",
  unavailable: "border-ink/40 text-ink2",
};
const STATUS_LABEL = {
  verified: "Verified",
  custom_pricing: "Custom pricing",
  partially_verified: "Partly verified",
  unverified: "Unverified",
  unavailable: "Unavailable",
};

const money = (v, cur) => (v === null || v === undefined ? "—"
  : v === 0 ? "Free"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "USD", maximumFractionDigits: 2 }).format(v));

const when = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "never");

function StatusChip({ status, score }) {
  if (!status) return <span className="font-mono text-label uppercase tracking-wide text-ink2">not checked</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-nano uppercase tracking-[.12em] px-2 py-1 rounded-ui border-2 tabular-nums ${STATUS_TONE[status] || STATUS_TONE.unavailable}`}>
      {STATUS_LABEL[status] || status}
      {score !== null && score !== undefined && <span className="opacity-70">{Math.round(score * 100)}%</span>}
    </span>
  );
}

/** A price that moved. The one thing on this page that is genuinely news. */
function ChangeFlag({ change }) {
  if (!change) return null;
  const up = change.percentChange !== null && change.percentChange > 0;
  return (
    // Marked by an icon and a rule, not by a second bordered card sitting
    // inside the first. The row already carries its own edge.
    <div className="flex items-start gap-2.5 border-l-2 border-accent pl-3 py-1 mt-3">
      <AlertTriangle size={15} className="text-accentDeep shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-sm text-pretty">
        <strong className="font-semibold">Price changed.</strong>{" "}
        {change.summary}
        {change.percentChange !== null && (
          <span className="font-mono text-xs tabular-nums ml-1">
            ({up ? "+" : ""}{change.percentChange}%)
          </span>
        )}
        <span className="font-mono text-label uppercase tracking-wide text-ink2 ml-2">
          {when(change.detectedAt)}
        </span>
      </p>
    </div>
  );
}

export function PricingAdmin({ token }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [worker, setWorker] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("attention");
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const d = await listPricingAdmin(token);
      setRows(d.items || []); setSummary(d.summary || null); setWorker(d.worker || null);
    } catch (e) {
      setError(e?.response?.data?.error || "Couldn't load the pricing desk.");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !r.name.toLowerCase().includes(term)) return false;
      if (filter === "attention") return r.pendingReview || r.recentChange || r.consecutiveFailures >= 3;
      if (filter === "published") return r.published;
      if (filter === "unchecked") return r.published && !r.isManualOverride;
      if (filter === "overrides") return r.isManualOverride;
      if (filter === "failing") return r.consecutiveFailures >= 3 || (!r.hasWebsite);
      return true;
    });
  }, [rows, q, filter]);

  const act = async (id, fn) => {
    setBusy(id); setError("");
    try { await fn(); await load(); }
    catch (e) { setError(e?.response?.data?.error || "That didn't work."); }
    finally { setBusy(null); }
  };

  const sweep = () => act("sweep", () => runPricingSweep(token, 5));

  const TABS = [
    ["attention", "Needs attention", summary ? summary.pendingReview + summary.changesToReview : 0],
    ["published", "Live on the site", summary?.published ?? 0],
    // The queue that matters after a first crawl: prices the automation is
    // confident about that no person has yet laid eyes on.
    ["unchecked", "Not yet eyeballed", rows.filter((r) => r.published && !r.isManualOverride).length],
    ["overrides", "Set by hand", summary?.overrides ?? 0],
    ["failing", "Not working", summary?.failing ?? 0],
    ["all", "Everything", summary?.total ?? 0],
  ];

  return (
    <div>
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            ["Live on the site", summary.published],
            ["Waiting on you", summary.pendingReview],
            ["Never checked", summary.neverChecked],
            ["Set by hand", summary.overrides],
          ].map(([k, v]) => (
            <div key={k} className="border-2 border-ink rounded-card bg-paper p-3">
              <p className="font-display text-2xl font-semibold tabular-nums leading-none">{v}</p>
              <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mt-1">{k}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map(([key, text, count]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide border-2 border-ink rounded-ui px-4 transition-colors ${filter === key ? "bg-ink text-paper" : "hover:bg-paper2"}`}>
            {text}<span className="tabular-nums opacity-70">{count}</span>
          </button>
        ))}
        <button onClick={sweep} disabled={busy === "sweep"}
          className="ml-auto inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-wide border-2 border-ink rounded-ui px-4 hover:bg-paper2 transition-colors disabled:opacity-60">
          <RefreshCw size={13} aria-hidden="true" className={busy === "sweep" ? "animate-spin" : ""} />
          {busy === "sweep" ? "Checking…" : "Check what's due"}
        </button>
      </div>

      {worker && (
        <p className="font-mono text-label uppercase tracking-wide text-ink2 mb-4">
          Background checks: {worker.checked} done, {worker.published} publishable, {worker.failed} failed
          {worker.lastRunAt ? " · last ran " + new Date(worker.lastRunAt).toLocaleTimeString() : " · not run yet"}
        </p>
      )}

      <div className="flex items-center gap-3 border-2 border-ink rounded-ui px-4 mb-5 bg-paper">
        <Search size={16} strokeWidth={2.5} aria-hidden="true" className="text-accentDeep shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools…"
          aria-label="Search tools" className="flex-1 min-w-0 bg-transparent outline-none min-h-touch" />
        <span className="font-mono text-label text-ink2 shrink-0">{shown.length}</span>
      </div>

      {error && <p className="font-mono text-sm text-accentDeep mb-4">{error}</p>}
      {loading && <p className="text-ink2">Loading…</p>}
      {!loading && shown.length === 0 && (
        <p className="text-ink2 border-2 border-dashed border-ink/30 rounded-card px-6 py-10 text-center text-pretty">
          Nothing here. {filter === "attention" ? "Every price is either verified or honestly marked unavailable."
            : filter === "unchecked" ? "Every published price has been through a person."
            : "Try another filter."}
        </p>
      )}

      <div className="space-y-3">
        {shown.map((r) => (
          <PricingRow key={r.id} row={r} token={token} busy={busy === r.id}
            open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)}
            onAct={(fn) => act(r.id, fn)} />
        ))}
      </div>
    </div>
  );
}

function PricingRow({ row, token, busy, open, onToggle, onAct }) {
  const [logs, setLogs] = useState(null);

  const loadLogs = async () => {
    if (logs) return;
    try { setLogs(await getPricingLogs(row.id, token)); } catch { setLogs({ logs: [], history: [] }); }
  };

  return (
    /* An operator's list, not a stack of posters.
       Every row used to be a heavy bordered card containing a second heavy
       bordered card, with three outlined buttons inside that — three levels of
       box for one tool, repeated forty-six times. The weight is carried by a
       single status bar down the left edge instead, so the eye can run down the
       column and see what needs attention without reading a word. */
    <div className="relative border border-ink/25 rounded-card bg-paper overflow-hidden">
      <span aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${
          row.pendingReview ? "bg-accent"
            : row.published ? "bg-green-700"
              : row.consecutiveFailures >= 3 ? "bg-ink/30" : "bg-ink/15"}`} />

      <div className="flex flex-wrap items-center gap-3 p-4 pl-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold leading-tight">{row.name}</h3>
            <StatusChip status={row.status} score={row.confidence} />
            {row.isManualOverride && (
              <span className="inline-flex items-center gap-1 font-mono text-nano uppercase tracking-[.12em] text-ink2 border-2 border-ink/30 rounded-ui px-2 py-0.5">
                <Lock size={10} aria-hidden="true" /> set by hand
              </span>
            )}
            {row.published && <span className="font-mono text-nano uppercase tracking-[.12em] text-green-700">live</span>}
          </div>
          <p className="font-mono text-label uppercase tracking-wide text-ink2 mt-1 tabular-nums">
            {money(row.startingPrice, row.currency)}
            {row.billingPeriod ? " / " + row.billingPeriod : ""}
            {row.planCount ? " · " + row.planCount + " plans" : ""}
            {" · checked " + when(row.lastAttemptedAt)}
            {row.nextVerificationAt ? " · next " + when(row.nextVerificationAt) : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onAct(() => verifyPricing(row.id, token, row.isManualOverride))}
            disabled={busy || !row.hasWebsite}
            title={row.hasWebsite ? "Check this tool's pricing page now" : "This tool has no website URL on record"}
            className="inline-flex items-center gap-2 min-h-touch sm:min-h-[34px] font-mono text-label uppercase tracking-wide border border-ink/40 rounded-ui px-3 hover:bg-paper2 hover:border-ink transition-colors disabled:opacity-50">
            <RefreshCw size={12} aria-hidden="true" className={busy ? "animate-spin" : ""} />
            {busy ? "Checking" : "Check now"}
          </button>
          <button onClick={() => { onToggle(); loadLogs(); }}
            className="inline-flex items-center min-h-touch sm:min-h-[34px] font-mono text-label uppercase tracking-wide border border-ink/40 rounded-ui px-3 hover:bg-paper2 hover:border-ink transition-colors">
            {open ? "Close" : "Open"}
          </button>
        </div>
      </div>

      {row.recentChange && <div className="px-4 pb-4"><ChangeFlag change={row.recentChange} /></div>}

      {/* The decision, asked as a question with one obvious answer and one
          obvious escape. A hairline and a tint mark it out rather than a second
          bordered card, and the two verbs carry the weight instead of three
          equally-loud outlined blocks. */}
      {row.pendingReview && (
        <div className="border-t border-ink/20 bg-accent/[.06] px-4 pl-5 py-3.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <p className="text-sm text-pretty min-w-0 flex-1">
              Read <strong className="font-semibold tabular-nums">
                {money(row.startingPrice, row.currency)}{row.billingPeriod ? "/" + row.billingPeriod : ""}
              </strong>, but not confidently enough to publish.
              {row.sourceUrl && (
                <>
                  {" "}
                  <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-accentDeep transition-colors">
                    Check their page <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </>
              )}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => onAct(() => approvePricing(row.id, token))} disabled={busy}
                className="inline-flex items-center gap-1.5 min-h-touch sm:min-h-[34px] font-mono text-label uppercase tracking-wide
                  bg-ink text-paper rounded-ui px-3.5 hover:bg-accentDeep transition-colors disabled:opacity-60">
                <Check size={13} aria-hidden="true" /> Publish
              </button>
              <button onClick={() => onAct(() => rejectPricing(row.id, token))} disabled={busy}
                className="inline-flex items-center gap-1.5 min-h-touch sm:min-h-[34px] font-mono text-label uppercase tracking-wide
                  text-ink2 rounded-ui px-3 hover:text-accentDeep hover:bg-paper2 transition-colors disabled:opacity-60">
                <X size={13} aria-hidden="true" /> Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {open && <RowDetail row={row} token={token} logs={logs} busy={busy} onAct={onAct} />}
    </div>
  );
}

const PERIODS = [["month", "per month"], ["year", "per year"], ["one-time", "one-off"], ["usage", "usage-based"]];
const MODELS = [["", "not set"], ["free", "free"], ["freemium", "freemium"], ["subscription", "subscription"],
  ["per-seat", "per seat"], ["usage", "usage-based"], ["one-time", "one-off"], ["custom", "custom / sales-led"]];

function RowDetail({ row, token, logs, busy, onAct }) {
  // The list request no longer carries every plan's source text; it arrives
  // with the logs when a row is actually opened.
  const plans = logs?.plans || [];
  const [f, setF] = useState({
    startingPrice: row.startingPrice ?? "",
    currency: row.currency || "USD",
    billingPeriod: row.billingPeriod || "month",
    pricingModel: row.pricingModel || "",
    freePlan: !!row.freePlan,
    freeTrial: !!row.freeTrial,
    pricingUrl: row.sourceUrl || "",
    note: row.overrideNote || "",
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const id = (k) => "pr-" + row.id + "-" + k;

  return (
    <div className="border-t-2 border-ink p-4 space-y-5">
      {plans.length > 0 && (
        <div>
          <p className="font-mono text-label uppercase tracking-[.14em] text-accentDeep mb-2">What we read</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-ink/15">
                  <th scope="col" className="text-left font-mono text-nano uppercase tracking-wide text-ink2 pb-1.5 pr-3">Plan</th>
                  <th scope="col" className="text-right font-mono text-nano uppercase tracking-wide text-ink2 pb-1.5 px-3">Price</th>
                  <th scope="col" className="text-left font-mono text-nano uppercase tracking-wide text-ink2 pb-1.5 pl-3">Read from</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p, i) => (
                  <tr key={p.name + i} className="border-b border-ink/10 last:border-0 align-top">
                    <th scope="row" className="text-left font-normal py-1.5 pr-3 whitespace-nowrap">{p.name}</th>
                    <td className="text-right tabular-nums py-1.5 px-3 whitespace-nowrap">
                      {p.isCustom ? "custom" : money(p.price, p.currency)}
                      {p.perUnit ? <span className="text-ink2"> /{p.perUnit}</span> : null}
                    </td>
                    <td className="text-left text-label text-ink2 py-1.5 pl-3 leading-snug">
                      {(p.rawText || "").slice(0, 90)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-mono text-nano uppercase tracking-wide text-ink2 mt-2">
            {row.extractionMethod || "no method"} · {row.sourceType || "no source"}
            {row.sourceUrl ? " · " : ""}
            {row.sourceUrl && <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">the page</a>}
          </p>
        </div>
      )}

      {row.reasons?.length > 0 && (
        <div>
          <p className="font-mono text-label uppercase tracking-[.14em] text-accentDeep mb-2">
            Why it scored {Math.round((row.confidence || 0) * 100)}%
          </p>
          <ul className="text-sm text-ink2 space-y-1">
            {row.reasons.map((x, i) => <li key={i} className="text-pretty">{x}</li>)}
          </ul>
        </div>
      )}

      <div className="border-2 border-ink rounded-card bg-paper2/30 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-label uppercase tracking-[.14em] text-ink2">Set it by hand</p>
          {row.isManualOverride && (
            <button onClick={() => onAct(() => clearPricingOverride(row.id, token))} disabled={busy}
              className="font-mono text-nano uppercase tracking-wide underline text-ink2 hover:text-accentDeep transition-colors">
              hand it back to the crawler
            </button>
          )}
        </div>
        <p className="text-sm text-ink2 text-pretty">
          Anything you set here wins, and the automatic checks will stop overwriting this tool.
          They keep running, so you will still see it when the vendor&rsquo;s page changes.
        </p>

        <div className="grid sm:grid-cols-4 gap-2">
          <div>
            <label htmlFor={id("price")} className={label}>Starting price</label>
            <input id={id("price")} className={field} inputMode="decimal" placeholder="9"
              value={f.startingPrice} onChange={set("startingPrice")} />
          </div>
          <div>
            <label htmlFor={id("cur")} className={label}>Currency</label>
            <input id={id("cur")} className={field} maxLength={3} placeholder="USD"
              value={f.currency} onChange={set("currency")} />
          </div>
          <div>
            <label htmlFor={id("per")} className={label}>Billed</label>
            <select id={id("per")} className={field} value={f.billingPeriod} onChange={set("billingPeriod")}>
              {PERIODS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={id("model")} className={label}>Model</label>
            <select id={id("model")} className={field} value={f.pricingModel} onChange={set("pricingModel")}>
              {MODELS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={id("url")} className={label}>Their pricing page · required</label>
          <input id={id("url")} className={field} placeholder="https://…"
            value={f.pricingUrl} onChange={set("pricingUrl")} />
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.freePlan} onChange={set("freePlan")} className="w-4 h-4 accent-current" />
            Has a free plan
          </label>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.freeTrial} onChange={set("freeTrial")} className="w-4 h-4 accent-current" />
            Has a free trial
          </label>
        </div>

        <div>
          <label htmlFor={id("note")} className={label}>Note to yourself</label>
          <input id={id("note")} className={field} placeholder="Checked their pricing page on 22 Aug"
            value={f.note} onChange={set("note")} />
        </div>

        <button onClick={() => onAct(() => overridePricing(row.id, f, token))} disabled={busy}
          className="stamp text-xs disabled:opacity-60">
          {busy ? "Saving…" : "Save this as the price"}
        </button>
      </div>

      {logs && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="font-mono text-label uppercase tracking-[.14em] text-accentDeep mb-2">Recent attempts</p>
            {logs.logs?.length ? (
              <ul className="space-y-1.5 text-label font-mono text-ink2">
                {logs.logs.slice(0, 6).map((l) => (
                  <li key={l.id} className="flex gap-2">
                    <span className={l.outcome === "success" ? "text-green-700" : "text-accentDeep"}>{l.outcome}</span>
                    <span className="opacity-70">{when(l.createdAt)}</span>
                    <span className="opacity-60 truncate">{(l.detail || "").slice(0, 60)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink2">No attempts recorded.</p>}
          </div>
          <div>
            <p className="font-mono text-label uppercase tracking-[.14em] text-accentDeep mb-2">Price history</p>
            {logs.history?.length ? (
              <ul className="space-y-1.5 text-label font-mono text-ink2">
                {logs.history.slice(0, 6).map((h) => (
                  <li key={h.id}>
                    <span className="text-ink">{h.changeType}</span>{" "}
                    <span className="opacity-70">{when(h.detectedAt)}</span>{" "}
                    <span className="opacity-60">{(h.summary || "").slice(0, 70)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink2">Nothing has changed yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
