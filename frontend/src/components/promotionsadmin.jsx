/**
 * Admin → Promotions.
 *
 * Three things an editor does here: read the queue, decide on a campaign, and
 * change what is for sale. The review screen deliberately shows the campaign
 * copy, the destination and the payment side by side, because those are what a
 * decision is actually made on.
 *
 * Rejecting or asking for a change requires typing a reason, and that reason is
 * emailed to the vendor verbatim. A refusal with no explanation is the thing
 * that makes people distrust a marketplace, so the form does not allow one.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, X, Pause, Play, RefreshCw, ExternalLink } from "lucide-react";
import {
  promotionOverview, listPromotionCampaigns, getPromotionCampaign, campaignAction,
  setCampaignDates, listPromotionPlans, updatePromotionPlan,
  listPromotionPlacements, updatePromotionPlacement,
} from "../api/client.js";

const field = "w-full border border-rule rounded-ui bg-paper px-3 py-2.5 outline-none focus:border-accent transition-colors";
const label = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";
const when = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const num = (n) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "0");

const FILTERS = [
  ["PENDING_REVIEW", "Needs review"],
  ["LIVE", "Live"],
  ["SCHEDULED", "Scheduled"],
  ["COMPLETED", "Completed"],
  ["REJECTED", "Rejected"],
  ["", "All"],
];

function Tile({ label: l, value, tone }) {
  return (
    <div className="border-t border-rule pt-2">
      <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2">{l}</p>
      <p className={`font-display text-2xl font-semibold tabular-nums leading-none mt-1 ${tone || ""}`}>{value}</p>
    </div>
  );
}

/** One campaign, opened for a decision. */
function Review({ slug, token, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    getPromotionCampaign(slug, token).then(setData).catch((e) => setError(e?.response?.data?.error || "Couldn't load it."));
  }, [slug, token]);
  useEffect(load, [load]);

  const act = async (action, body) => {
    setBusy(action); setError("");
    try {
      await campaignAction(slug, action, body, token);
      load(); onChanged();
    } catch (e) { setError(e?.response?.data?.error || "That didn't work."); }
    finally { setBusy(""); }
  };

  if (!data) return <p className="text-ink2">Loading…</p>;
  const c = data.campaign;
  const paid = (c.payments || []).find((p) => p.status === "PAID");

  return (
    <div className="border border-rule rounded-card bg-paper p-4 sm:p-5">
      <button type="button" onClick={onClose} className="font-mono text-nano uppercase tracking-wide text-ink2 hover:text-ink mb-4">
        ← Back to campaigns
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display text-2xl font-semibold tracking-tight">{c.tool?.name}</h3>
          <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mt-1">
            {c.plan?.name} · {c.ownerEmail}
          </p>
        </div>
        <span className="font-mono text-nano uppercase tracking-[.14em] border border-rule rounded-tight px-2 py-1">
          {c.status.replace(/_/g, " ")}
        </span>
      </div>

      <dl className="border-t border-rule mb-4">
        {[
          ["Headline", c.headline || "—"],
          ["Message", c.message || "—"],
          ["Button", c.ctaText || "Visit website"],
          ["Audience", c.targetAudience || "—"],
          ["Placements", (c.placements || []).join(", ") || "—"],
          ["Runs", `${when(c.startDate)} – ${when(c.endDate)}`],
          ["Payment", paid ? `${paid.display} · ${paid.provider} · ${paid.reference}` : "Not paid"],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule py-2">
            <dt className="font-mono text-nano uppercase tracking-[.12em] text-ink2">{k}</dt>
            <dd className="text-sm text-right max-w-[46ch] text-pretty">{v}</dd>
          </div>
        ))}
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule py-2">
          <dt className="font-mono text-nano uppercase tracking-[.12em] text-ink2">Destination</dt>
          <dd className="text-sm text-right">
            {c.destinationUrl ? (
              <a href={c.destinationUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-4 text-accentDeep break-all">
                {c.destinationUrl} <ExternalLink size={12} aria-hidden="true" />
              </a>
            ) : "—"}
          </dd>
        </div>
      </dl>

      {c.stats?.impressions > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mb-4">
          <Tile label="Impressions" value={num(c.stats.impressions)} />
          <Tile label="Tool views" value={num(c.stats.toolPageViews)} />
          <Tile label="Clicks" value={num(c.stats.websiteClicks)} />
          <Tile label="CTR" value={c.stats.ctr === null ? "—" : `${c.stats.ctr}%`} />
        </dl>
      )}

      <div className="mb-4">
        <label htmlFor="rev-note" className={label}>Reason — sent to the vendor word for word</label>
        <textarea id="rev-note" rows={2} className={field + " resize-y"} value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Needed for rejecting or asking for a change." />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy === "approve"} onClick={() => act("approve")} className="stamp text-xs disabled:opacity-60">
          <Check size={13} aria-hidden="true" /> Approve
        </button>
        <button type="button" disabled={!note.trim() || busy === "request-changes"}
          onClick={() => act("request-changes", { reason: note })} className="stamp-paper text-xs disabled:opacity-40">
          <RefreshCw size={13} aria-hidden="true" /> Request changes
        </button>
        <button type="button" disabled={!note.trim() || busy === "reject"}
          onClick={() => act("reject", { reason: note })} className="stamp-paper text-xs disabled:opacity-40">
          <X size={13} aria-hidden="true" /> Reject
        </button>
        {c.status === "ACTIVE" && (
          <button type="button" onClick={() => act("pause")} className="stamp-paper text-xs">
            <Pause size={13} aria-hidden="true" /> Pause
          </button>
        )}
        {c.status === "PAUSED" && (
          <button type="button" onClick={() => act("resume")} className="stamp-paper text-xs">
            <Play size={13} aria-hidden="true" /> Resume
          </button>
        )}
      </div>

      {/* The placements the site cannot render. Without this the campaign can
          be sold, paid for and marked active while the newsletter mention it
          included never happens and nobody notices. */}
      {(c.manual || []).length > 0 && (
        <div className="mt-5 pt-4 border-t border-rule">
          <p className={label}>Placements you do by hand</p>
          <p className="text-xs text-ink2 max-w-measure-sm mb-3 text-pretty">
            The site does not render these. Mark one as sent only once you have actually sent it —
            the vendor sees this date on their dashboard.
          </p>
          <ul className="space-y-2">
            {c.manual.map((m) => (
              <li key={m.placement}
                className="flex flex-wrap items-center justify-between gap-3 border border-rule rounded-tight px-3 py-2">
                <span className="text-sm">{m.label}</span>
                {m.doneAt ? (
                  <span className="font-mono text-nano uppercase tracking-[.12em] text-ink2">
                    Sent {when(m.doneAt)}
                  </span>
                ) : (
                  <button type="button" disabled={busy === "fulfilled"}
                    onClick={() => act("fulfilled", { placement: m.placement })}
                    className="stamp-paper text-xs disabled:opacity-60">
                    <Check size={13} aria-hidden="true" /> Mark as sent
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3 mt-5 pt-4 border-t border-rule">
        <div>
          <label htmlFor="d-start" className={label}>Start</label>
          <input id="d-start" type="date" className={field} defaultValue={c.startDate?.slice(0, 10) || ""}
            onBlur={async (e) => {
              if (!e.target.value) return;
              try { await setCampaignDates(slug, { startDate: e.target.value }, token); load(); onChanged(); }
              catch (err) { setError(err?.response?.data?.error || "Couldn't change the dates."); }
            }} />
          <p className="font-mono text-nano text-ink2/80 mt-1">
            Changing the start moves the end by the package's length.
          </p>
        </div>
        <div className="flex items-end">
          <button type="button" onClick={() => act("refund-requested")} className="stamp-paper text-xs">
            Mark refund requested
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-accentDeep mt-3">{error}</p>}

      {data.audit?.length > 0 && (
        <details className="mt-5">
          <summary className="font-mono text-nano uppercase tracking-[.12em] text-ink2 cursor-pointer">
            History ({data.audit.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {data.audit.map((a) => (
              <li key={a.id} className="font-mono text-nano text-ink2">
                {new Date(a.createdAt).toLocaleString()} · {a.actor} · {a.action}
                {a.detail ? ` · ${a.detail}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Plans({ token }) {
  const [plans, setPlans] = useState([]);
  const [saving, setSaving] = useState("");
  const load = useCallback(() => { listPromotionPlans(token).then((d) => setPlans(d.items || [])).catch(() => {}); }, [token]);
  useEffect(load, [load]);

  const save = async (slug, body) => {
    setSaving(slug);
    try { await updatePromotionPlan(slug, body, token); load(); } catch { /* shown by the row reverting */ }
    finally { setSaving(""); }
  };

  return (
    <div className="space-y-2.5">
      <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2">
        Prices are set per currency. A blank field means the package isn't sold in that currency —
        no rate is ever applied between them.
      </p>
      {plans.map((p) => (
        <div key={p.slug} className="border border-rule rounded-card bg-paper p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
            <h4 className="font-display text-lg font-semibold">{p.name}</h4>
            <label className="inline-flex items-center gap-2 font-mono text-nano uppercase tracking-wide">
              <input type="checkbox" checked={p.active} onChange={(e) => save(p.slug, { active: e.target.checked })} />
              Active
            </label>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={label}>Price · USD</label>
              <input className={field} defaultValue={p.priceUsdCents != null ? p.priceUsdCents / 100 : ""}
                placeholder="not sold in USD"
                onBlur={(e) => save(p.slug, { priceUsd: e.target.value })} />
            </div>
            <div>
              <label className={label}>Price · NGN</label>
              <input className={field} defaultValue={p.priceNgnKobo != null ? p.priceNgnKobo / 100 : ""}
                placeholder="not sold in NGN"
                onBlur={(e) => save(p.slug, { priceNgn: e.target.value })} />
            </div>
            <div>
              <label className={label}>Days</label>
              <input className={field} defaultValue={p.durationDays}
                onBlur={(e) => save(p.slug, { durationDays: e.target.value })} />
            </div>
          </div>
          <p className="font-mono text-nano text-ink2/80 mt-2">
            {p.placements.join(", ") || "no placements"}{saving === p.slug ? " · saving…" : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

function Placements({ token }) {
  const [rows, setRows] = useState([]);
  const load = useCallback(() => { listPromotionPlacements(token).then((d) => setRows(d.items || [])).catch(() => {}); }, [token]);
  useEffect(load, [load]);

  return (
    <div className="space-y-2.5">
      <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2">
        The limit is enforced at purchase. Taken counts live campaigns, so it is never a sales tactic.
      </p>
      {rows.map((r) => (
        <div key={r.key} className="border border-rule rounded-card bg-paper p-4 flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <h4 className="font-display text-base font-semibold leading-tight">{r.label}</h4>
            <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2">
              {r.key}{r.manual ? " · fulfilled by hand" : ""} · {r.taken ?? 0} taken
            </p>
          </div>
          <label className="font-mono text-nano uppercase tracking-wide">
            Max
            <input className={field + " w-20 ml-2 inline-block"} defaultValue={r.maxActive}
              onBlur={async (e) => { await updatePromotionPlacement(r.key, { maxActive: e.target.value }, token).catch(() => {}); load(); }} />
          </label>
          <label className="inline-flex items-center gap-2 font-mono text-nano uppercase tracking-wide">
            <input type="checkbox" checked={r.active}
              onChange={async (e) => { await updatePromotionPlacement(r.key, { active: e.target.checked }, token).catch(() => {}); load(); }} />
            Active
          </label>
        </div>
      ))}
    </div>
  );
}

export function PromotionsAdmin({ token }) {
  const [tab, setTab] = useState("campaigns");
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [q, setQ] = useState("");
  const [overview, setOverview] = useState(null);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    promotionOverview(token).then(setOverview).catch(() => {});
    listPromotionCampaigns({ status, q }, token).then((d) => setItems(d.items || [])).catch(() => {});
  }, [token, status, q]);
  useEffect(load, [load]);

  if (open) return <Review slug={open} token={token} onClose={() => setOpen(null)} onChanged={load} />;

  return (
    <div>
      {overview && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-3 mb-6">
          <Tile label="Needs review" value={num(overview.counts.needsReview)}
            tone={overview.counts.needsReview > 0 ? "text-accentDeep" : ""} />
          <Tile label="Live" value={num(overview.counts.live)} />
          <Tile label="In flight" value={num(overview.counts.open)} />
          <Tile label="Impressions" value={num(overview.events.impressions)} />
          <Tile label="Clicks" value={num(overview.events.websiteClicks)} />
          <Tile label="Revenue"
            value={overview.revenue.length ? overview.revenue.map((r) => r.display).join(" · ") : "—"} />
        </dl>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {[["campaigns", "Campaigns"], ["plans", "Packages"], ["placements", "Placements"]].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setTab(v)}
            className={`font-mono text-nano uppercase tracking-wide border border-rule rounded-ui px-3 min-h-touch transition-colors
              ${tab === v ? "bg-ink text-paper" : "hover:bg-paper2"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "plans" && <Plans token={token} />}
      {tab === "placements" && <Placements token={token} />}

      {tab === "campaigns" && (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {FILTERS.map(([v, l]) => (
              <button key={l} type="button" onClick={() => setStatus(v)}
                className={`font-mono text-nano uppercase tracking-wide border border-rule rounded-tight px-2 py-1 transition-colors
                  ${status === v ? "bg-ink text-paper" : "hover:bg-paper2"}`}>
                {l}
              </button>
            ))}
            <input className={field + " sm:w-56 ml-auto"} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search tool, email, headline" />
          </div>

          {items.length === 0 ? (
            <p className="text-ink2">Nothing here.</p>
          ) : (
            <div className="space-y-2">
              {items.map((c) => (
                <button key={c.slug} type="button" onClick={() => setOpen(c.slug)}
                  className="w-full text-left border border-rule rounded-card bg-paper p-3.5 hover:bg-paper2/50 transition-colors">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-display text-base font-semibold leading-tight">{c.tool?.name}</span>
                    <span className="font-mono text-nano uppercase tracking-[.12em] border border-rule rounded-tight px-1.5 py-0.5 text-ink2">
                      {c.status.replace(/_/g, " ")}
                    </span>
                    <span className="ml-auto font-mono text-nano uppercase tracking-[.12em] text-ink2 tabular-nums">
                      {when(c.startDate)} – {when(c.endDate)}
                    </span>
                  </div>
                  <p className="font-mono text-nano uppercase tracking-[.1em] text-ink2 mt-1">
                    {c.plan?.name} · {c.ownerEmail}
                    {c.stats?.impressions ? ` · ${num(c.stats.impressions)} impressions · ${num(c.stats.websiteClicks)} clicks` : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
