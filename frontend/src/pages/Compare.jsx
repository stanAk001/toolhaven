// Head to head.
//
// This is the page the whole site is pointed at: the moment someone stops
// browsing and decides. It used to be forty-one pills above a plain table where
// every row looked equally important and nothing told you which column won.
//
// Three things changed. The picker is a tray of three slots you fill by search,
// so choosing is a decision rather than a scan. The sheet marks the leader on
// every row that can actually have one, and can hide every row where all three
// agree — because the differences are the reason you came. And the last row is
// the catch, printed side by side, which is the one comparison nobody else
// publishes and the only reason to trust the rest of it.
import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useParams, useNavigate, Link, Navigate } from "react-router-dom";
import { pairSlug, parsePair, VS } from "../lib/comparepair.js";
import { Check, X, ArrowUpRight, Share2, Search, Plus, Link as LinkIcon } from "lucide-react";
import { getTools, compareTools } from "../api/client.js";
import { Stars, Loader } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";
import { Breadcrumbs } from "../components/breadcrumbs.jsx";
import { Seo, breadcrumbSchema } from "../lib/seo.jsx";
import { goAffiliate, priceLabel } from "../lib/helpers.jsx";

const MAX = 3;
const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

/* The sheet, described rather than hand-written.
 *
 * `read` pulls the value used for comparison, `show` renders it. Keeping those
 * apart is what lets the page work out on its own which rows are identical
 * (so "differences only" can hide them) and which column leads (`best`) —
 * instead of that judgement being buried in markup, row by row, where it would
 * quietly drift out of step with the data. */
const SHEET = [
  { key: "category", label: "Category", read: (t) => t.category?.name ?? "—" },
  // One rating row, and it says whose rating it is.
  //
  // This used to print our own reader average, which meant five empty stars and
  // "0.0" for every tool no reader has reviewed — a comparison that made two
  // perfectly good products look rated zero against each other. Readers first
  // when there are enough of them to mean anything, then the sourced external
  // figure, then an honest blank.
  {
    key: "rating", label: "Rating", best: "max",
    read: (t) => (Number(t.reviewCount) >= 3 ? Number(t.rating) || 0 : Number(t.topRating?.rating) || 0),
    show: (t) => (
      Number(t.reviewCount) >= 3 ? <Stars r={t.rating} />
        : t.topRating ? (
          <span className="font-mono text-label tabular-nums">
            {t.topRating.rating}/{t.topRating.maxRating}
            <span className="block text-nano uppercase tracking-[.12em] text-ink2 mt-0.5">
              on {t.topRating.sourceName}
            </span>
          </span>
        ) : <span className="font-mono text-label text-ink2">Not rated yet</span>
    ),
  },
  {
    key: "reviews", label: "Reviews behind it", best: "max",
    read: (t) => (Number(t.reviewCount) >= 3 ? Number(t.reviewCount) : Number(t.topRating?.reviewCount) || 0),
    show: (t) => {
      const own = Number(t.reviewCount) || 0;
      const ext = Number(t.topRating?.reviewCount) || 0;
      if (own >= 3) return <span className="tabular-nums">{own.toLocaleString()} readers</span>;
      if (ext) return <span className="tabular-nums">{ext.toLocaleString()} elsewhere</span>;
      return <span className="text-ink2">—</span>;
    },
  },
  {
    key: "price", label: "Price", best: "min",
    read: (t) => (t.priceType === "free" ? 0 : Number(t.priceMax) || 0),
    show: (t) => <span className="tabular-nums">{priceLabel(t)}</span>,
  },
  { key: "model", label: "Pricing model", read: (t) => t.priceType, show: (t) => <span className="capitalize">{t.priceType}</span> },
  { key: "trial", label: "Free trial", best: "yes", read: (t) => !!t.freeTrial, show: (t) => <YesNo v={t.freeTrial} /> },
  { key: "tier", label: "Free tier", best: "yes", read: (t) => !!t.freeTier, show: (t) => <YesNo v={t.freeTier} /> },
  { key: "bestFor", label: "Best for", prose: true, read: (t) => t.bestFor || "—" },
  { key: "caveat", label: "The catch", prose: true, catch: true, read: (t) => t.caveat || "—" },
];

function YesNo({ v }) {
  return v ? (
    <span className="inline-flex items-center gap-1.5 font-semibold text-green-700">
      <Check size={15} strokeWidth={3} aria-hidden="true" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 font-semibold text-ink2">
      <X size={15} strokeWidth={3} aria-hidden="true" /> No
    </span>
  );
}

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const { pair } = useParams();
  const navigate = useNavigate();
  const [all, setAll] = useState([]);
  // A pair URL seeds the selection; otherwise fall back to the query string the
  // picker writes. Both feed the same sheet below.
  const [picked, setPicked] = useState(() => {
    if (pair) {
      const first = parsePair(pair)[0];
      if (first) return first;
    }
    return (params.get("tools") || "").split(",").filter(Boolean).slice(0, MAX);
  });
  const [rows, setRows] = useState([]);
  const [copied, setCopied] = useState(false);
  const [diffOnly, setDiffOnly] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef(null);

  useEffect(() => { getTools({ limit: 100, sort: "popular" }).then((d) => setAll(d.items || [])); }, []);

  /* Keep the URL in sync, and promote two-tool comparisons to a real path.
   *
   * Two tools is what people actually search for ("notion vs obsidian"), so a
   * pair gets its own indexable URL. Three stays on the query string: with 41
   * tools there are ~11,000 possible triples, and minting a page for each is
   * exactly the thin-content farm this site is meant not to be.
   *
   * The pair is always written in canonical (alphabetical) order, so picking
   * B then A lands on the same URL as picking A then B. */
  useEffect(() => {
    if (picked.length === 2) {
      const canonical = pairSlug(picked[0], picked[1]);
      if (pair !== canonical) navigate(`/compare/${canonical}`, { replace: true });
      return;
    }
    // dropped back to 0, 1 or 3 tools — leave the pair URL for the picker
    if (pair) {
      navigate(picked.length ? `/compare?tools=${picked.join(",")}` : "/compare", { replace: true });
      return;
    }
    setParams(picked.length ? { tools: picked.join(",") } : {}, { replace: true });
  }, [picked, pair, navigate, setParams]);

  useEffect(() => {
    if (picked.length < 2) { setRows([]); return; }
    compareTools(picked).then((d) => setRows(d.items || []));
  }, [picked]);

  useEffect(() => { if (pickerOpen) searchRef.current?.focus(); }, [pickerOpen]);

  /* Three states, three SEO treatments.
   *
   *   /compare/a-vs-b   a real page for a real query — indexed, canonical to
   *                     itself, with the generated preview card
   *   /compare?tools=…  a working session, not a destination — noindex, and
   *                     canonical points at the bare picker so the ranking
   *                     signal isn't split across permutations
   *   /compare          the picker itself — indexed
   */
  const comparing = rows.length >= 2;
  const names = rows.map((r) => r.name);
  const onPairUrl = Boolean(pair) && picked.length === 2;

  const seo = onPairUrl
    ? {
      title: `${names.join(" vs ")} — which should you choose?`,
      description: `${names.join(" and ")} compared on price, free tier, ratings and the catch on each. Independent — no sponsored winners.`,
      image: `${API}/og/compare?slugs=${encodeURIComponent(picked.join(","))}`,
      path: `/compare/${pairSlug(picked[0], picked[1])}`,
      noIndex: false,
    }
    : comparing
      ? {
        title: `${names.join(" vs ")} — compared side by side`,
        description: `${names.join(", ")} compared on price, free tier, ratings and the catch on each.`,
        image: `${API}/og/compare?slugs=${encodeURIComponent(picked.join(","))}`,
        path: "/compare",
        noIndex: true,
      }
      : {
        title: "Compare tools side by side",
        description: "Put up to three tools head to head: price, free trial, ratings and the catch on each one.",
        image: "/og.svg",
        path: "/compare",
        noIndex: false,
      };

  const add = (slug) => {
    setPicked((p) => (p.includes(slug) || p.length >= MAX ? p : [...p, slug]));
    setQ("");
    if (picked.length + 1 >= MAX) setPickerOpen(false);
  };
  const drop = (slug) => setPicked((p) => p.filter((s) => s !== slug));

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: "Toolhaven comparison", url }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  /* Work out, per row, whether the three agree and which of them leads. Done
   * once per comparison rather than per cell. A row where everything matches has
   * no leader — crowning one of three identical values would be a lie. */
  const analysis = useMemo(() => {
    const out = {};
    for (const row of SHEET) {
      const vals = rows.map(row.read);
      const same = vals.every((v) => v === vals[0]);
      let winners = new Set();
      if (!same && row.best) {
        if (row.best === "yes") {
          rows.forEach((t, i) => { if (vals[i] === true) winners.add(t.slug); });
        } else {
          const target = row.best === "max" ? Math.max(...vals) : Math.min(...vals);
          rows.forEach((t, i) => { if (vals[i] === target) winners.add(t.slug); });
        }
        // every column leading is the same as none of them leading
        if (winners.size === rows.length) winners = new Set();
      }
      out[row.key] = { same, winners };
    }
    return out;
  }, [rows]);

  const visible = diffOnly ? SHEET.filter((r) => r.prose || !analysis[r.key]?.same) : SHEET;
  const hiddenCount = SHEET.length - visible.length;

  const pool = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all
      .filter((t) => !picked.includes(t.slug))
      .filter((t) => !term || t.name.toLowerCase().includes(term) || (t.category?.name || "").toLowerCase().includes(term))
      .slice(0, 8);
  }, [all, picked, q]);

  const bySlug = useMemo(() => Object.fromEntries(all.map((t) => [t.slug, t])), [all]);

  const trail = onPairUrl
    ? [
      { label: "Home", to: "/" },
      { label: "Compare", to: "/compare" },
      { label: names.join(" vs "), to: seo.path },
    ]
    : [{ label: "Home", to: "/" }, { label: "Compare", to: "/compare" }];

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-12 fade-in">
      <Seo
        title={seo.title}
        description={seo.description}
        image={seo.image}
        path={seo.path}
        noIndex={seo.noIndex}
        schema={breadcrumbSchema(trail)}
      />
      <Breadcrumbs trail={trail} />
      <PageHead kicker="Head to head" title="Compare tools">
        Pick up to three — they can be from different categories. Your comparison is a shareable link.
      </PageHead>

      {all.length === 0 ? <Loader /> : (
        <>
          {/* ===== the tray ===== */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-4">
            {Array.from({ length: MAX }).map((_, i) => {
              const slug = picked[i];
              const t = slug ? bySlug[slug] || rows.find((r) => r.slug === slug) : null;
              if (!t) {
                return (
                  <button key={`empty-${i}`} type="button" onClick={() => setPickerOpen(true)}
                    className="group flex flex-col items-center justify-center gap-2 min-h-[104px] sm:min-h-[124px] rounded-card border border-dashed border-rule text-ink2 hover:border-accent hover:text-accentDeep transition-colors">
                    <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
                    <span className="font-mono text-micro uppercase tracking-[.14em]">Add a tool</span>
                  </button>
                );
              }
              const color = t.category?.colorPrimary || "#0E1116";
              return (
                <div key={t.slug} className="relative flex flex-col items-center justify-center gap-2 min-h-[104px] sm:min-h-[124px] rounded-card border border-rule bg-paper px-2 py-3"
                  >
                  <button type="button" onClick={() => drop(t.slug)} aria-label={`Remove ${t.name}`}
                    className="absolute top-1.5 right-1.5 grid place-items-center w-8 h-8 rounded-full text-ink2 hover:text-accentDeep hover:bg-paper2 transition-colors">
                    <X size={15} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                  <span aria-hidden="true"
                    className="grid place-items-center w-11 h-11 sm:w-12 sm:h-12 rounded-ui border border-rule font-display font-bold text-lg text-white"
                    style={{ background: color }}>
                    {t.logoMono || t.name[0]}
                  </span>
                  <span className="font-display font-semibold leading-tight text-center text-sm sm:text-base line-clamp-2">{t.name}</span>
                </div>
              );
            })}
          </div>

          {/* ===== search ===== */}
          {picked.length < MAX && (
            <div className="mb-8">
              {!pickerOpen ? (
                <button type="button" onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-2 min-h-touch font-mono text-xs uppercase tracking-wide border border-rule rounded-ui px-4 bg-paper hover:bg-paper2 transition-colors">
                  <Search size={14} strokeWidth={2.5} aria-hidden="true" /> Find a tool
                </button>
              ) : (
                <div className="border border-rule rounded-card bg-paper overflow-hidden" >
                  <div className="flex items-center gap-3 px-4 border-b border-rule">
                    <Search size={17} strokeWidth={2.5} aria-hidden="true" className="text-accentDeep shrink-0" />
                    <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Escape") setPickerOpen(false); if (e.key === "Enter" && pool[0]) add(pool[0].slug); }}
                      placeholder="Search by name or category…" aria-label="Search tools to compare"
                      className="flex-1 min-w-0 bg-transparent outline-none text-base min-h-touch" />
                    <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close search"
                      className="grid place-items-center w-9 h-9 rounded-full text-ink2 hover:text-accentDeep transition-colors shrink-0">
                      <X size={16} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  </div>
                  <ul className="max-h-72 overflow-auto py-1">
                    {pool.length === 0 && (
                      <li className="px-4 py-6 text-center font-mono text-xs uppercase tracking-wide text-ink2">
                        Nothing matches — try another word
                      </li>
                    )}
                    {pool.map((t) => (
                      <li key={t.slug}>
                        <button type="button" onClick={() => add(t.slug)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 min-h-touch text-left hover:bg-paper2 transition-colors">
                          <span aria-hidden="true"
                            className="grid place-items-center w-9 h-9 shrink-0 rounded-ui border border-rule font-display font-bold text-sm text-white"
                            style={{ background: t.category?.colorPrimary || "#0E1116" }}>
                            {t.logoMono || t.name[0]}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-display font-semibold leading-tight truncate">{t.name}</span>
                            <span className="block font-mono text-micro uppercase tracking-wide text-ink2 truncate">{t.category?.name}</span>
                          </span>
                          <Stars r={t.rating} showNum={false} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {rows.length >= 2 ? (
        <>
          {/* ===== sheet controls ===== */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <label className="inline-flex items-center gap-2.5 min-h-touch cursor-pointer select-none">
              <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)}
                className="w-4 h-4 accent-accent cursor-pointer" />
              <span className="font-mono text-xs uppercase tracking-wide">
                Differences only
                {diffOnly && hiddenCount > 0 && (
                  <span className="text-ink2"> · {hiddenCount} row{hiddenCount === 1 ? "" : "s"} hidden</span>
                )}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <button onClick={share} className="stamp text-xs">
                {copied ? <>Link copied <Check size={13} aria-hidden="true" /></>
                  : <>{navigatorHasShare() ? <Share2 size={13} aria-hidden="true" /> : <LinkIcon size={13} aria-hidden="true" />} Share</>}
              </button>
              <button onClick={() => setPicked([])}
                className="inline-flex items-center min-h-touch font-mono text-label uppercase tracking-wide border border-rule rounded-ui px-4 hover:bg-paper2 transition-colors">
                Clear
              </button>
            </div>
          </div>

          {/* ===== the sheet ===== */}
          <Reveal key={picked.join("-")} className="cmp-wrap border border-rule rounded-card bg-paper">
            <table className="cmp w-full text-sm border-collapse">
              <caption className="sr-only">
                {rows.map((r) => r.name).join(" versus ")} compared across {visible.length} attributes
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="cmp-corner" />
                  {rows.map((t) => (
                    <th key={t.slug} scope="col" className="cmp-head">
                      <span aria-hidden="true"
                        className="grid place-items-center w-11 h-11 mx-auto mb-2 rounded-ui border border-rule font-display font-bold text-white"
                        style={{ background: t.category?.colorPrimary || "#0E1116" }}>
                        {t.logoMono || t.name[0]}
                      </span>
                      <Link to={`/tools/${t.slug}`}
                        className="font-display text-base sm:text-lg font-semibold leading-tight block hover:text-accentDeep transition-colors text-balance">
                        {t.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const { winners } = analysis[row.key] || { winners: new Set() };
                  return (
                    <tr key={row.key} className={row.catch ? "cmp-catch" : ""}>
                      <th scope="row" className="cmp-label">
                        {row.catch && <span aria-hidden="true" className="inline-block align-middle mr-2 w-1.5 h-1.5 bg-accent" />}
                        {row.label}
                      </th>
                      {rows.map((t) => {
                        const won = winners.has(t.slug);
                        return (
                          <td key={t.slug} className={`cmp-cell ${row.prose ? "cmp-prose" : ""} ${won ? "cmp-won" : ""}`}>
                            {row.show ? row.show(t) : row.read(t)}
                            {won && (
                              <span className="cmp-flag font-mono text-nano uppercase tracking-[.12em]">
                                <Check size={11} strokeWidth={3} aria-hidden="true" />
                                Leads
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr>
                  <th scope="row" className="cmp-label" />
                  {rows.map((t) => (
                    <td key={t.slug} className="cmp-cell">
                      {/* Named, and quiet. Two accent-red "Get it" stamps side
                          by side made a comparison table look like a pair of
                          adverts competing — the one thing this page must not
                          feel like. Outlined, and it says where it goes. */}
                      <button onClick={() => goAffiliate(t, "compare")} aria-describedby="aff-note-compare"
                        className="inline-flex items-center gap-2 min-h-touch font-mono text-label uppercase tracking-[.1em]
                          border border-rule rounded-ui px-4 bg-paper hover:bg-ink hover:text-paper transition-colors">
                        Visit {t.name} <ArrowUpRight size={13} aria-hidden="true" />
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Reveal>

          <p id="aff-note-compare" className="font-mono text-label uppercase tracking-[.12em] text-ink2 mt-4 text-pretty">
            The "Get it" links are partner links. They never affect the ranking.{" "}
            <Link to="/disclosure" className="underline underline-offset-2 hover:text-accentDeep transition-colors">How we make money</Link>
          </p>
        </>
      ) : all.length > 0 && (
        <div className="border border-dashed border-rule rounded-card px-6 py-12 text-center">
          <p className="font-display text-xl sm:text-2xl font-semibold text-balance mb-2">
            {picked.length === 1 ? "One more and we can compare." : "Nothing on the bench yet."}
          </p>
          <p className="text-ink2 max-w-measure-sm mx-auto text-pretty">
            {picked.length === 1
              ? "Add a second tool and the sheet builds itself — including the catch on each one."
              : "Pick two or three tools and we'll lay them out side by side: price, trial, and the catch on each."}
          </p>
        </div>
      )}
    </div>
  );
}

function navigatorHasShare() {
  return typeof navigator !== "undefined" && !!navigator.share;
}
