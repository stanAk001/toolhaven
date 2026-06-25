// Generated article furniture — no stock photography (which would fight the
// print aesthetic). Instead each post gets a magazine cover built from its own
// category colour, a risograph wash, and a "contact sheet" of the tools the
// piece actually covers: decorative and informative in one move.
import { Link } from "react-router-dom";

const ROT = [-3, 2, -2, 3, -1, 2, -3, 1];

export function ArticleCover({ post }) {
  const c = post.category || {};
  const color = c.colorPrimary || "#1C1714";
  const accent = c.colorAccent || "#E8431F";
  const tools = (post.toolLinks || []).map((l) => l.tool).filter(Boolean);
  const ghost = (c.name || "Read").split(" ")[0];

  return (
    <figure className="relative overflow-hidden rounded-2xl border-2 border-ink mb-8"
      style={{ background: color, boxShadow: "6px 6px 0 var(--shadow-cast)" }}>
      {/* a wash of the category's accent, the print tooth, and the category word bleeding off the corner */}
      <span aria-hidden="true" className="absolute inset-0"
        style={{ background: `radial-gradient(130% 130% at 100% 0%, ${accent}66, transparent 55%)` }} />
      <span aria-hidden="true" className="halftone absolute inset-0 opacity-20 mix-blend-multiply" />
      <span aria-hidden="true"
        className="absolute -bottom-6 -right-3 font-display font-semibold text-white/10 leading-none select-none"
        style={{ fontSize: "clamp(90px,17vw,210px)" }}>{ghost}</span>

      <div className="relative p-6 md:p-9">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.2em] text-white/90">
          <span className="w-2 h-2 rounded-full bg-white" />
          {c.name || "Field notes"}{post.readTime ? ` · ${post.readTime} min read` : ""}
        </span>

        {tools.length > 0 ? (
          <div className="mt-7">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-white/70 mb-3">The tools in this piece</p>
            <div className="flex flex-wrap gap-2.5">
              {tools.map((t, i) => (
                <span key={t.slug} title={t.name}
                  style={{ "--r": `${ROT[i % ROT.length]}deg`, boxShadow: "2px 2px 0 var(--shadow-cast)" }}
                  className="grid place-items-center min-w-[3rem] h-12 px-2.5 rounded-lg bg-paper border-2 border-ink
                    font-display text-xl font-semibold text-ink rotate-[var(--r)] transition-transform duration-300 hover:rotate-0 hover:-translate-y-0.5">
                  {t.logoMono || (t.name || "?")[0]}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <span aria-hidden="true" className="block mt-6 font-display font-semibold text-white" style={{ fontSize: "64px" }}>{ghost[0]}</span>
        )}
      </div>
    </figure>
  );
}

// The footer rail of tools the article references — monogram tiles that link
// through to each tool's page, so a reader can act on the piece immediately.
export function ToolRail({ links = [], color = "#1C1714" }) {
  return (
    <div className="flex flex-wrap gap-3">
      {links.map((l) => (
        <Link key={l.id} to={`/tool/${l.tool.slug}`}
          className="group/r inline-flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-full border-2 border-ink bg-paper
            transition-transform duration-200 hover:-translate-y-0.5"
          style={{ boxShadow: "2px 2px 0 var(--shadow-cast)" }}>
          <span className="grid place-items-center w-8 h-8 rounded-full font-display text-sm font-semibold text-white shrink-0"
            style={{ background: l.tool.category?.colorPrimary || color }}>
            {l.tool.logoMono || l.tool.name[0]}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wide">{l.tool.name}</span>
        </Link>
      ))}
    </div>
  );
}
