/**
 * Public promotion surfaces: what's for sale, what's running, and what happened.
 *
 * Nothing here needs a session. It is read by the homepage, the category pages
 * and the /promote page, so the queries are lean and the payloads carry no
 * internal ids — a campaign is addressed by its slug everywhere.
 *
 * The webhook endpoints live here too, because they are called by a provider
 * rather than by a person and belong to no dashboard.
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { currencyFor, pricesOf, formatMinor, CURRENCY } from "../lib/promotion/money.js";
import {
  quoteFor, sellableIndividually, MIN_DAYS, MAX_DAYS, DURATION_TIERS,
} from "../lib/promotion/custom.js";
import { resolveCountry, clientIp } from "../lib/promotion/geo.js";
import { availability } from "../lib/promotion/inventory.js";
import { liveFor, recordEvents } from "../lib/promotion/campaigns.js";
import { hashIp } from "../lib/promotion/owner.js";
import { STATUS } from "../lib/promotion/lifecycle.js";
import { PROVIDERS, providerReady, webhookIsGenuine, referenceFromWebhook } from "../lib/promotion/payments.js";
import { settlePayment } from "../lib/promotion/settle.js";

const router = Router();

/**
 * POST /api/promote/quote   { placements: [key], days: n }
 *
 * Prices a campaign the buyer assembled themselves. Public, because the price
 * has to be visible before anyone signs in — and safe to be public, because
 * the request carries no money: it names placements and a number of days, and
 * every figure in the reply is computed here from rates in the database.
 *
 * The same function runs again at checkout. This endpoint is for showing a
 * number, never for agreeing one.
 */
router.post("/quote", ah(async (req, res, next) => {
  const quote = await quoteFor(req.body?.placements, req.body?.days);
  if (!quote.ok) { const e = new Error(quote.reason); e.status = 400; return next(e); }

  const { country } = await resolveCountry(req);
  const currency = country === "NG" ? CURRENCY.NGN : CURRENCY.USD;
  const minor = currency.code === "NGN" ? quote.ngnKobo : quote.usdCents;
  const grossMinor = currency.code === "NGN" ? quote.grossNgnKobo : quote.grossUsdCents;

  res.set("Cache-Control", "no-store");
  res.json({
    days: quote.days,
    discountPct: quote.discountPct,
    currency: currency.code,
    minor,
    display: formatMinor(minor, currency.code),
    // Shown struck through only when a discount actually applies, so nothing
    // pretends to be a saving that isn't one.
    wasDisplay: quote.discountPct > 0 ? formatMinor(grossMinor, currency.code) : null,
    lines: quote.lines.map((l) => ({
      placement: l.placement,
      label: l.label,
      display: formatMinor(currency.code === "NGN" ? l.ngnKobo : l.usdCents, currency.code),
      perDay: formatMinor(currency.code === "NGN" ? l.dailyNgnKobo : l.dailyUsdCents, currency.code),
    })),
  });
}));

/**
 * GET /api/promote/buildable — the placements a buyer may assemble, with rates.
 */
router.get("/buildable", ah(async (req, res) => {
  const { country } = await resolveCountry(req);
  const ngn = country === "NG";
  res.set("Cache-Control", "no-store");
  res.json({
    minDays: MIN_DAYS,
    maxDays: MAX_DAYS,
    tiers: DURATION_TIERS.filter((t) => t.discountPct > 0),
    currency: ngn ? "NGN" : "USD",
    placements: (await sellableIndividually()).map((p) => ({
      key: p.key,
      label: p.label,
      description: p.description,
      perDayMinor: ngn ? p.dailyRateNgnKobo : p.dailyRateUsdCents,
      perDay: formatMinor(ngn ? p.dailyRateNgnKobo : p.dailyRateUsdCents, ngn ? "NGN" : "USD"),
    })),
  });
}));

/**
 * GET /api/promote/geo — what this server decided about the caller, and why.
 *
 * Exists because "I'm in Nigeria and I'm seeing dollars" is otherwise a guess.
 * It reports the country, the mechanism that produced it, and the address it
 * was read from, so a wrong answer can be traced to a cause: `unknown` on a
 * dev machine is the private-address rule working, `language` in production
 * means the IP lookup failed, and `override` means GEO_COUNTRY is set.
 *
 * Nothing secret is returned — the caller's own address and a country code.
 */
router.get("/geo", ah(async (req, res) => {
  const { country, source } = await resolveCountry(req);
  res.set("Cache-Control", "no-store");
  res.json({
    country,
    source,
    ip: clientIp(req),
    currency: country === "NG" ? "NGN" : "USD",
    provider: country === "NG" ? "paystack" : "flutterwave",
  });
}));

/**
 * GET /api/promote/plans
 *
 * What a visitor can buy, priced in their own currency, with real availability
 * beside each placement. The currency follows the buyer's location and is not
 * negotiable from the client, so that the figure on this page is the figure the
 * card is charged.
 */
router.get("/plans", ah(async (req, res) => {
  // Resolved here and nowhere else. The client does not get to ask for a
  // currency: the price it is shown has to be the price it is charged, and a
  // buyer who could pick would sooner or later pick the rail their bank
  // declines.
  const { country, source } = await resolveCountry(req);
  const effective = country;

  // This answer depends on who asked. Caching it anywhere between here and the
  // browser would hand one country's prices — and one country's payment
  // provider — to the next visitor from somewhere else.
  res.set("Cache-Control", "no-store");
  res.set("Vary", "X-Vercel-IP-Country, CF-IPCountry");

  const [plans, placements] = await Promise.all([
    prisma.promotionPlan.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    availability(),
  ]);

  res.json({
    country, countrySource: source,
    providers: {
      paystack: providerReady(PROVIDERS.PAYSTACK),
      flutterwave: providerReady(PROVIDERS.FLUTTERWAVE),
    },
    placements,
    plans: plans.map((p) => {
      const currency = p.quoteOnly ? null : currencyFor(effective, p);
      return {
        slug: p.slug,
        name: p.name,
        description: p.description,
        durationDays: p.durationDays,
        placements: p.placements,
        features: p.features,
        quoteOnly: p.quoteOnly,
        // Both prices are published so a buyer can see either; the one they
        // will actually be charged is `price`.
        prices: pricesOf(p),
        price: currency
          ? { currency: currency.code, minor: p[currency.code === "NGN" ? "priceNgnKobo" : "priceUsdCents"], provider: currency.provider }
          : null,
      };
    }),
  });
}));

/**
 * GET /api/promote/featured?placement=&categorySlug=&limit=
 *
 * The campaigns running on one surface. Returns an empty array rather than an
 * error when nothing is running, because "no campaigns today" is a normal day
 * and the homepage should simply not draw the section.
 */
router.get("/featured", ah(async (req, res) => {
  const placement = String(req.query.placement || "HOMEPAGE_FEATURED");
  const limit = Number(req.query.limit) || 3;

  let categoryId = null;
  if (req.query.categorySlug) {
    const cat = await prisma.category.findUnique({
      where: { slug: String(req.query.categorySlug) },
      select: { id: true },
    });
    if (!cat) return res.json({ items: [] });
    categoryId = cat.id;
  }

  res.json({ items: await liveFor(placement, { categoryId, limit }) });
}));

/**
 * POST /api/promote/events   { events: [{ campaign, type, placement }] }
 *
 * Impressions and clicks, sent in a batch by the client. An impression is
 * recorded when a card is actually on screen rather than when it is served —
 * a card rendered below the fold and never scrolled to was not seen, and
 * counting it would inflate every report on the site.
 *
 * Returns 204 regardless: analytics must never be able to break a page.
 */
router.post("/events", ah(async (req, res) => {
  try {
    await recordEvents(req.body?.events, {
      ipHash: hashIp(req.ip),
      userAgent: req.get("user-agent"),
    });
  } catch { /* a lost impression is not worth an error to the reader */ }
  res.status(204).end();
}));

/**
 * GET /api/promote/go/:slug
 *
 * The outbound hop. Records the click, then redirects to the vendor's own site
 * with UTM tags so they can see the traffic in their own analytics.
 *
 * The redirect happens even when recording fails — a reader's click must never
 * die because our analytics did.
 */
router.get("/go/:slug", ah(async (req, res) => {
  const campaign = await prisma.promotionCampaign.findUnique({
    where: { slug: String(req.params.slug) },
    select: {
      id: true, slug: true, status: true, startDate: true, endDate: true, destinationUrl: true,
      tool: { select: { slug: true, websiteUrl: true } },
    },
  });

  const fallback = `${(process.env.SITE_URL || "https://www.toolhaven.net").replace(/\/+$/, "")}/tools`;
  if (!campaign) return res.redirect(302, fallback);

  const target = campaign.destinationUrl || campaign.tool?.websiteUrl;
  if (!target) return res.redirect(302, campaign.tool?.slug ? `${fallback}/${campaign.tool.slug}` : fallback);

  const now = new Date();
  const live = campaign.status === STATUS.ACTIVE
    && campaign.startDate && campaign.startDate <= now
    && campaign.endDate && campaign.endDate > now;

  // A link shared while the campaign ran still works after it ends — it just
  // stops counting, because those days were not paid for.
  if (live) {
    try {
      await recordEvents(
        [{ campaign: campaign.slug, type: "outbound_click", placement: String(req.query.p || "").slice(0, 40) || null }],
        { ipHash: hashIp(req.ip), userAgent: req.get("user-agent") },
      );
    } catch { /* never block the redirect */ }
  }

  let url;
  try { url = new URL(target); } catch { return res.redirect(302, fallback); }
  url.searchParams.set("utm_source", "toolhaven");
  url.searchParams.set("utm_medium", "promotion");
  url.searchParams.set("utm_campaign", campaign.slug);
  if (req.query.p) url.searchParams.set("utm_content", String(req.query.p).slice(0, 40));

  res.set("Cache-Control", "no-store");
  res.redirect(302, url.toString());
}));

/**
 * POST /api/promote/webhook/:provider
 *
 * The provider telling us a payment settled. Treated as a hint, not as truth:
 * the signature is checked, and then the transaction is verified by calling the
 * provider back. A webhook body is attacker-controlled until both of those pass.
 *
 * Always answers 200 once the signature is good, so a provider does not retry
 * forever over a problem at our end — the work is idempotent, and a retry that
 * arrives anyway is a no-op.
 */
router.post("/webhook/:provider", ah(async (req, res) => {
  const provider = String(req.params.provider).toLowerCase();
  if (provider !== PROVIDERS.PAYSTACK && provider !== PROVIDERS.FLUTTERWAVE) {
    return res.status(404).json({ error: "Unknown provider" });
  }

  // express.json stashes the untouched bytes; the signature is over those, and
  // re-serialising the parsed object would change them.
  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  if (!webhookIsGenuine(provider, req, raw)) {
    return res.status(401).json({ error: "Bad signature" });
  }

  const reference = referenceFromWebhook(provider, req.body);
  if (!reference) return res.status(200).json({ ok: true, ignored: "no reference" });

  await settlePayment({ provider, reference, via: "webhook" });
  res.status(200).json({ ok: true });
}));

export default router;
