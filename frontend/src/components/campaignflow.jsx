/**
 * Buying a campaign, in six steps.
 *
 * The brief asked for a clear progress indicator and a simple flow, not an
 * advertising console. So each step asks one question, the step strip says
 * where you are, and the last step before payment shows exactly what is about
 * to be charged and what happens afterwards.
 *
 * Two things this screen is careful about:
 *
 *   It never invents a price. The figure shown comes from the plan the server
 *   sent, and the amount actually charged is read again server-side at
 *   checkout — so a tampered form cannot buy a cheap campaign.
 *
 *   It never offers a full placement. Availability comes from real counts, and
 *   a placement with no room is disabled with the plain sentence rather than
 *   hidden or dressed up as scarcity.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import { getPromotionPlans, createOwnerCampaign, checkoutCampaign, quoteCustomCampaign } from "../api/client.js";
import { CustomBuild } from "./custombuild.jsx";
import { takeBuild } from "../lib/buildhandoff.js";

/** The slug the server files a self-assembled campaign under. */
const CUSTOM_PLAN = "custom";
import { ToolLogo } from "./toollogo.jsx";

const field = "w-full border border-rule rounded-ui bg-paper px-3 py-2.5 outline-none focus:border-accent transition-colors";
const label = "block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5";
const hint = "font-mono text-nano text-ink2/80 mt-1";

const LIMITS = { headline: 70, message: 180, ctaText: 24, targetAudience: 120 };
const STEPS = ["Tool", "Package", "Placement", "Details", "Review", "Payment"];

const money = (minor, currency) => {
  if (!Number.isInteger(minor)) return null;
  const major = minor / 100;
  return (currency === "NGN" ? "₦" : "$") + (major % 1 === 0 ? major.toLocaleString("en-US") : major.toFixed(2));
};

function Steps({ at }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-6" aria-label="Progress">
      {STEPS.map((name, i) => {
        const state = i < at ? "done" : i === at ? "now" : "todo";
        return (
          <li key={name} className="flex items-center gap-2">
            <span aria-current={state === "now" ? "step" : undefined}
              className={`inline-flex items-center gap-1.5 font-mono text-nano uppercase tracking-[.12em] px-2 py-1 rounded-tight border
                ${state === "now" ? "border-ink bg-ink text-paper"
                  : state === "done" ? "border-rule text-ink2" : "border-rule text-ink2/50"}`}>
              {state === "done" ? <Check size={10} aria-hidden="true" /> : <span className="tabular-nums">{i + 1}</span>}
              {name}
            </span>
            {i < STEPS.length - 1 && <span aria-hidden="true" className="w-3 h-px bg-rule" />}
          </li>
        );
      })}
    </ol>
  );
}

function Problem({ children }) {
  if (!children) return null;
  return (
    <p className="flex items-start gap-2 text-sm text-accentDeep mt-3">
      <AlertCircle size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
      <span className="text-pretty">{children}</span>
    </p>
  );
}

export function CampaignFlow({ tools, token, onDone, onCancel }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState(null);
  // Set only when the buyer built their own: the run length they chose. The
  // price that goes with it is never held here — the server quotes it, and
  // quotes it again when the card is charged.
  const [customDays, setCustomDays] = useState(null);
  const [customQuote, setCustomQuote] = useState(null);

  const [tool, setTool] = useState(tools.length === 1 ? tools[0] : null);
  const [planSlug, setPlanSlug] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [copy, setCopy] = useState({ headline: "", message: "", ctaText: "Visit website", targetAudience: "" });
  const [startDate, setStartDate] = useState("");

  useEffect(() => {
    getPromotionPlans()
      .then(setData)
      .catch(() => setError("Couldn't load the promotion packages. Please try again."));
  }, []);

  const isCustom = planSlug === CUSTOM_PLAN;

  // A custom build has no row among the packages, so it wears one: the same
  // shape the rest of the flow already knows how to render.
  const plan = useMemo(() => {
    if (isCustom) {
      return {
        slug: CUSTOM_PLAN,
        name: "Custom campaign",
        durationDays: customDays,
        quoteOnly: false,
        placements: (data?.placements || []).map((p) => p.key),
        price: customQuote ? { minor: customQuote.minor, currency: customQuote.currency } : null,
      };
    }
    return (data?.plans || []).find((p) => p.slug === planSlug) || null;
  }, [data, planSlug, isCustom, customDays, customQuote]);

  // Re-quote whenever the build changes, so the figure on the review step is
  // the server's current answer rather than the one from two edits ago.
  useEffect(() => {
    if (!isCustom || !placements.length || !customDays) { setCustomQuote(null); return; }
    let alive = true;
    quoteCustomCampaign(placements, customDays)
      .then((q) => { if (alive) setCustomQuote(q); })
      .catch(() => { if (alive) setCustomQuote(null); });
    return () => { alive = false; };
  }, [isCustom, placements, customDays]);
  const availability = useMemo(() => {
    const map = new Map((data?.placements || []).map((p) => [p.key, p]));
    return map;
  }, [data]);

  // A campaign built on the public page, carried through sign-in. It has to sit
  // below `availability`, because a dependency array is evaluated during render
  // and reading that const from above it is a temporal dead zone — which is
  // exactly how this broke the first time.
  //
  // Placements are re-filtered against what is free right now: a slot taken
  // since they built it must not be carried silently into a campaign they are
  // about to pay for.
  useEffect(() => {
    if (!data) return;
    const build = takeBuild();
    if (!build) return;
    const free = build.placements.filter((k) => availability.get(k)?.available);
    if (!free.length) return;
    setPlanSlug(CUSTOM_PLAN);
    setCustomDays(build.days);
    setPlacements(free);
    // Straight past the choices they already made on the public page.
    setStep(tools.length === 1 ? 3 : 0);
  }, [data, availability, tools.length]);

  // Priced by the server from where the request came from. The flow never
  // picks a currency, so what is shown here and what is charged at the end are
  // the same number by construction.
  const price = plan && !plan.quoteOnly ? plan.price : null;

  const canGo = [
    Boolean(tool),
    Boolean(plan),
    placements.length > 0,
    copy.headline.trim().length > 0,
    true,
    true,
  ];

  const next = () => { setError(""); setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => { setError(""); setStep((s) => Math.max(s - 1, 0)); };

  /** Create the draft, then open checkout. Both are server-checked. */
  const pay = async () => {
    setBusy(true); setError("");
    try {
      const { campaign } = await createOwnerCampaign({
        submissionId: tool.submissionId,
        planSlug: plan.slug,
        // For a custom build the server prices from these two, and from
        // nothing the browser says about money.
        ...(isCustom ? { custom: true, days: customDays } : {}),
        placements,
        headline: copy.headline,
        message: copy.message,
        ctaText: copy.ctaText,
        targetAudience: copy.targetAudience,
        startDate: startDate || undefined,
      }, token);

      if (plan.quoteOnly) { onDone?.(campaign, { quote: true }); return; }

      // No currency in the body: the server decides it, the same way it decided
      // the price shown on the review step.
      const checkout = await checkoutCampaign(campaign.slug, {}, token);
      // Leaving the site for the provider. The campaign is a draft with a
      // pending payment until our own server verifies the transaction.
      window.location.href = checkout.url;
    } catch (e) {
      setError(e?.response?.data?.error || "That didn't go through. Please try again.");
      setBusy(false);
    }
  };

  if (!data) return <p className="text-ink2">Loading…</p>;

  return (
    <div className="border border-rule rounded-card bg-surface p-4 sm:p-6">
      <Steps at={step} />

      {/* 1 ─ tool */}
      {step === 0 && (
        <section aria-labelledby="s-tool">
          <h3 id="s-tool" className="font-display text-xl font-semibold tracking-tight mb-1">Which tool?</h3>
          <p className="text-sm text-ink2 mb-4 text-pretty">
            These are your published listings. Nothing needs re-submitting.
          </p>
          <ul className="space-y-2">
            {tools.map((t) => (
              <li key={t.submissionId}>
                <button type="button" onClick={() => setTool(t)}
                  aria-pressed={tool?.submissionId === t.submissionId}
                  className={`w-full text-left flex items-center gap-3 rounded-ui border p-3 transition-colors
                    ${tool?.submissionId === t.submissionId ? "border-ink bg-paper2/60" : "border-rule hover:bg-paper2/40"}`}>
                  <ToolLogo tool={t.tool} size={32} className="shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-display text-base font-semibold leading-tight truncate">{t.tool.name}</span>
                    <span className="block font-mono text-nano uppercase tracking-[.12em] text-ink2 truncate">
                      {t.tool.category?.name || "Uncategorised"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 2 ─ package */}
      {step === 1 && (
        <section aria-labelledby="s-plan">
          <h3 id="s-plan" className="font-display text-xl font-semibold tracking-tight mb-1">Which package?</h3>
          <p className="text-sm text-ink2 mb-4 text-pretty">
            Each one names the placements it includes and how long it runs.
          </p>

          <ul className="grid grid-cols-2 gap-2.5">
            {data.plans.map((p) => {
              const shown = p.quoteOnly ? null : p.price;
              const sellable = p.quoteOnly || Boolean(shown);
              return (
                <li key={p.slug}>
                  <button type="button" disabled={!sellable}
                    onClick={() => {
                      setPlanSlug(p.slug);
                      // Taking a package puts the custom build down.
                      setCustomDays(null);
                      setCustomQuote(null);
                      setPlacements(p.placements.filter((k) => availability.get(k)?.available));
                    }}
                    aria-pressed={planSlug === p.slug}
                    className={`w-full text-left rounded-ui border p-3 transition-colors disabled:opacity-50
                      ${planSlug === p.slug ? "border-ink bg-paper2/60" : "border-rule hover:bg-paper2/40"}`}>
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-base font-semibold leading-tight">{p.name}</span>
                      <span className="font-mono text-sm tabular-nums shrink-0">
                        {p.quoteOnly ? "Quote" : shown ? money(shown.minor, shown.currency) : "—"}
                      </span>
                    </span>
                    <span className="block font-mono text-nano uppercase tracking-[.12em] text-ink2 mt-1">
                      {p.durationDays} days
                      {!sellable && " · not priced yet"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* The option for anyone none of the packages fit.
              It used to carry its own "Start this campaign" button, which put
              two primary actions on one screen that did different things —
              one advanced a step, the other skipped past Placement. Two ways
              forward is a hesitation at exactly the moment a buyer should feel
              certain. Now it is simply the other choice: touching it selects
              it, selecting a package deselects it, and Continue is the only
              way on. */}
          <div className="mt-5 pt-5 border-t border-rule">
            <CustomBuild
              selected={isCustom}
              onChange={({ placements: keys, days }) => {
                setPlanSlug(CUSTOM_PLAN);
                setCustomDays(days);
                setPlacements(keys.filter((k) => availability.get(k)?.available));
                setError("");
              }}
            />
          </div>
        </section>
      )}

      {/* 3 ─ placement */}
      {step === 2 && plan && (
        <section aria-labelledby="s-place">
          <h3 id="s-place" className="font-display text-xl font-semibold tracking-tight mb-1">Where should it appear?</h3>
          <p className="text-sm text-ink2 mb-4 text-pretty">
            Included in {plan.name}. A placement that is full says so — we don't hold back slots to
            create urgency.
          </p>
          <ul className="space-y-2">
            {plan.placements.map((key) => {
              const a = availability.get(key);
              const open = a?.available;
              const on = placements.includes(key);
              return (
                <li key={key}>
                  <label className={`flex items-start gap-3 rounded-ui border p-3 transition-colors
                    ${open ? "cursor-pointer hover:bg-paper2/40" : "opacity-60 cursor-not-allowed"}
                    ${on ? "border-ink bg-paper2/60" : "border-rule"}`}>
                    <input type="checkbox" checked={on} disabled={!open}
                      onChange={(e) => setPlacements((list) => (e.target.checked ? [...list, key] : list.filter((k) => k !== key)))}
                      className="mt-1 shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-display text-base font-semibold leading-tight">
                        {a?.label || key}
                        {a?.manual && (
                          <span className="ml-2 font-mono text-nano uppercase tracking-[.12em] text-ink2 font-normal">
                            fulfilled by an editor
                          </span>
                        )}
                      </span>
                      {a?.description && <span className="block text-sm text-ink2 leading-snug mt-0.5 text-pretty">{a.description}</span>}
                      <span className="block font-mono text-nano uppercase tracking-[.12em] mt-1">
                        {open
                          ? <span className="text-ink2">{a.free} of {a.maxActive} open</span>
                          : <span className="text-accentDeep">That placement is currently unavailable.</span>}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 4 ─ details */}
      {step === 3 && (
        <section aria-labelledby="s-copy" className="space-y-4">
          <div>
            <h3 id="s-copy" className="font-display text-xl font-semibold tracking-tight mb-1">Your campaign copy</h3>
            <p className="text-sm text-ink2 text-pretty">
              Your logo, description and link come from your listing. This is the promotional line
              that runs with them. Plain text only.
            </p>
          </div>

          <div>
            <label htmlFor="c-head" className={label}>Headline *</label>
            <input id="c-head" className={field} maxLength={LIMITS.headline} value={copy.headline}
              onChange={(e) => setCopy({ ...copy, headline: e.target.value })}
              placeholder={`Try ${tool?.tool?.name || "your tool"} free for 14 days`} />
            <p className={hint}>{copy.headline.length}/{LIMITS.headline}</p>
          </div>

          <div>
            <label htmlFor="c-msg" className={label}>One line about it</label>
            <textarea id="c-msg" rows={2} className={field + " resize-y"} maxLength={LIMITS.message} value={copy.message}
              onChange={(e) => setCopy({ ...copy, message: e.target.value })}
              placeholder="What it does, in one sentence." />
            <p className={hint}>{copy.message.length}/{LIMITS.message} · leave blank to use your listing's description</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="c-cta" className={label}>Button text</label>
              <input id="c-cta" className={field} maxLength={LIMITS.ctaText} value={copy.ctaText}
                onChange={(e) => setCopy({ ...copy, ctaText: e.target.value })} />
            </div>
            <div>
              <label htmlFor="c-start" className={label}>Preferred start</label>
              <input id="c-start" type="date" className={field} value={startDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setStartDate(e.target.value)} />
              <p className={hint}>Leave blank to start as soon as it's approved.</p>
            </div>
          </div>

          <div>
            <label htmlFor="c-aud" className={label}>Who is it for?</label>
            <input id="c-aud" className={field} maxLength={LIMITS.targetAudience} value={copy.targetAudience}
              onChange={(e) => setCopy({ ...copy, targetAudience: e.target.value })}
              placeholder="Solo developers shipping side projects" />
            <p className={hint}>Helps the editor place it sensibly. Not shown publicly.</p>
          </div>
        </section>
      )}

      {/* 5 ─ review */}
      {step === 4 && plan && tool && (
        <section aria-labelledby="s-review">
          <h3 id="s-review" className="font-display text-xl font-semibold tracking-tight mb-4">Check it over</h3>
          <dl className="border-t border-rule">
            {[
              ["Tool", tool.tool.name],
              ["Package", plan.name],
              ["Runs for", `${plan.durationDays} days`],
              ["Starts", startDate || "As soon as it's approved"],
              ["Placements", placements.map((k) => availability.get(k)?.label || k).join(", ") || "—"],
              ["Headline", copy.headline || "—"],
              ["Message", copy.message || "(your listing's description)"],
              ["Button", copy.ctaText || "Visit website"],
              ["Links to", tool.tool.websiteUrl || "your listing"],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule py-2">
                <dt className="font-mono text-nano uppercase tracking-[.12em] text-ink2">{k}</dt>
                <dd className="text-sm text-right max-w-[32ch] text-pretty">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="flex items-baseline justify-between gap-4 mt-4">
            <span className="font-mono text-nano uppercase tracking-[.14em] text-ink2">Total</span>
            <span className="font-display text-2xl font-semibold tabular-nums">
              {plan.quoteOnly ? "Quoted per campaign" : price ? money(price.minor, price.currency) : "—"}
            </span>
          </div>
        </section>
      )}

      {/* 6 ─ payment */}
      {step === 5 && plan && (
        <section aria-labelledby="s-pay">
          <h3 id="s-pay" className="font-display text-xl font-semibold tracking-tight mb-1">
            {plan.quoteOnly ? "Ask for a quote" : "Payment"}
          </h3>
          {plan.quoteOnly ? (
            <p className="text-sm text-ink2 max-w-measure text-pretty mb-5">
              This package is priced per campaign. We'll save it as a draft and email you — nothing
              is charged now.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink2 max-w-measure text-pretty mb-4">
                You'll be taken to our payment provider to pay
                {price ? <> <strong className="text-ink">{money(price.minor, price.currency)}</strong></> : null}.
                We confirm the payment with them directly when you come back — nothing is activated
                on your browser's word alone.
              </p>
              <ol className="border-t border-rule mb-5">
                {[
                  "You pay",
                  "We verify the payment with the provider",
                  "An editor reviews the campaign",
                  "It goes live on your start date",
                ].map((s, i) => (
                  <li key={s} className="flex gap-3 border-b border-rule py-2 text-sm">
                    <span className="font-mono text-nano tabular-nums text-ink2/60 mt-0.5">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-4">
                Paying does not affect your tool's score, rating or organic position
              </p>
            </>
          )}
          <button type="button" onClick={pay} disabled={busy} className="stamp disabled:opacity-60">
            {busy ? "Opening checkout…" : plan.quoteOnly ? "Save and ask for a quote" : "Continue to payment"}
          </button>
        </section>
      )}

      <Problem>{error}</Problem>

      <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-rule">
        {step > 0 ? (
          <button type="button" onClick={back} className="stamp-paper text-xs">
            <ArrowLeft size={13} aria-hidden="true" /> Back
          </button>
        ) : (
          <button type="button" onClick={onCancel} className="stamp-paper text-xs">Cancel</button>
        )}
        {step < STEPS.length - 1 && (
          <button type="button" onClick={next} disabled={!canGo[step]} className="stamp text-xs disabled:opacity-40">
            Continue <ArrowRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
