// Homepage rails.
//
// Each rail states the measure it ranks by in its own subhead — "most outbound
// clicks in 30 days", "by review count" — because a list headed "Trending" with
// no stated basis is just an assertion. Saying the measure is also what stops
// the rails becoming a place to quietly promote partners: the reader can see
// what would have to be true for a tool to appear.
//
// A rail with nothing behind it does not render. An empty "Trending" shelf is
// worse than no shelf.
import { Link } from "react-router-dom";
import { ToolLogo } from "./toollogo.jsx";
import { Stars } from "./ui.jsx";
import { ScoreBadge } from "./score.jsx";
import { priceLabelShort } from "../lib/helpers.jsx";

// A rail scrolls sideways on a phone and lays out as a grid from lg up. The
// horizontal scroll is deliberate: four cards stacked vertically on mobile
// pushes everything below them off the screen.
export function ToolRail({ title, kicker, basis, tools = [], to, minimum = 3 }) {
  if (!tools || tools.length < minimum) return null;

  return (
    <section className="mb-12 sm:mb-16">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 mb-1.5">
        <div className="min-w-0">
          {kicker && (
            <p className="font-mono text-micro uppercase tracking-[.2em] text-accentDeep mb-1.5">{kicker}</p>
          )}
          <h2 className="font-display text-title font-semibold">{title}</h2>
        </div>
        {to && (
          <Link to={to}
            className="inline-flex items-center min-h-touch md:min-h-[28px] font-mono text-xs uppercase hover:text-accentDeep whitespace-nowrap transition-colors">
            See all →
          </Link>
        )}
      </div>

      {/* the measure, stated plainly */}
      {basis && (
        <p className="font-mono text-micro uppercase tracking-[.12em] text-ink2 mb-4">{basis}</p>
      )}
      <div className="rule-2 mb-5" />

      {/* A grid, not a scroller.
          These were fixed 240px cards on a horizontal rail, which on a 390px
          phone always left a second card sliced down the middle at the edge of
          the screen — it read as a broken layout rather than as an invitation
          to scroll, and the hard shadows were clipped along with it.
          Two across on a phone, four on a desktop, and the tail is trimmed on
          small screens so a rail stays a rail rather than becoming a page. */}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4
        [&>li:nth-child(n+5)]:hidden lg:[&>li:nth-child(n+5)]:block">
        {tools.slice(0, 8).map((t) => (
          <li key={t.slug}>
            <RailCard tool={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RailCard({ tool }) {
  return (
    <Link to={`/tools/${tool.slug}`}
      className="group flex flex-col h-full rounded-card bg-paper border border-rule shadow-press p-3 sm:p-4
        transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-press-lg">
      <div className="flex items-start justify-between gap-2 mb-2.5 sm:mb-3">
        <ToolLogo tool={tool} size={32} className="sm:hidden" />
        <ToolLogo tool={tool} size={40} className="hidden sm:block" />
        {tool.score && <ScoreBadge score={tool.score} />}
      </div>

      <h3 className="font-display text-base sm:text-lg font-semibold leading-tight tracking-tight mb-1">{tool.name}</h3>
      <p className="font-mono text-nano sm:text-micro uppercase tracking-wide text-ink2 mb-2 truncate">
        {tool.category?.name}
      </p>
      {/* Half a phone wide is not enough room to read three lines of summary
          and still see the price. It comes back at the first breakpoint that
          can hold it. */}
      <p className="hidden sm:block text-xs text-ink2 leading-snug line-clamp-3 mb-3">{tool.description}</p>

      <div className="mt-auto pt-2 flex items-center justify-between gap-2 font-mono text-nano sm:text-label text-ink2">
        <span className="tabular-nums truncate">{priceLabelShort(tool)}</span>
        {tool.reviewCount >= 3
          ? <Stars r={tool.rating} size={11} />
          : tool.topRating
            ? <span className="tabular-nums whitespace-nowrap">{tool.topRating.rating}/{tool.topRating.maxRating}</span>
            : null}
      </div>
    </Link>
  );
}
