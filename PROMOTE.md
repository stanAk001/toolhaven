# Toolhaven Promote — operating manual

Everything in this file is about the paid promotion feature: what it does, what
it refuses to do, and the exact steps to switch payments on.

---

## 1. Switching payments on

This is the only thing standing between the feature and taking money. The code
is complete and tested; the keys are yours to obtain.

### 1.1 Get the keys

| Provider | Used for | Where |
|---|---|---|
| Paystack | Nigerian buyers, charged in naira | dashboard.paystack.com → Settings → API Keys |
| Flutterwave | everyone else, charged in dollars | app.flutterwave.com → Settings → API |

Take the **secret** keys, not the public ones. Paystack's starts `sk_`.
Use the test keys first (`sk_test_…`) and verify before switching to live.

### 1.2 Put them in the environment

In `backend/.env` locally, and in Render → your service → Environment for
production:

```
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxx
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxxxxxxxxxxxxxxxx
FLUTTERWAVE_WEBHOOK_HASH=<any long random string you choose>
```

`FLUTTERWAVE_WEBHOOK_HASH` is a value **you invent** and then paste into
Flutterwave's dashboard. Flutterwave sends it back on every webhook, and the
server rejects any webhook that does not carry it.

### 1.3 Register the webhooks

Webhooks are how a payment becomes a live campaign when the buyer closes the
tab before returning. Without them, some paid campaigns will sit unstarted.

| Provider | URL to register |
|---|---|
| Paystack | `https://toolhavenbackend.onrender.com/api/promote/webhook/paystack` |
| Flutterwave | `https://toolhavenbackend.onrender.com/api/promote/webhook/flutterwave` |

In Flutterwave, paste your `FLUTTERWAVE_WEBHOOK_HASH` into the "Secret hash"
field on the same screen.

Both are verified against the **raw request bytes** — Paystack by HMAC-SHA512
signature, Flutterwave by the hash header. An unsigned or mis-signed webhook is
discarded.

### 1.4 Turn the scheduler on — on exactly one process

```
PROMOTE_WORKER=1
```

This starts and finishes campaigns and sends the vendor emails. Two processes
with this set means two "your campaign is live" emails for the same campaign.

### 1.5 Confirm it worked

Restart the backend and read the first few lines of the log:

```
[promote] naira → paystack ready
[promote] dollars → flutterwave ready
```

If a key is missing it says so by name. Then buy a campaign with a provider
test card end to end and check the dashboard shows it as paid.

---

## 2. What is on sale

Held in the database (`PromotionPlan`), editable from the admin screen. The
seed file `backend/prisma/seed-promotion.js` is the starting state.

| Package | Length | USD | NGN | Placements |
|---|---|---|---|---|
| Toolhaven Boost | 14 days | $27 | ₦15,000 | homepage, category, discovery |
| Toolhaven Boost | 30 days | $38 | ₦28,000 | homepage, category, discovery |
| Full promotion | 30 days | quoted | quoted | all six, including the by-hand ones |

**Build your own** is also offered: any combination of the four on-site
placements, 7–90 days, at **$0.75 / ₦480 per placement per day**, discounted
**10% at 14 days and 30% at 30 days**.

Those daily rates were chosen so that a package always undercuts assembling the
same thing by hand — there is a test (`tests/custom.test.mjs`) that fails if
that ever inverts. **If you change a package price, run that test.**

> The naira figures are numbers you set, not conversions of the dollar prices.
> Nothing in the codebase converts between currencies, deliberately: a rate
> nobody chose is a number nobody can stand behind.

---

## 3. Which money goes where

Decided entirely on the server, from where the request came from. The buyer is
never shown a currency switch and cannot ask for one — a price the browser
could choose is a price the browser could choose wrongly, and a Nigerian card
on a dollar charge is routinely declined.

```
Nigeria  → naira   → Paystack
anywhere else → dollars → Flutterwave
```

Resolution order (`backend/src/lib/promotion/geo.js`):

1. `GEO_COUNTRY` env override — only for reproducing what a visitor elsewhere sees
2. `x-vercel-ip-country` / `cf-ipcountry` edge headers, if any CDN sets them
3. **localhost** → this machine's own public location (see below)
4. a real geo-IP lookup on the caller's address, cached 24h per IP
5. `accept-language`, marked as a guess
6. nothing — falls back to dollars

**In production today, step 4 does the work.** The browser calls the Render API
directly, so Vercel's edge is never in that path and its header never arrives.

### Working on it locally

Nothing to configure. A request from `::1` or a LAN address means the visitor
is sitting at this computer, so the server resolves *this machine's* public
location — developing in Nigeria correctly shows naira and Paystack.

The private address itself is never sent to the geo service; it would be
meaningless. In production the caller's address is real and this branch never
runs.

To see what the server decided and why:

```
GET /api/promote/geo
→ {"country":"NG","source":"override","ip":"::1","currency":"NGN","provider":"paystack"}
```

`source` tells you which mechanism answered. `unknown` on your machine is the
private-address rule working correctly. `language` in production means the IP
lookup failed.

### Worth doing

Putting Cloudflare in front of the Render backend makes `cf-ipcountry` arrive
on every request: faster, free, and no third-party lookup. The free geo service
is rate limited (~1,000/day), and `GEOIP_URL` lets you point at a paid one
without a code change.

---

## 4. Where a paid campaign appears

| Placement | Rendered by | Slots |
|---|---|---|
| Homepage featured | `Home.jsx` | 3 |
| Category featured | `CategoryPage.jsx` | 2 per category |
| Discovery | `ToolsDirectory.jsx` | 3 shown of 6 sold |
| Buying guide | `BuyingGuide.jsx`, below every editorial element | 2 |
| Social | **an editor, by hand** | 2 |
| Newsletter | **an editor, by hand** | 1 |

Discovery sells more slots than the row shows, so selection rotates: the
**least-served campaign goes first**, ties broken at random. Delivery evens out
on its own and no campaign can be permanently shut out. Before this, the three
earliest-started campaigns took every impression forever and the other three
rendered zero times.

The two by-hand placements are marked as such everywhere they are sold. An
editor marks them done from the admin screen, and the vendor's dashboard shows
either the date it was sent or **"Not sent yet"** — never anything softer.

---

## 5. What money does not buy

Enforced by how the system is built, not by policy:

- Paid cards sit in their own labelled block. They are never merged into a
  ranked list, and ranking code knows nothing about campaigns.
- Every paid outbound link carries `rel="sponsored nofollow"`.
- On a buying guide the block sits **after** the picks and the comparison
  table, and is labelled "Sponsored" rather than "Featured".
- Editorial scores, ratings, review text and ordering are untouched by any
  campaign.

Nothing anywhere fabricates an impression, a click, a visitor count or a
testimonial. Every number a vendor sees is counted from a recorded event — an
impression means a card was actually on screen, not that a page was served.

---

## 6. Day-to-day

**Reviewing a campaign.** Admin → Promote. Approve, reject or request changes;
the reason you type is sent to the vendor word for word.

**Marking a by-hand placement done.** Same screen, on the campaign. Only mark
it once you have actually sent it — the vendor sees that date.

**A vendor wants to run it again.** They press "Run this again" on a finished
campaign. It copies the wording and placements into a new draft, re-priced at
today's rates, paid for and reviewed as normal.

**Changing prices or rates.** Admin → Promote → Packages and Placements. After
changing a package price, run `node --test tests/custom.test.mjs`.

---

## 7. Tests

```
cd backend
node --test --test-concurrency=1 tests/payments.test.mjs tests/rotation.test.mjs \
  tests/custom.test.mjs tests/geo.test.mjs tests/promotion.test.mjs \
  tests/promoteflow.test.mjs tests/promoteadmin.test.mjs
```

`payments.test.mjs` runs the integration against a stand-in provider, so the
request shapes, the Authorization headers, the kobo-vs-naira handling and the
webhook signature checks are all verified without live keys.

Run `promoteflow.test.mjs` with **no** payment keys in the environment — one of
its cases asserts that checkout refuses cleanly when none are configured, and
it will fail against a server that has them.

`--test-concurrency=1` matters: `rotation.test.mjs` holds the whole discovery
inventory while it runs, which makes `promoteflow`'s availability checks fail
for reasons that have nothing to do with `promoteflow`.

`promoteflow` and `promoteadmin` need a server on port 4102:

```
PORT=4102 node src/server.js
```

---

## 8. Not built, on purpose or not yet

- **Receipts.** A vendor pays and gets no document for their accounting. This
  is the most likely next thing a business buyer asks for.
- **A full placement is a dead end.** When inventory is taken, the sale is
  refused and nothing captures the interest — no waitlist.
- **No make-good.** If a campaign underdelivers because traffic was quiet, the
  system does not offer an extension.
- **No mid-flight cancellation or pro-rata refund** once a campaign is running;
  refunds before it starts are handled by hand from the admin screen.
- **No "featured" badge on a tool's own listing.** Deliberate: a paid mark
  inside the organic directory is paid placement mixed into ranked results,
  which is the line this feature does not cross.
