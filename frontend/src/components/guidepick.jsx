/**
 * A recommended product inside a buying guide.
 *
 * The hard part of an affiliate page is not making it look expensive — it is
 * making it not look bought. So the shape of this card puts the editorial
 * judgement first and the commercial link last, and gives the drawbacks the
 * same visual weight as the strengths. A card where the cons column is quieter
 * than the pros column is an advert with a fig leaf on it.
 *
 * There is no price and no star rating anywhere in here, by design. Amazon's
 * prices move hourly, so a printed number would be wrong within the day, and
 * repeating Amazon's rating without their sample is borrowed authority. The
 * link says "check current price" and means exactly that.
 */
import { Check, X, ArrowUpRight } from "lucide-react";
import { formatInline } from "../lib/richtext.jsx";

const apiOrigin = () =>
  (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");

/**
 * One pick, laid out as a record rather than a paragraph with labels glued on.
 *
 * The old shape ran everything down a single column and set "Best for" and
 * "Look elsewhere if" as inline runs — a label, an em dash, a sentence — which
 * is the hardest possible thing to scan and hid the fact that those two are a
 * matched pair. It also set the drawback in a lighter grey than the strength,
 * which quietly told the reader which one mattered. This file's own header says
 * the downsides get equal weight; the code was not keeping that promise.
 *
 * The order now follows the order a buyer actually decides in:
 *
 *   who it is        rank, award, brand, name
 *   what we think    the verdict, set as the lead
 *   is it me?        best for / look elsewhere, side by side, equal weight
 *   the numbers      specifications
 *   the balance      what's good / what's not, side by side, equal weight
 *   the action       the link, with its disclosure attached
 *
 * Each block is separated by a hairline, so the card reads as sections rather
 * than as one long scroll of prose.
 */
export function GuidePick({ pick, index }) {
  // The gallery, with the single image as the fallback for older picks.
  const photos = (pick.photos && pick.photos.length)
    ? pick.photos
    : (pick.imageUrl ? [{ id: 0, url: pick.imageUrl, alt: pick.imageAlt }] : []);
  const lead = photos[0];
  const rank = String((index ?? 0) + 1).padStart(2, "0");
  const anchor = `pick-${pick.id}`;

  return (
    <article id={anchor} className="scroll-mt-24 border border-rule rounded-card bg-surface overflow-hidden">

      {/* The masthead: the rank as the identifying mark, the award beside it.
          This was a full-width black bar, which turned a page of six picks into
          a set of stripes and shouted the award louder than the product. */}
      <div className="flex items-baseline gap-4 px-4 sm:px-6 py-3 border-b border-rule">
        <span aria-hidden="true" className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-ink2/50 leading-none">
          {rank}
        </span>
        {pick.award && (
          <p className="font-mono text-micro uppercase tracking-[.18em] text-accentDeep">{pick.award}</p>
        )}
        <span aria-hidden="true" className="flex-1 h-px bg-rule" />
      </div>

      {/* Identity and judgement. */}
      <div className="p-4 sm:p-6 grid sm:grid-cols-[13rem_1fr] lg:grid-cols-[15rem_1fr] gap-5 sm:gap-7">
        {lead && (
          <div>
            {/* Product photographs are landscape. A square frame letterboxed
                every one of them and wasted a third of the space it took. */}
            <div className="aspect-[4/3] rounded-ui border border-rule bg-paper2/40 overflow-hidden">
              <img src={apiOrigin() + lead.url} alt={lead.alt || pick.imageAlt || pick.name}
                loading={index > 1 ? "lazy" : "eager"} decoding="async"
                className="w-full h-full object-contain p-2.5" />
            </div>

            {/* The other angles. Three across rather than four, so each one is
                big enough to tell what it shows. */}
            {photos.length > 1 && (
              <ul className="grid grid-cols-3 gap-1.5 mt-1.5">
                {photos.slice(1, 4).map((ph) => (
                  <li key={ph.id} className="aspect-[4/3] rounded-tight border border-rule bg-paper2/40 overflow-hidden">
                    <img src={apiOrigin() + ph.url} alt={ph.alt || ""}
                      loading="lazy" decoding="async"
                      className="w-full h-full object-contain p-1" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="min-w-0">
          {pick.brand && (
            <p className="font-mono text-nano uppercase tracking-[.18em] text-ink2 mb-1.5">{pick.brand}</p>
          )}
          <h3 className="font-display text-2xl sm:text-[28px] font-semibold leading-[1.15] tracking-tight text-balance">
            {pick.name}
          </h3>
          {pick.model && (
            <p className="font-mono text-nano uppercase tracking-[.12em] text-ink2 mt-1.5">Model {pick.model}</p>
          )}

          {pick.verdict && (
            <p className="text-base sm:text-[17px] leading-relaxed text-pretty mt-4 max-w-measure">{formatInline(pick.verdict)}</p>
          )}
        </div>
      </div>

      {/* Fit. Two halves of one question — who this suits, and who it does not.
          Side by side, same size, same colour, divided by a rule, so the answer
          a reader is looking for is one glance rather than a paragraph hunt. */}
      {(pick.bestFor || pick.considerElseIf) && (
        <dl className="grid sm:grid-cols-2 border-t border-rule divide-y sm:divide-y-0 sm:divide-x divide-rule">
          {pick.bestFor && (
            <div className="px-4 sm:px-6 py-4">
              <dt className="font-mono text-nano uppercase tracking-[.16em] text-ink2 mb-1.5">Best for</dt>
              <dd className="text-sm leading-snug text-pretty">{formatInline(pick.bestFor)}</dd>
            </div>
          )}
          {pick.considerElseIf && (
            <div className="px-4 sm:px-6 py-4">
              <dt className="font-mono text-nano uppercase tracking-[.16em] text-ink2 mb-1.5">Look elsewhere if</dt>
              {/* Full-strength ink, deliberately. This used to be set two shades
                  lighter than "Best for", which is how an advert tells you which
                  half to skip. */}
              <dd className="text-sm leading-snug text-pretty">{formatInline(pick.considerElseIf)}</dd>
            </div>
          )}
        </dl>
      )}

      {/* The numbers, as a ruled two-column key/value set. Tabular figures so
          the values line up down the column instead of dancing. */}
      {pick.specs?.length > 0 && (
        <div className="border-t border-rule px-4 sm:px-6 py-4">
          <p className="font-mono text-nano uppercase tracking-[.16em] text-ink2 mb-2">Specifications</p>
          <dl className="grid sm:grid-cols-2 gap-x-8">
            {pick.specs.map((sp) => (
              <div key={sp.label} className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5">
                <dt className="font-mono text-nano uppercase tracking-[.1em] text-ink2 shrink-0">{sp.label}</dt>
                <dd className="text-sm text-right tabular-nums">{sp.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* The balance. Both columns, same weight, same size. */}
      {(pick.pros?.length > 0 || pick.cons?.length > 0) && (
        <div className="grid sm:grid-cols-2 border-t border-rule divide-y sm:divide-y-0 sm:divide-x divide-rule">
          {pick.pros?.length > 0 && (
            <div className="px-4 sm:px-6 py-4">
              <p className="font-mono text-nano uppercase tracking-[.16em] text-ink2 mb-2">What&rsquo;s good</p>
              <ul className="space-y-1.5">
                {pick.pros.map((x) => (
                  <li key={x} className="flex gap-2.5 text-sm leading-snug">
                    <Check size={14} aria-hidden="true" className="text-green-700 shrink-0 mt-[3px]" />
                    <span className="text-pretty">{formatInline(x)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pick.cons?.length > 0 && (
            <div className="px-4 sm:px-6 py-4">
              <p className="font-mono text-nano uppercase tracking-[.16em] text-ink2 mb-2">What&rsquo;s not</p>
              <ul className="space-y-1.5">
                {pick.cons.map((x) => (
                  <li key={x} className="flex gap-2.5 text-sm leading-snug">
                    <X size={14} aria-hidden="true" className="text-accentDeep shrink-0 mt-[3px]" />
                    <span className="text-pretty">{formatInline(x)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* The action, on its own ruled footer with the disclosure attached to it
          rather than buried at the bottom of the page. */}
      {pick.amazonUrl && (
        <div className="border-t border-rule bg-paper2/40 px-4 sm:px-6 py-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* "Check current price" is the honest verb for a link to a page
              whose price we do not know and will not print. */}
          <a href={pick.amazonUrl} target="_blank" rel="nofollow sponsored noopener noreferrer"
            className="stamp text-xs">
            Check current price on Amazon <ArrowUpRight size={14} aria-hidden="true" />
          </a>
          <span className="font-mono text-nano uppercase tracking-[.12em] text-ink2">
            Affiliate link &middot; price and availability change
          </span>
        </div>
      )}
    </article>
  );
}

/**
 * The comparison table.
 *
 * Only rendered when there is more than one pick and they share specification
 * labels — a table with one filled column and three empty ones tells a reader
 * less than no table at all.
 */
export function GuideComparison({ picks }) {
  const usable = picks.filter((p) => p.specs?.length);
  if (usable.length < 2) return null;

  // Only labels most picks actually carry, so the table has no ghost rows.
  const counts = new Map();
  for (const p of usable) for (const s of p.specs) counts.set(s.label, (counts.get(s.label) || 0) + 1);
  const labels = [...counts.entries()]
    .filter(([, n]) => n >= Math.ceil(usable.length / 2))
    .map(([l]) => l)
    .slice(0, 8);
  if (!labels.length) return null;

  const valueFor = (p, label) => p.specs.find((s) => s.label === label)?.value || "—";

  return (
    <section aria-labelledby="compare" className="mb-12">
      <h2 id="compare" className="font-display text-title font-semibold mb-1">Side by side</h2>
      <p className="font-mono text-micro uppercase tracking-[.12em] text-ink2 mb-5">
        The specifications that differ between them
      </p>

      <div className="overflow-x-auto border border-rule rounded-card">
        <table className="w-full text-sm border-collapse min-w-[34rem]">
          <caption className="sr-only">Specifications compared across every pick in this guide</caption>
          <thead>
            <tr className="border-b border-rule bg-paper2/40">
              <th scope="col" className="text-left font-mono text-nano uppercase tracking-[.14em] text-ink2 p-3 whitespace-nowrap">
                Spec
              </th>
              {usable.map((p) => (
                <th key={p.id} scope="col" className="text-left font-display text-base font-semibold p-3 align-bottom">
                  {p.name}
                  {p.award && (
                    <span className="block font-mono text-nano uppercase tracking-[.12em] text-accentDeep font-normal mt-0.5">
                      {p.award}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label} className="border-b border-rule last:border-0">
                <th scope="row" className="text-left font-mono text-nano uppercase tracking-[.1em] text-ink2 p-3 align-top whitespace-nowrap">
                  {label}
                </th>
                {usable.map((p) => (
                  <td key={p.id} className="p-3 align-top tabular-nums">{valueFor(p, label)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
