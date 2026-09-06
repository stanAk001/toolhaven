// Generated article furniture — no stock photography (which would fight the
// print aesthetic). Instead each post gets a magazine cover built from its own
// category colour, a risograph wash, and a "contact sheet" of the tools the
// piece actually covers: decorative and informative in one move.
import { Link } from "react-router-dom";


export function ArticleCover({ post }) {
  const c = post.category || {};
  const color = c.colorPrimary || "#0E1116";
  const tools = (post.toolLinks || []).map((l) => l.tool).filter(Boolean);
  const ghost = (c.name || "Read").split(" ")[0];

  return (
    <figure className="relative overflow-hidden rounded-card border border-rule bg-surface mb-8">
      {/* The category's colour as the rule that files the piece, not as a
          ground. This used to be a full flood of it, a radial accent wash over
          that, and the category word set huge in 10% white bleeding off the
          corner — three layers of decoration under one line of type. */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} />

      <div className="relative p-5 sm:p-6 md:p-8 pt-6">
        <span className="inline-flex items-center gap-2 font-mono text-nano uppercase tracking-[.16em] text-ink2">
          <span aria-hidden="true" className="w-1.5 h-1.5" style={{ background: color }} />
          {c.name || "Field notes"}{post.readTime ? ` · ${post.readTime} min read` : ""}
        </span>

        {tools.length > 0 ? (
          <div className="mt-7">
            <p className="font-mono text-nano uppercase tracking-[.16em] text-ink2 mb-3">The tools in this piece</p>
            <div className="flex flex-wrap gap-2.5">
              {tools.map((t, i) => (
                <span key={t.slug} title={t.name}
                  className="grid place-items-center min-w-[3rem] h-12 px-2.5 rounded-tight bg-paper2 border border-rule
                    font-mono text-base font-semibold text-ink2">
                  {t.logoMono || (t.name || "?")[0]}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <span aria-hidden="true" className="block mt-6 font-display text-3xl font-semibold text-ink2/40">{ghost}</span>
        )}
      </div>
    </figure>
  );
}

// The footer rail of tools the article references — monogram tiles that link
// through to each tool's page, so a reader can act on the piece immediately.
export function ToolRail({ links = [], color = "#0E1116" }) {
  return (
    <div className="flex flex-wrap gap-3">
      {links.map((l) => (
        <Link key={l.id} to={`/tools/${l.tool.slug}`}
          className="group/r inline-flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-ui border border-rule bg-paper
            transition-transform duration-200 hover:-translate-y-0.5"
          >
          <span className="grid place-items-center w-8 h-8 rounded-full font-display text-sm font-semibold text-white shrink-0"
            style={{ background: l.tool.category?.colorPrimary || color }}>
            {l.tool.logoMono || l.tool.name[0]}
          </span>
          <span className="font-mono text-label uppercase tracking-wide">{l.tool.name}</span>
        </Link>
      ))}
    </div>
  );
}
