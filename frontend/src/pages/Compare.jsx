import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Check, X, ArrowUpRight, Share2, Link as LinkIcon } from "lucide-react";
import { getTools, compareTools } from "../api/client.js";
import { Stars, Loader } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { PageHead } from "../components/editorial.jsx";
import { goAffiliate, priceLabel } from "../lib/helpers.jsx";

const MAX = 3;
const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// upsert a <meta> tag so the comparison gets a title + preview image
function setMeta(attr, key, val) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", val);
}

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const [all, setAll] = useState([]);
  const [picked, setPicked] = useState(() => (params.get("tools") || "").split(",").filter(Boolean).slice(0, MAX));
  const [rows, setRows] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => { getTools({ limit: 100, sort: "popular" }).then((d) => setAll(d.items || [])); }, []);

  // keep the URL in sync so any comparison is a shareable link
  useEffect(() => {
    setParams(picked.length ? { tools: picked.join(",") } : {}, { replace: true });
  }, [picked, setParams]);

  useEffect(() => {
    if (picked.length < 2) { setRows([]); return; }
    compareTools(picked).then((d) => setRows(d.items || []));
  }, [picked]);

  // give the active comparison a title + social preview image (the dynamic OG)
  useEffect(() => {
    const fallback = "Toolhaven — The honest tools guide";
    if (rows.length >= 2) {
      const names = rows.map((r) => r.name).join(" vs ");
      const title = `${names} — compared on Toolhaven`;
      const image = `${API}/og/compare?slugs=${encodeURIComponent(picked.join(","))}`;
      document.title = title;
      setMeta("property", "og:title", title);
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:image", image);
      setMeta("property", "og:url", window.location.href);
    } else {
      document.title = "Compare tools — Toolhaven";
    }
    return () => { document.title = fallback; };
  }, [rows, picked]);

  const toggle = (slug) =>
    setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : p.length < MAX ? [...p, slug] : p));

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: "Toolhaven comparison", url }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const yn = (v) => v
    ? <span className="inline-flex items-center gap-1 text-green-700 font-semibold"><Check size={14} aria-hidden="true" /> Yes</span>
    : <span className="inline-flex items-center gap-1 text-accentDeep font-semibold"><X size={14} aria-hidden="true" /> No</span>;

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-12 fade-in">
      <PageHead kicker="Head to head" title="Compare tools">
        Pick up to three — they can be from different categories. Your comparison is a shareable link.
      </PageHead>

      {/* picker */}
      {all.length === 0 ? <Loader /> : (
        <div className="flex flex-wrap gap-2 mb-8">
          {all.map((t) => {
            const on = picked.includes(t.slug);
            const disabled = !on && picked.length >= MAX;
            return (
              <button key={t.slug} onClick={() => toggle(t.slug)} disabled={disabled}
                className={`inline-flex items-center font-mono text-xs uppercase px-4 min-h-touch rounded-full border-2 border-ink transition-colors ${on ? "text-white" : "bg-paper hover:bg-paper2"} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                style={on ? { background: t.category?.colorPrimary } : undefined}>
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      {/* share bar — appears once there's a real comparison */}
      {rows.length >= 2 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-2 border-ink rounded-2xl bg-paper p-4"
          style={{ boxShadow: "3px 3px 0 var(--shadow-cast)" }}>
          <p className="font-mono text-xs uppercase tracking-wide">
            Comparing <span className="text-accentDeep">{rows.map((r) => r.name).join(" vs ")}</span>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={share} className="stamp text-xs">
              {copied ? <>Link copied <Check size={13} aria-hidden="true" /></> : <>{navigatorHasShare() ? <Share2 size={13} aria-hidden="true" /> : <LinkIcon size={13} aria-hidden="true" />} Share</>}
            </button>
            <button onClick={() => setPicked([])} className="font-mono text-[11px] uppercase tracking-wide border-2 border-ink rounded-full px-3 py-1.5 hover:bg-paper2 transition-colors">Clear</button>
          </div>
        </div>
      )}

      {rows.length >= 2 ? (
        <Reveal key={picked.join("-")} className="overflow-x-auto border-2 border-ink rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="p-4" />
                {rows.map((t) => (
                  <th key={t.slug} className="p-4 text-center align-top min-w-[160px]">
                    <span className="w-12 h-12 mx-auto mb-2 grid place-items-center rounded-lg font-display font-bold text-white"
                      style={{ background: t.category?.colorPrimary }}>{t.logoMono || t.name[0]}</span>
                    <span className="font-display text-lg font-semibold block">{t.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Category">{rows.map((t) => <td key={t.slug} className="p-3 text-center">{t.category?.name}</td>)}</Row>
              <Row label="Rating">{rows.map((t) => <td key={t.slug} className="p-3 text-center"><Stars r={t.rating} /></td>)}</Row>
              <Row label="Price">{rows.map((t) => <td key={t.slug} className="p-3 text-center">{priceLabel(t)}</td>)}</Row>
              <Row label="Pricing model">{rows.map((t) => <td key={t.slug} className="p-3 text-center capitalize">{t.priceType}</td>)}</Row>
              <Row label="Free trial">{rows.map((t) => <td key={t.slug} className="p-3 text-center">{yn(t.freeTrial)}</td>)}</Row>
              <Row label="Free tier">{rows.map((t) => <td key={t.slug} className="p-3 text-center">{yn(t.freeTier)}</td>)}</Row>
              <Row label="">
                {rows.map((t) => (
                  <td key={t.slug} className="p-3 text-center">
                    <button onClick={() => goAffiliate(t, "compare")} aria-describedby="aff-note-compare" className="stamp text-xs">Get it <ArrowUpRight size={13} aria-hidden="true" /></button>
                    {/* the cell is narrow, so the short form here; the full sentence
                        sits once under the table where there's room to read it */}
                    <Link to="/disclosure"
                      className="block font-mono text-[11px] uppercase tracking-[.12em] text-ink2 mt-2 underline underline-offset-2 hover:text-accentDeep transition-colors">
                      Partner link
                    </Link>
                  </td>
                ))}
              </Row>
            </tbody>
          </table>
          <p id="aff-note-compare" className="font-mono text-[11px] uppercase tracking-[.12em] text-ink2 mt-4 text-pretty">
            <span className="text-accent" aria-hidden="true">✦</span>{" "}
            The "Get it" links are partner links — your price stays the same, and they never affect the ranking.{" "}
            <Link to="/disclosure" className="underline underline-offset-2 hover:text-accentDeep transition-colors">How we make money</Link>
          </p>
        </Reveal>
      ) : (
        <p className="font-mono text-sm text-ink2">Select at least two tools to see the comparison.</p>
      )}
    </div>
  );
}

function navigatorHasShare() {
  return typeof navigator !== "undefined" && !!navigator.share;
}

function Row({ label, children }) {
  return (
    <tr className="border-b border-ink/15">
      <td className="p-3 font-mono text-xs uppercase text-ink2 whitespace-nowrap">{label}</td>
      {children}
    </tr>
  );
}
