/**
 * /promote/dashboard — the tool owner's side of Toolhaven Promote.
 *
 * Signed out it is a single field: the address you submitted with. Signed in it
 * answers, in order, the questions a vendor actually has — is anything running,
 * how is it doing, what did I buy before, and how do I start another.
 *
 * Every number on this page is counted from recorded events by the server.
 * Nothing is estimated here and nothing is projected, which is why a campaign
 * with no activity yet shows a dash rather than a zero dressed up as progress.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, LogOut, RotateCw } from "lucide-react";
import {
  requestOwnerLink, getOwnerMe, listOwnerCampaigns, settleCampaign, cancelOwnerCampaign,
  renewCampaign,
} from "../api/client.js";
import { readSession, writeSession, clearSession } from "../lib/ownersession.js";
import { hasBuild } from "../lib/buildhandoff.js";
import { CampaignFlow } from "../components/campaignflow.jsx";
import { ToolLogo } from "../components/toollogo.jsx";
import { PageHead } from "../components/editorial.jsx";
import { Seo } from "../lib/seo.jsx";

const field = "w-full border border-rule rounded-ui bg-paper px-3 py-2.5 outline-none focus:border-accent transition-colors";
const when = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const num = (n) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "—");

/** Live, waiting, or finished — in the vendor's words, not the enum's. */
const PHASE = {
  DRAFT: ["Draft", "Not submitted yet"],
  PENDING_PAYMENT: ["Awaiting payment", "Finish checkout to submit it"],
  PAYMENT_RECEIVED: ["Paid", "Queued for review"],
  PENDING_REVIEW: ["In review", "An editor is reading it"],
  APPROVED: ["Approved", "Scheduled to start"],
  SCHEDULED: ["Scheduled", "Starts on its start date"],
  ACTIVE: ["Live", "Running now"],
  PAUSED: ["Paused", "Temporarily off the surfaces"],
  COMPLETED: ["Completed", "Finished — the report is final"],
  EXPIRED: ["Ended", "Finished"],
  REJECTED: ["Not accepted", "See the note below"],
  CANCELLED: ["Cancelled", ""],
  REFUND_PENDING: ["Refund in progress", "Waiting on the payment provider"],
  REFUNDED: ["Refunded", "Confirmed by the provider"],
};

/** "HOMEPAGE_FEATURED" is a database key, not something to show a customer. */
const PLACEMENT_NAMES = {
  HOMEPAGE_FEATURED: "Homepage",
  CATEGORY_FEATURED: "Category page",
  PROMOTIONAL_DISCOVERY: "Discovery",
  GUIDE_PROMOTION: "Buying guide",
  SOCIAL_PROMOTION: "Social",
  NEWSLETTER_PROMOTION: "Newsletter",
};
const placementName = (key) =>
  PLACEMENT_NAMES[key] || String(key || "").toLowerCase().replace(/_/g, " ");

function Stat({ label, value }) {
  return (
    <div className="border-t border-rule pt-2">
      <dt className="font-mono text-nano uppercase tracking-[.12em] text-ink2">{label}</dt>
      <dd className="font-display text-xl sm:text-2xl font-semibold tabular-nums leading-none mt-1">{value}</dd>
    </div>
  );
}

function CampaignCard({ c, token, onChanged }) {
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState("");
  const [phase, note] = PHASE[c.status] || [c.status, ""];
  const s = c.stats || {};
  const live = c.status === "ACTIVE";

  return (
    <article className="border border-rule rounded-card bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <ToolLogo tool={c.tool} size={32} className="shrink-0" />
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold leading-tight truncate">{c.tool?.name}</h3>
            <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 truncate">
              {c.plan?.name}{c.payment?.display ? ` · ${c.payment.display}` : ""}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 font-mono text-nano uppercase tracking-[.14em] px-2 py-1 rounded-tight border shrink-0
          ${live ? "border-green-700 text-green-700" : "border-rule text-ink2"}`}>
          {live && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-green-700 animate-pulse" />}
          {phase}
        </span>
      </div>

      {c.headline && <p className="text-sm text-pretty mb-2">{c.headline}</p>}

      <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-3">
        {when(c.startDate)} – {when(c.endDate)}
        {note ? ` · ${note}` : ""}
      </p>

      {c.reviewNote && (
        <p className="text-sm border-l-2 border-accent pl-3 my-3 text-pretty">{c.reviewNote}</p>
      )}

      {/* Numbers only once there is something to count. A grid of zeros before
          a campaign has run reads as failure rather than as "not started". */}
      {(s.impressions > 0 || c.status === "COMPLETED") && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mt-4">
          <Stat label="Impressions" value={num(s.impressions)} />
          <Stat label="Tool page views" value={num(s.toolPageViews)} />
          <Stat label="Website clicks" value={num(s.websiteClicks)} />
          <Stat label="CTR" value={s.ctr === null || s.ctr === undefined ? "—" : `${s.ctr}%`} />
        </dl>
      )}

      {/* Where those numbers came from. The packages sell "placement-by-
          placement analytics", so the split has to be visible rather than
          merely computed — and it shows only once a placement has recorded
          something, because a row of zeros is not a report. */}
      {(s.placements || []).length > 0 && (
        <table className="w-full mt-4 text-left">
          <caption className="font-mono text-nano uppercase tracking-[.12em] text-ink2 text-left mb-1">
            By placement
          </caption>
          <thead>
            <tr className="font-mono text-nano uppercase tracking-[.12em] text-ink2">
              <th scope="col" className="font-normal py-1">Placement</th>
              <th scope="col" className="font-normal py-1 text-right tabular-nums">Impressions</th>
              <th scope="col" className="font-normal py-1 text-right tabular-nums">Clicks</th>
            </tr>
          </thead>
          <tbody>
            {s.placements.map((p) => (
              <tr key={p.placement} className="border-t border-rule">
                <td className="py-1.5 text-sm">{placementName(p.placement)}</td>
                <td className="py-1.5 text-sm text-right tabular-nums">{num(p.impressions)}</td>
                <td className="py-1.5 text-sm text-right tabular-nums">{num(p.clicks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* The parts of the package a person does rather than the site.
          Shown with their real state: "not sent yet" stays "not sent yet"
          until an editor records sending it. No impressions are claimed for
          these, because none are measured. */}
      {(c.manual || []).length > 0 && (
        <dl className="mt-4 pt-3 border-t border-rule">
          <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-2">
            Done by our editors, not by the site
          </p>
          {c.manual.map((m) => (
            <div key={m.placement} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1">
              <dt className="text-sm">{m.label}</dt>
              <dd className={`font-mono text-nano uppercase tracking-[.12em] ${m.doneAt ? "text-green-700" : "text-ink2"}`}>
                {m.doneAt ? `Sent ${when(m.doneAt)}` : "Not sent yet"}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {c.status === "PENDING_PAYMENT" && (
        <p className="font-mono text-nano uppercase tracking-[.12em] text-accentDeep mt-3">
          Payment not completed — start again from Promote a tool
        </p>
      )}

      {/* The other end of the "your campaign is ending" email. Everything the
          vendor already wrote and had approved is carried across; all they do
          is pay for another run. */}
      {["COMPLETED", "EXPIRED", "ACTIVE", "PAUSED"].includes(c.status) && (
        <div className="mt-4 pt-3 border-t border-rule">
          <button type="button" disabled={renewing}
            onClick={async () => {
              setRenewing(true); setRenewError("");
              try {
                await renewCampaign(c.slug, token);
                onChanged();
              } catch (e) {
                setRenewError(e?.response?.data?.error || "Couldn't set that up. Please try again.");
              } finally { setRenewing(false); }
            }}
            className="stamp-paper text-xs disabled:opacity-60">
            <RotateCw size={13} aria-hidden="true" />
            {renewing ? "Setting it up…" : "Run this again"}
          </button>
          <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mt-2">
            Copies your wording and placements into a new campaign — priced at today's rates
          </p>
          {renewError && <p className="text-sm text-accentDeep mt-2 text-pretty">{renewError}</p>}
        </div>
      )}

      {(c.status === "DRAFT" || c.status === "PENDING_PAYMENT") && (
        <button type="button"
          onClick={async () => { await cancelOwnerCampaign(c.slug, token).catch(() => {}); onChanged(); }}
          className="stamp-paper text-xs mt-4">
          Cancel this campaign
        </button>
      )}
    </article>
  );
}

export default function PromoteDashboard() {
  const [params, setParams] = useSearchParams();
  const [session, setSession] = useState(readSession);
  const [me, setMe] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  // Until the first load returns, we do not know what this owner has. Saying
  // "your tool needs to be approved" in the meantime is a false accusation
  // about someone's own product, shown to them on a slow connection.
  const [loaded, setLoaded] = useState(false);

  const token = session?.token;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [meRes, listRes] = await Promise.all([getOwnerMe(token), listOwnerCampaigns(token)]);
      setMe(meRes);
      setCampaigns(listRes.items || []);
    } catch (e) {
      if (e?.response?.status === 401) { clearSession(); setSession(null); }
      else setError(e?.response?.data?.error || "Couldn't load your campaigns.");
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Arrived from the builder on /promote with a campaign already assembled:
  // open the flow straight away rather than making them find the button and
  // rebuild what they just chose.
  useEffect(() => {
    const canPromote = (me?.tools || []).some((t) => t.promotable);
    if (loaded && hasBuild() && canPromote) setStarting(true);
  }, [loaded, me]);

  /* Coming back from the payment provider.
     The reference in the URL is not evidence of anything — it is simply the
     prompt to ask our own server to verify with the provider. */
  useEffect(() => {
    const reference = params.get("reference");
    const slug = params.get("campaign");
    if (!reference || !slug || !token) return;
    let alive = true;
    settleCampaign(slug, reference, token)
      .catch(() => null)
      .then(() => {
        if (!alive) return;
        params.delete("reference");
        setParams(params, { replace: true });
        load();
      });
    return () => { alive = false; };
  }, [params, setParams, token, load]);

  const signIn = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await requestOwnerLink(email);
      setSent(r.message);
    } catch { setError("Couldn't send that link. Please try again."); }
    finally { setBusy(false); }
  };

  /* ─── signed out ─── */
  if (!token) {
    return (
      <div className="max-w-xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
        <Seo title="Promote your tool" path="/promote/dashboard" noIndex />
        <PageHead kicker="Toolhaven Promote" title="Sign in to promote your tool">
          Use the email address you submitted your tool with. We'll send a sign-in link — there's no
          password to remember.
        </PageHead>

        {sent ? (
          <div className="border border-rule rounded-card bg-paper2/40 p-5">
            <p className="text-pretty">{sent}</p>
            <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mt-3">
              The link works once and expires in 20 minutes
            </p>
          </div>
        ) : (
          <form onSubmit={signIn} className="border border-rule rounded-card bg-surface p-5">
            <label htmlFor="o-email" className="block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5">
              Your email
            </label>
            <input id="o-email" type="email" required autoComplete="email" className={field}
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            <button type="submit" disabled={busy} className="stamp mt-4 disabled:opacity-60">
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            {error && <p className="text-sm text-accentDeep mt-3">{error}</p>}
          </form>
        )}

        <p className="text-sm text-ink2 mt-6 text-pretty">
          Not listed yet? <Link to="/submit" className="underline underline-offset-4 text-accentDeep">Submit your tool</Link> first
          — promotion is for listings that are already published.
        </p>
      </div>
    );
  }

  /* ─── signed in ─── */
  const promotable = (me?.tools || []).filter((t) => t.promotable);
  const openOnes = campaigns.filter((c) => ["ACTIVE", "PAUSED", "SCHEDULED", "APPROVED", "PENDING_REVIEW", "PAYMENT_RECEIVED", "PENDING_PAYMENT", "DRAFT"].includes(c.status));
  const past = campaigns.filter((c) => !openOnes.includes(c));

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      <Seo title="Your campaigns" path="/promote/dashboard" noIndex />

      <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
        <PageHead kicker="Toolhaven Promote" title="Your campaigns" />
        <button type="button"
          onClick={() => { clearSession(); setSession(null); setMe(null); setCampaigns([]); }}
          className="inline-flex items-center gap-1.5 font-mono text-nano uppercase tracking-[.12em] text-ink2 hover:text-ink transition-colors min-h-touch">
          <LogOut size={12} aria-hidden="true" /> Sign out
        </button>
      </div>

      {error && <p className="text-sm text-accentDeep mb-4">{error}</p>}

      {starting ? (
        <CampaignFlow
          tools={promotable}
          token={token}
          onCancel={() => setStarting(false)}
          onDone={() => { setStarting(false); load(); }}
        />
      ) : hasBuild() && promotable.length === 0 && loaded ? (
        // They built something on /promote and arrived with nothing to put it
        // on. Say so rather than silently dropping the build.
        <section className="border border-rule rounded-card bg-paper2/40 p-5 sm:p-6 mb-8">
          <h2 className="font-display text-xl font-semibold tracking-tight mb-1">
            We kept your campaign
          </h2>
          <p className="text-ink2 text-pretty">
            {me?.notPromotableMessage || "Your tool needs to be published before you can promote it."}
            {" "}Once it is, come back and the campaign you built will still be here.
          </p>
        </section>
      ) : (
        <>
          {/* The entry point §5 asks for, on the listing they already own. */}
          <section className="border border-rule rounded-card bg-paper2/40 p-5 sm:p-6 mb-8">
            {!loaded ? (
              <p className="font-mono text-sm text-ink2">Loading your tools…</p>
            ) : promotable.length > 0 ? (
              <>
                <h2 className="font-display text-xl font-semibold tracking-tight mb-1">
                  {promotable.length === 1
                    ? `${promotable[0].tool.name} is live on Toolhaven.`
                    : "Your tools are live on Toolhaven."}
                </h2>
                <p className="text-ink2 text-pretty mb-4">
                  Want additional exposure? Start a campaign — your listing, logo and link are
                  already here, so there's nothing to fill in twice.
                </p>
                <button type="button" onClick={() => setStarting(true)} className="stamp">
                  Promote {promotable.length === 1 ? "this tool" : "a tool"} <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl font-semibold tracking-tight mb-1">Nothing to promote yet</h2>
                <p className="text-ink2 text-pretty">
                  {me?.notPromotableMessage || "Your tool needs to be approved before you can promote it."}
                </p>
              </>
            )}
          </section>

          {openOnes.length > 0 && (
            <section className="mb-10" aria-labelledby="open">
              <h2 id="open" className="font-display text-xl font-semibold tracking-tight mb-4">In flight</h2>
              <div className="space-y-3">
                {openOnes.map((c) => <CampaignCard key={c.slug} c={c} token={token} onChanged={load} />)}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section aria-labelledby="past">
              <h2 id="past" className="font-display text-xl font-semibold tracking-tight mb-1">Campaign history</h2>
              <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-4">
                Metrics are Toolhaven activity and do not necessarily represent conversions on your site
              </p>
              <div className="space-y-3">
                {past.map((c) => <CampaignCard key={c.slug} c={c} token={token} onChanged={load} />)}
              </div>
            </section>
          )}

          {campaigns.length === 0 && promotable.length > 0 && (
            <p className="text-ink2 text-pretty">No campaigns yet. Your first one starts above.</p>
          )}
        </>
      )}
    </div>
  );
}
