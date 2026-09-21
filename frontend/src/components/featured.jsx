/**
 * Paid placements, on the surfaces that carry them.
 *
 * The design rule this file exists to hold: a promoted card looks like a
 * Toolhaven card, and says plainly that it is promoted. Not a banner, not a
 * different colour scheme, no countdown, no "sponsored by" bar across the page.
 * A reader should be able to tell at a glance which cards are paid for and
 * still find them pleasant to read — an advert that has to shout is one nobody
 * would otherwise look at.
 *
 * Kept structurally apart from the organic lists on purpose. This never merges
 * into a ranked result set: it is its own block, with its own heading, above or
 * beside the real ranking. Mixing the two is how a directory loses the right to
 * be believed.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { getFeaturedCampaigns } from "../api/client.js";
import { impressionRef, promoteHref, track } from "../lib/promotrack.js";
import { ToolLogo } from "./toollogo.jsx";

/** The label. Small, factual, and always present on a paid card. */
function Badge({ children = "Featured" }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-nano uppercase tracking-[.16em] text-ink2">
      <span aria-hidden="true" className="w-1.5 h-1.5 bg-accent" />
      {children}
    </span>
  );
}

function PromotedCard({ item, placement, label }) {
  const tool = item.tool || {};
  return (
    <article
      ref={impressionRef(item.slug, placement)}
      className="group relative flex flex-col h-full rounded-card bg-surface border border-rule
        shadow-press transition-[transform,box-shadow] duration-200 ease-out
        hover:-translate-y-0.5 hover:shadow-press-lg p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <ToolLogo tool={tool} size={36} className="shrink-0" />
        <Badge>{label}</Badge>
      </div>

      <h3 className="font-display text-lg sm:text-xl font-semibold leading-tight tracking-tight mb-1.5 text-balance">
        {/* The tool page, not the advertiser's site: a reader following the
            name is reading about the product, and the review they find is the
            one we wrote, not the one they paid for. */}
        <Link to={`/tools/${tool.slug}`} className="hover:text-accentDeep transition-colors"
          onClick={() => track(item.slug, "tool_view", placement)}>
          {item.headline || tool.name}
        </Link>
      </h3>

      <p className="text-sm text-ink2 leading-snug line-clamp-3 text-pretty mb-4">
        {item.message || tool.description}
      </p>

      <div className="mt-auto pt-3 border-t border-rule flex items-center justify-between gap-3">
        {tool.category ? (
          <Link to={`/categories/${tool.category.slug}`}
            className="font-mono text-nano uppercase tracking-[.12em] text-ink2 hover:text-ink transition-colors truncate">
            {tool.category.name}
          </Link>
        ) : <span />}

        {/* rel="sponsored nofollow" because it is a paid link, and Google is
            explicit that paid links must say so. It also keeps the promotion
            from leaking into organic ranking signals. */}
        <a href={promoteHref(item.slug, placement)}
          target="_blank" rel="sponsored nofollow noopener noreferrer"
          onClick={() => track(item.slug, "cta_click", placement)}
          className="inline-flex items-center gap-1.5 font-mono text-nano uppercase tracking-[.12em] text-ink
            hover:text-accentDeep transition-colors shrink-0">
          {item.ctaText || "Visit website"}
          <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

/**
 * A row of promoted tools for one placement.
 *
 * Renders nothing at all when no campaign is running. An empty "Featured"
 * heading is worse than no heading: it advertises that the slot is for sale in
 * the middle of a reader's page.
 */
export function FeaturedRow({
  placement = "HOMEPAGE_FEATURED",
  categorySlug = null,
  limit = 3,
  title = "Featured tools",
  blurb = "Tools currently receiving additional exposure on Toolhaven.",
  label = "Featured",
  className = "",
}) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    getFeaturedCampaigns({ placement, limit, ...(categorySlug ? { categorySlug } : {}) })
      .then((d) => { if (alive) setItems(d.items || []); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [placement, categorySlug, limit]);

  if (!items.length) return null;

  return (
    <section className={className} aria-labelledby={`featured-${placement.toLowerCase()}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
        <h2 id={`featured-${placement.toLowerCase()}`}
          className="font-display text-xl sm:text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <Link to="/promote"
          className="font-mono text-nano uppercase tracking-[.12em] text-ink2 hover:text-ink transition-colors">
          Promote your tool →
        </Link>
      </div>
      {/* Said once, in plain words, rather than implied by styling. */}
      <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mb-4">
        {blurb} Paid placement — it never affects our reviews or rankings.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {items.map((item) => (
          <PromotedCard key={item.slug} item={item} placement={placement} label={label} />
        ))}
      </div>
    </section>
  );
}
