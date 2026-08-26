# Pricing intelligence

Toolhaven reads what tools cost from each vendor's own pricing page, on a
schedule, and stores the result. Tool pages serve the stored figure — a reader
never waits on an external website, and no vendor sees traffic proportional to
Toolhaven's.

The governing rule is **accuracy before completeness**. A price that cannot be
confirmed is not shown. There is no state in which the site invents a number.

## The pipeline

```
discover  →  fetch  →  extract  →  normalise  →  score  →  diff  →  store
```

| Stage | File | Does |
|---|---|---|
| Discover | `src/lib/pricing/discover.js` | Finds the vendor's own pricing page |
| Fetch | `src/lib/pricing/fetcher.js` | Retrieves it safely and politely |
| Guard | `src/lib/pricing/urlguard.js` | Refuses anything that is not public internet |
| Parse | `src/lib/pricing/html.js` | Turns HTML into lines, scripts removed first |
| Money | `src/lib/pricing/money.js` | Currency, amount, billing period |
| Extract | `src/lib/pricing/extract.js` | JSON-LD, embedded JSON, or the page layout |
| Tiers | `src/lib/pricing/tiers.js` | Tells a plan from an add-on; sanity checks |
| Normalise | `src/lib/pricing/normalize.js` | One internal shape, source text kept |
| Score | `src/lib/pricing/confidence.js` | Status and a 0–1 confidence |
| Diff | `src/lib/pricing/changes.js` | What moved since last time |
| Orchestrate | `src/lib/pricing/service.js` | Runs it, writes it, never overwrites a person |
| Schedule | `src/lib/pricing/scheduler.js` | Background refresh |

## Sources, in order

1. **The vendor's dedicated pricing page** — `/pricing`, `/plans` and the usual
   variants, then any link on their homepage labelled "Pricing".
2. **The vendor's website**, if it states pricing without a dedicated page.
3. **Structured data** on either — JSON-LD `Offer` is preferred over anything
   read from the layout, because the vendor published it deliberately.

Third-party pricing sites are **never** a source. A perfect parse of a
comparison blog is worse than no parse: it launders someone else's stale guess
into a figure published under Toolhaven's name.

## Confidence

A figure is only shown to readers at **0.80 or above** with status `verified`,
or **0.75 or above** with status `custom_pricing`. Anything lower is stored,
flagged `pendingReview`, and held for an editor.

Points come from provenance (same domain as the tool's website, a real pricing
page), extraction quality (JSON-LD beats layout), structure (several named
tiers), and completeness (currency, billing period).

Points are **taken away** for readings that do not hang together:

- a starting price under $2/month that is not usage-based (a usage rate misread as a plan)
- a zero starting price on a product with paid tiers
- a paid-sounding tier priced at zero (the page's prices never rendered)
- no plan carrying a recognisable tier name
- a single nameless plan
- tier prices spanning an implausible range
- a headline price not attached to a recognisable tier

Each of those is worth more than any single positive signal, because a wrong
price does far more damage to a review site than a missing one.

## Refresh cadence

Set per tool from its outbound clicks in the last 30 days:

| Traffic | Re-checked every |
|---|---|
| 25+ clicks | 2 days |
| 3–24 clicks | 7 days |
| under 3 | 21 days |

Failures back off rather than retry in a loop: 1 day, then 3, then 30 after
three consecutive failures.

The worker runs inside the API process, wakes every 5 minutes, and takes at
most 3 tools per pass. The fetcher spaces requests to any single host by 1.5s
regardless.

## Price changes

History is append-only. When a price moves, the previous state is written to
`ToolPricingHistory` before the new one takes its place — nothing is ever
edited away. Detected: increases, decreases, new plans, withdrawn plans, a free
plan appearing or disappearing, currency changes and billing-model changes.

A currency change is reported as itself rather than as a 400% rise.

Significant movement (15%+, or any structural change) is flagged on the admin
desk so an editor can look before readers do.

## Failure

Readers see one of three things and never a technical error:

- **a verified price**, with the date it was confirmed and a link to the source
- **"Quoted on request"**, when the vendor genuinely publishes no numbers
- **"Current pricing unavailable"**, with a link to the vendor's own page

The reason — blocked, timed out, nothing found, unexpected HTML — is written to
`PricingVerificationLog` for the desk, not to the page.

Roughly one vendor in six blocks automated requests outright (Cloudflare and
similar). That is expected, handled, and the reason the manual override exists.

## Security

Everything outbound goes through `urlguard.js`:

- `http`/`https` only, ports 80 and 443 only, no credentials in the URL
- hostnames are resolved and **every** resolved address is checked
- private, loopback, link-local, CGNAT, multicast and reserved ranges refused,
  including IPv4-mapped IPv6 forms
- **every redirect hop is re-checked** — the classic SSRF is a public URL that
  302s to `169.254.169.254`
- 12s timeout, 3MB response cap, 4 redirects maximum
- scripts and styles are stripped before anything else reads the page; nothing
  fetched is ever evaluated

Covered by tests in `tests/pricing.test.mjs`.

## Manual override

An editor always outranks the crawler. Approving, rejecting or correcting a
price marks the tool `isManualOverride`, and from then on the automation keeps
checking and reporting but does not overwrite. "Hand it back to the crawler"
clears it.

## Operating it

```
npm test                              the whole suite, no network
npm run pricing:verify                the 10 most due tools
node prisma/verify-pricing.js --all   every active tool
node prisma/verify-pricing.js --why make    what it read and why it scored
```

Admin desk: **/admin → Pricing**.

## Configuration

No API keys, no paid services, no new dependencies. One variable:

| Variable | Default | Effect |
|---|---|---|
| `PRICING_WORKER` | on | Set to `off` to stop background refreshing. Stored prices keep serving. |

## Known limits

- **JavaScript-rendered pricing** is not executed. Pages that build their price
  table client-side are detected (a paid tier reading as $0) and held rather
  than published. Headless browsing was not added: it would not fit a Render
  free instance, and the failure is safe.
- **Search-engine discovery** (finding a pricing page whose URL we cannot guess)
  is deliberately not wired to a scraper. The conventional paths plus the
  homepage link find it for the large majority of SaaS sites.
- **Currencies are never converted.** A page quoting naira is stored and shown
  in naira.
