/**
 * The buying guides index.
 *
 * Kept clearly downstream of the software index in the site's own hierarchy:
 * Toolhaven is a software publication that also writes about the hardware you
 * run it on, not an Amazon storefront wearing a masthead. The copy on this page
 * says so plainly rather than leaving a reader to work out why monitors have
 * turned up on a tools site.
 */
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { getGuides } from "../api/client.js";
import { useData } from "../lib/helpers.jsx";
import { PageHead } from "../components/editorial.jsx";
import { Breadcrumbs } from "../components/breadcrumbs.jsx";
import { Reveal } from "../components/motion.jsx";
import { Seo, breadcrumbSchema } from "../lib/seo.jsx";

const when = (iso) => (iso
  ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  : null);

export default function GuidesIndex() {
  const { data, loading } = useData(getGuides, []);
  const items = data?.items || [];
  const trail = [{ label: "Home", to: "/" }, { label: "Buying guides", to: "/guides" }];

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-6 py-10 sm:py-14 fade-in">
      <Seo
        title="Buying guides"
        description="Hardware recommendations for people who work on a computer all day — what we'd buy, what we wouldn't, and why."
        path="/guides"
        schema={breadcrumbSchema(trail)}
      />
      <Breadcrumbs trail={trail} />
      <PageHead kicker="Buying guides" title="The kit, not just the software">
        We spend most of our time on what runs on the machine. These are about the machine — chosen
        the same way, with the drawbacks written down.
      </PageHead>

      {loading && <p className="text-ink2">Loading…</p>}

      {!loading && items.length === 0 && (
        <div className="border border-dashed border-rule rounded-card px-6 py-14 text-center">
          <p className="font-display text-xl sm:text-2xl font-semibold text-balance mb-2">
            No guides published yet.
          </p>
          <p className="text-ink2 max-w-measure-sm mx-auto text-pretty mb-6">
            We only publish one when we have something worth saying — the software index is where
            everything else lives.
          </p>
          <Link to="/tools" className="stamp">Browse the directory →</Link>
        </div>
      )}

      {items.length > 0 && (
        <Reveal stagger className="grid sm:grid-cols-2 gap-4">
          {items.map((g) => (
            <Link key={g.slug} to={`/guides/${g.slug}`}
              className="group relative flex flex-col h-full rounded-card bg-paper border border-rule shadow-press
                transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-press-lg p-5">
              {g.category && (
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] rounded-t-card"
                  style={{ background: g.category.colorPrimary }} />
              )}
              {g.category && (
                <p className="font-mono text-nano uppercase tracking-[.16em] mb-2 text-ink2">{g.category.name}</p>
              )}
              <h2 className="font-display text-xl sm:text-2xl font-semibold leading-tight tracking-tight mb-2 text-balance">
                {g.title}
              </h2>
              {g.standfirst && (
                <p className="text-sm text-ink2 leading-snug line-clamp-3 mb-4 text-pretty">{g.standfirst}</p>
              )}
              <p className="mt-auto pt-3 border-t border-rule flex items-center justify-between gap-3 font-mono text-nano uppercase tracking-[.12em] text-ink2">
                <span className="tabular-nums">
                  {g.pickCount} pick{g.pickCount === 1 ? "" : "s"}
                  {g.updatedAt ? ` · ${when(g.updatedAt)}` : ""}
                </span>
                <ArrowUpRight size={14} aria-hidden="true"
                  className="shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </p>
            </Link>
          ))}
        </Reveal>
      )}

      <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mt-8 text-pretty">
        Guides contain Amazon affiliate links. They never change what we recommend —{" "}
        <Link to="/disclosure" className="underline underline-offset-4">how we're paid</Link>.
      </p>
    </div>
  );
}
