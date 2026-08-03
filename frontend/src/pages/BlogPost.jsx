import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { getPost } from "../api/client.js";
import { useData } from "../lib/helpers.jsx";
import { Loader } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";
import { NotFoundBlock } from "../components/editorial.jsx";
import { ArticleCover, ToolRail } from "../components/blogvisuals.jsx";
import { BlogFigure } from "../components/blogfigures.jsx";

export default function BlogPost() {
  const { slug } = useParams();
  const { data: post, loading, error } = useData(() => getPost(slug), [slug]);

  if (loading) return <Loader />;
  if (error || !post) return <NotFoundBlock code="" kicker="Missing" title="Post not found."
    message="That story isn't in print — it may have moved or been unpublished." to="/blog" cta="Back to the blog →" />;
  const color = post.category?.colorPrimary || "#1C1714";

  // the first paragraph gets the inked drop-cap; the rest read straight
  let firstParagraph = true;

  return (
    <article className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-12 fade-in">
      <Link to="/blog"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[.18em] text-ink2 hover:text-accentDeep transition-colors mb-6">
        ← The reading room
      </Link>

      {/* generated magazine cover — colour, riso wash, and the tools the piece covers */}
      <ArticleCover post={post} />

      <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4 leading-[1.05]">{post.title}</h1>
      <p className="font-mono text-xs uppercase tracking-wide text-ink2 mb-9">
        {post.author ? `By ${post.author} · ` : ""}{post.readTime} min read
      </p>

      <div className="prose-toolhaven space-y-5 text-lg leading-relaxed">
        <ReactMarkdown
          urlTransform={(u) => u}
          components={{
            // a lone image is our figure token — render the diagram, not a <p><img>
            p: ({ node, children }) => {
              const only = node?.children?.length === 1 && node.children[0];
              if (only && only.tagName === "img") {
                const p = only.properties || {};
                return <BlogFigure src={p.src} alt={p.alt} title={p.title} color={color} />;
              }
              const drop = firstParagraph;
              firstParagraph = false;
              return <p className={drop ? "drop-cap text-pretty" : "text-pretty"}>{children}</p>;
            },
            img: ({ src, alt, title }) => <BlogFigure src={src} alt={alt} title={title} color={color} />,
            // section heads get a category-coloured tab so the article reads in chapters
            h2: ({ children }) => (
              <h2 className="font-display text-2xl md:text-[1.7rem] font-semibold mt-10 mb-3 flex items-baseline gap-3">
                <span className="inline-block h-5 w-1.5 rounded-full translate-y-1 shrink-0" style={{ background: color }} />
                <span>{children}</span>
              </h2>
            ),
            a: ({ children, href }) => (
              <a href={href} className="underline decoration-2 underline-offset-2 font-medium" style={{ color }}>{children}</a>
            ),
            li: ({ children }) => <li className="ml-5 list-disc marker:text-accent">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="my-8 pl-6 border-l-4 font-display text-xl md:text-2xl font-medium italic leading-snug"
                style={{ borderColor: color }}>{children}</blockquote>
            ),
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          }}>
          {post.content}
        </ReactMarkdown>
      </div>

      {post.toolLinks?.length > 0 && (
        <Reveal className="mt-14 border-t-2 border-ink pt-6">
          <h3 className="font-mono text-xs uppercase tracking-[.18em] text-accentDeep mb-5">Tools mentioned in this piece</h3>
          <ToolRail links={post.toolLinks} color={color} />
        </Reveal>
      )}
    </article>
  );
}
