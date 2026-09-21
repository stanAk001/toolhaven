/**
 * Build your own campaign: pick the surfaces, pick the days, see the price.
 *
 * The packages are for people who want to be told what to buy. This is for
 * everyone else — someone who only wants their category page, or who wants
 * three weeks rather than two.
 *
 * The price is never computed here. Every figure on screen came from the
 * server, which recomputes it again at checkout from the same rates. A browser
 * that could work out its own total is a browser that could name it.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { Check } from "lucide-react";
import { getBuildablePlacements, quoteCustomCampaign } from "../api/client.js";

/** Run lengths worth offering as one tap, before the slider. */
const PRESETS = [7, 14, 30, 60];

/**
 * @param {object}   p
 * @param {function} [p.onStart]  a button that starts a campaign from this
 *                                build. Only on the public page, where there
 *                                is no surrounding flow to advance.
 * @param {function} [p.onChange] fires whenever the build is priced. Inside
 *                                the campaign flow this is how the builder
 *                                becomes the current selection without
 *                                offering its own way forward.
 * @param {boolean}  [p.selected] draw it as the chosen option.
 */
export function CustomBuild({ onStart = null, onChange = null, selected = false, className = "" }) {
  const [meta, setMeta] = useState(null);
  const [chosen, setChosen] = useState([]);
  const [days, setDays] = useState(14);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getBuildablePlacements()
      .then((d) => {
        setMeta(d);
        // Start with something priced rather than an empty form and a dash.
        setChosen(d.placements.slice(0, 1).map((p) => p.key));
      })
      .catch(() => setMeta({ placements: [] }));
  }, []);

  // One request per settled change, not one per keystroke on the slider.
  const timer = useRef(null);
  const refresh = useCallback((keys, d) => {
    clearTimeout(timer.current);
    if (!keys.length) { setQuote(null); setError(""); return; }
    setPending(true);
    timer.current = setTimeout(() => {
      quoteCustomCampaign(keys, d)
        .then((q) => {
          setQuote(q); setError("");
          // Only once the person has actually touched it. The panel prices a
          // sensible default on mount so it never opens showing a dash, and
          // announcing that default would silently select "build your own"
          // for someone who had not chosen anything yet — quietly overriding
          // the packages they were still reading.
          if (touched.current) onChangeRef.current?.({ placements: keys, days: d, quote: q });
        })
        .catch((e) => { setQuote(null); setError(e?.response?.data?.error || "Couldn't price that."); })
        .finally(() => setPending(false));
    }, 250);
  }, []);

  // Held in a ref so a parent re-rendering with a new closure does not
  // re-run the debounce and fire another request on every keystroke.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Has the person actually chosen something here, as opposed to the panel
  // pricing its own opening state?
  const touched = useRef(false);

  useEffect(() => { refresh(chosen, days); return () => clearTimeout(timer.current); }, [chosen, days, refresh]);

  const toggle = (key) => {
    touched.current = true;
    setChosen((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));
  };
  const setRunLength = (d) => { touched.current = true; setDays(d); };

  if (!meta) return null;
  if (!meta.placements.length) return null;

  const min = meta.minDays || 7;
  const max = meta.maxDays || 90;

  return (
    <section className={className} aria-labelledby="build">
      <h2 id="build" className="font-display text-2xl font-semibold tracking-tight mb-1">
        Or build your own
      </h2>
      <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-5">
        Choose the placements and how long it runs — the price follows
      </p>

      {/* Inside the flow this panel is one of two choices, so it takes the
          same selected treatment as a package card. On the public page
          nothing is being chosen against it and `selected` stays false. */}
      <div className={`grid lg:grid-cols-[1fr_auto] gap-5 lg:gap-8 items-start
        rounded-card p-4 sm:p-6 transition-colors border
        ${selected ? "border-ink bg-paper2/60" : "border-rule bg-surface"}`}>

        <div className="min-w-0 w-full">
          {/* ── placements ── */}
          <fieldset>
            <legend className="font-mono text-nano uppercase tracking-[.16em] text-ink2 mb-2">
              Where it appears
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {meta.placements.map((p) => {
                const on = chosen.includes(p.key);
                return (
                  <button key={p.key} type="button" onClick={() => toggle(p.key)} aria-pressed={on}
                    className={`text-left rounded-ui border p-3 transition-colors min-h-touch
                      ${on ? "border-ink bg-paper2/60" : "border-rule hover:bg-paper2/40"}`}>
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-display text-sm sm:text-base font-semibold leading-tight text-balance">
                        {p.label}
                      </span>
                      <span aria-hidden="true"
                        className={`shrink-0 w-4 h-4 mt-0.5 grid place-items-center border
                          ${on ? "bg-ink border-ink text-paper" : "border-rule"}`}>
                        {on && <Check size={11} strokeWidth={3} />}
                      </span>
                    </span>
                    <span className="block font-mono text-nano uppercase tracking-[.12em] text-ink2 mt-1">
                      {p.perDay} / day
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* ── duration ── */}
          <fieldset className="mt-5">
            <legend className="font-mono text-nano uppercase tracking-[.16em] text-ink2 mb-2">
              How long it runs
            </legend>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESETS.filter((d) => d >= min && d <= max).map((d) => (
                <button key={d} type="button" onClick={() => setRunLength(d)} aria-pressed={days === d}
                  className={`px-3 min-h-touch rounded-ui border font-mono text-nano uppercase tracking-[.12em] transition-colors
                    ${days === d ? "bg-ink text-paper border-ink" : "border-rule hover:bg-paper2"}`}>
                  {d} days
                </button>
              ))}
            </div>
            <label className="block">
              <span className="sr-only">Run length in days</span>
              <input type="range" min={min} max={max} value={days} className="w-full accent-accent"
                onChange={(e) => setRunLength(Number(e.target.value))} />
            </label>
            <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 tabular-nums mt-1">
              {days} days · {min}–{max} available
            </p>
          </fieldset>
        </div>

        {/* ── the price ── */}
        <div className="w-full lg:w-64 lg:border-l lg:border-rule lg:pl-6 border-t border-rule pt-4 lg:border-t-0 lg:pt-0">
          {!chosen.length ? (
            <p className="text-sm text-ink2 text-pretty">Choose at least one placement.</p>
          ) : error ? (
            <p className="text-sm text-accentDeep text-pretty">{error}</p>
          ) : (
            <>
              <p className="font-mono text-nano uppercase tracking-[.16em] text-ink2 mb-1">Total</p>
              <p className={`font-display text-3xl font-semibold tabular-nums leading-none transition-opacity
                ${pending ? "opacity-40" : ""}`}>
                {quote ? quote.display : "—"}
              </p>

              {/* Only ever shown when a discount genuinely applied. */}
              {quote?.wasDisplay && (
                <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mt-1.5">
                  <span className="line-through">{quote.wasDisplay}</span>
                  <span className="text-green-700 ml-2">{quote.discountPct}% off for {quote.days} days</span>
                </p>
              )}

              {quote && (
                <ul className="mt-4 space-y-1 border-t border-rule pt-3">
                  {quote.lines.map((l) => (
                    <li key={l.placement} className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="text-ink2 min-w-0 truncate">{l.label}</span>
                      <span className="tabular-nums shrink-0">{l.display}</span>
                    </li>
                  ))}
                </ul>
              )}

              {onStart && (
                <button type="button" disabled={!quote || pending}
                  onClick={() => onStart({ placements: chosen, days })}
                  className="stamp text-xs w-full justify-center mt-5 disabled:opacity-50">
                  Start this campaign
                </button>
              )}

              <p className="font-mono text-nano text-ink2 mt-3 text-pretty">
                Subject to the slot being free when you pay.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
