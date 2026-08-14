// Breadcrumbs — orientation for readers, hierarchy for crawlers.
//
// Set as a press-sheet trail rather than a chevron chain, so it belongs to the
// rest of the furniture. The matching BreadcrumbList JSON-LD is emitted by the
// page's <Seo schema={...}> so there is one source of truth for the trail.
import { Link } from "react-router-dom";

/**
 * @param {{label: string, to?: string}[]} trail  last item is the current page
 */
export function Breadcrumbs({ trail = [], className = "" }) {
  if (trail.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className={`mb-5 ${className}`}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-micro uppercase tracking-[.14em] text-ink2">
        {trail.map((crumb, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={crumb.to || crumb.label} className="inline-flex items-center gap-2">
              {i > 0 && <span aria-hidden="true" className="text-accent">/</span>}
              {last || !crumb.to ? (
                <span aria-current="page" className="text-ink truncate max-w-[16rem]">{crumb.label}</span>
              ) : (
                // A full 44px tap height, pulled back with a negative margin so
                // the trail still reads as one tight line. Width stays the width
                // of the word: these are inline links in a line of text, which
                // is the case WCAG 2.2 target-size explicitly exempts, and
                // padding "Home" out to 44px wide would look broken.
                <Link to={crumb.to}
                  className="inline-flex items-center min-h-touch -my-2.5 hover:text-accentDeep transition-colors">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
