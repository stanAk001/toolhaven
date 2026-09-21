/**
 * The tool owner's side: sign in, see your tools, run a campaign.
 *
 * Every write here re-reads ownership from the database. The session says which
 * email address is signed in and nothing else — it carries no tool ids, so a
 * request cannot assert what it owns. Prices are read from the plan row at the
 * moment of checkout; a price that arrives in a request body is ignored
 * entirely, because it is a suggestion from a browser.
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";
import { sendMail } from "../lib/mailer.js";
import { shell, p as para, button, facts, esc } from "../lib/emailtemplate.js";
import {
  issueLoginToken, redeemLoginToken, requireOwner,
  ownedTools, assertOwnership, normaliseEmail,
} from "../lib/promotion/owner.js";
import { STATUS, canMove, refusal, toolIsPromotable, NOT_PROMOTABLE, OPEN_STATUSES } from "../lib/promotion/lifecycle.js";
import { currencyFor, amountFor, formatMinor } from "../lib/promotion/money.js";
import { resolveCountry } from "../lib/promotion/geo.js";
import { quoteFor, customPlan, CUSTOM_PLAN_SLUG } from "../lib/promotion/custom.js";
import { canTake } from "../lib/promotion/inventory.js";
import {
  plain, LIMITS, checkDestination, newSlug, windowFor,
  analyticsFor, analyticsForMany, audit, manualDelivery,
} from "../lib/promotion/campaigns.js";
import { PROVIDERS, providerReady, newReference, initialise, PAYMENT_STATUS } from "../lib/promotion/payments.js";
import { settlePayment } from "../lib/promotion/settle.js";
import { sendSubmitted } from "../lib/promotion/campaignmail.js";

const router = Router();
const SITE = () => (process.env.SITE_URL || "https://www.toolhaven.net").replace(/\/+$/, "");

/* ──────────────────────────── signing in ───────────────────────────── */

/**
 * POST /api/owner/login  { email }
 *
 * Answers identically whether or not the address is known. Anything else turns
 * this into a way to ask "has this company submitted to Toolhaven?", which is
 * not a question a stranger gets to have answered.
 */
router.post("/login", ah(async (req, res) => {
  const email = normaliseEmail(req.body?.email);
  const reply = {
    ok: true,
    message: "If that address has a published tool on Toolhaven, a sign-in link is on its way.",
  };
  if (!email || !email.includes("@")) return res.json(reply);

  const issued = await issueLoginToken(email);
  if (!issued) return res.json(reply);

  const link = `${SITE()}/promote/signin?token=${encodeURIComponent(issued.token)}`;
  try {
    await sendMail({
      to: email,
      subject: "Your Toolhaven sign-in link",
      text: `Sign in to manage your Toolhaven promotions: ${link}\n\nThis link works once and expires in ${issued.expiresMinutes} minutes.`,
      html: shell({
        preheader: "Your sign-in link — it works once.",
        kicker: "Toolhaven Promote",
        heading: "Sign in to Toolhaven",
        body:
          para("Here's your sign-in link. It works once, and expires in " + issued.expiresMinutes + " minutes.")
          + button(link, "Sign in")
          + para("If you didn't ask for this, you can ignore it — nothing has changed on your account.", true),
      }),
    });
  } catch { /* the reply is identical either way; a send failure is logged by the mailer */ }

  res.json(reply);
}));

/** POST /api/owner/session  { token } — exchange a link for a session. */
router.post("/session", ah(async (req, res, next) => {
  const session = await redeemLoginToken(req.body?.token);
  if (!session) {
    const e = new Error("That sign-in link has expired or has already been used. Please request a new one.");
    e.status = 401; return next(e);
  }
  res.json({ token: session.token, email: session.email, expiresAt: session.expiresAt });
}));

router.use(requireOwner);

/* ─────────────────────────── what you own ──────────────────────────── */

/** GET /api/owner/me — the address, its tools, and anything in flight. */
router.get("/me", ah(async (req, res) => {
  const tools = await ownedTools(req.owner.email);
  const open = await prisma.promotionCampaign.count({
    where: { ownerEmail: req.owner.email, status: { in: OPEN_STATUSES } },
  });
  res.json({
    email: req.owner.email,
    tools: tools.map((s) => ({
      submissionId: s.id,
      promotable: toolIsPromotable(s),
      tool: {
        slug: s.tool.slug, name: s.tool.name,
        logoUrl: s.tool.logoUrl, logoMono: s.tool.logoMono,
        websiteUrl: s.tool.websiteUrl, category: s.tool.category,
      },
    })),
    openCampaigns: open,
    notPromotableMessage: NOT_PROMOTABLE,
  });
}));

/* ───────────────────────────── campaigns ───────────────────────────── */

const campaignShape = {
  id: true, slug: true, status: true, headline: true, message: true, ctaText: true,
  targetAudience: true, destinationUrl: true, placements: true, imageId: true,
  customDays: true, customUsdCents: true, customNgnKobo: true,
  startDate: true, endDate: true, reviewNote: true, createdAt: true,
  tool: { select: { slug: true, name: true, logoUrl: true, logoMono: true, websiteUrl: true, category: { select: { slug: true, name: true } } } },
  plan: { select: { slug: true, name: true, durationDays: true } },
  payments: {
    select: { status: true, amountMinor: true, currency: true, provider: true, paidAt: true },
    orderBy: { createdAt: "desc" }, take: 1,
  },
};

const asVendor = (c, stats, manual = []) => ({
  slug: c.slug,
  status: c.status,
  headline: c.headline,
  message: c.message,
  ctaText: c.ctaText,
  targetAudience: c.targetAudience,
  destinationUrl: c.destinationUrl,
  placements: c.placements,
  image: c.imageId ? `/api/uploads/${c.imageId}` : null,
  startDate: c.startDate,
  endDate: c.endDate,
  reviewNote: c.reviewNote,
  createdAt: c.createdAt,
  tool: c.tool,
  // A custom campaign's real length is its own, not the placeholder plan's.
  plan: c.customDays ? { ...c.plan, name: "Custom campaign", durationDays: c.customDays } : c.plan,
  custom: Number.isInteger(c.customDays) ? { days: c.customDays } : null,
  payment: c.payments?.[0]
    ? {
      status: c.payments[0].status,
      provider: c.payments[0].provider,
      paidAt: c.payments[0].paidAt,
      display: formatMinor(c.payments[0].amountMinor, c.payments[0].currency),
    }
    : null,
  stats,
  // The placements an editor does by hand, and whether they have been done.
  // Sent even when empty so the dashboard can tell "none bought" from "not
  // delivered yet" rather than guessing.
  manual,
});

/** GET /api/owner/campaigns — everything this address has ever bought. */
router.get("/campaigns", ah(async (req, res) => {
  const rows = await prisma.promotionCampaign.findMany({
    where: { ownerEmail: req.owner.email },
    select: campaignShape,
    orderBy: { createdAt: "desc" },
  });
  // One grouped query for every campaign's numbers, rather than one each.
  const stats = await analyticsForMany(rows.map((r) => r.id));
  const manual = await manualDelivery(rows);
  res.json({ items: rows.map((c) => asVendor(c, stats.get(c.id), manual.get(c.id) || [])) });
}));

/** GET /api/owner/campaigns/:slug — one campaign, with its full report. */
router.get("/campaigns/:slug", ah(async (req, res, next) => {
  const c = await prisma.promotionCampaign.findFirst({
    where: { slug: String(req.params.slug), ownerEmail: req.owner.email },
    select: campaignShape,
  });
  if (!c) { const e = new Error("We couldn't find that campaign on your account."); e.status = 404; return next(e); }
  const manual = await manualDelivery([c]);
  res.json({ campaign: asVendor(c, await analyticsFor(c.id), manual.get(c.id) || []) });
}));

/**
 * POST /api/owner/campaigns
 *
 * Creates a draft. Nothing is charged here and nothing is scheduled: this is
 * the campaign taking shape, and every claim in the request is checked against
 * the database before it is stored.
 */
router.post("/campaigns", ah(async (req, res, next) => {
  const b = req.body || {};

  // 1. Is this tool yours, and is it live?
  const submission = await assertOwnership(req.owner.email, b.submissionId);
  if (!toolIsPromotable(submission)) { const e = new Error(NOT_PROMOTABLE); e.status = 409; return next(e); }

  const tool = await prisma.tool.findUnique({
    where: { id: submission.publishedToolId },
    select: { id: true, name: true, websiteUrl: true, categoryId: true },
  });
  if (!tool) { const e = new Error(NOT_PROMOTABLE); e.status = 409; return next(e); }

  // 2. A package, or a campaign they assembled themselves?
  //
  // The custom path is priced here, from the rates in the database, using the
  // same function that produced the quote they were shown. The request carries
  // placements and a number of days and never a figure — a price the browser
  // could name is a price the browser could set to nothing.
  const isCustom = b.custom === true || String(b.planSlug || "") === CUSTOM_PLAN_SLUG;
  let plan;
  let quote = null;
  let wanted;

  if (isCustom) {
    quote = await quoteFor(b.placements, b.days);
    if (!quote.ok) { const e = new Error(quote.reason); e.status = 400; return next(e); }
    plan = await customPlan();
    wanted = quote.lines.map((l) => l.placement);
  } else {
    plan = await prisma.promotionPlan.findFirst({ where: { slug: String(b.planSlug || ""), active: true } });
    if (!plan) { const e = new Error("That promotion package isn't available."); e.status = 400; return next(e); }

    // 3. Are these placements part of the plan, and free right now?
    wanted = Array.isArray(b.placements) ? b.placements.filter((k) => plan.placements.includes(k)) : [];
    if (!wanted.length) { const e = new Error("Choose at least one placement included in that package."); e.status = 400; return next(e); }
  }

  const free = await canTake(wanted, { categoryId: tool.categoryId });
  if (!free.ok) { const e = new Error(free.reason); e.status = 409; e.full = free.full; return next(e); }

  // 4. Where may the click go?
  const dest = checkDestination(b.destinationUrl, tool.websiteUrl);
  if (!dest.ok) { const e = new Error(dest.reason); e.status = 400; return next(e); }

  // A custom campaign's length is the one the buyer chose and paid against,
  // not the plan row's (which is zero — the row exists only to satisfy the
  // relation).
  const { start, end } = windowFor(
    isCustom ? { ...plan, durationDays: quote.days } : plan,
    b.startDate,
  );

  const campaign = await prisma.promotionCampaign.create({
    data: {
      slug: newSlug(tool.name),
      toolId: tool.id,
      submissionId: submission.id,
      ownerEmail: req.owner.email,
      planId: plan.id,
      status: STATUS.DRAFT,
      headline: plain(b.headline, LIMITS.headline),
      message: plain(b.message, LIMITS.message),
      ctaText: plain(b.ctaText, LIMITS.ctaText),
      targetAudience: plain(b.targetAudience, LIMITS.targetAudience),
      destinationUrl: dest.url,
      placements: wanted,
      customDays: isCustom ? quote.days : null,
      customUsdCents: isCustom ? quote.usdCents : null,
      customNgnKobo: isCustom ? quote.ngnKobo : null,
      startDate: start,
      endDate: end,
      // An image is only accepted if it is genuinely an upload we hold.
      imageId: Number.isInteger(Number(b.imageId))
        && await prisma.upload.count({ where: { id: Number(b.imageId) } })
        ? Number(b.imageId) : null,
    },
    select: campaignShape,
  });

  await audit("campaign.created", { campaignId: campaign.id, actor: "vendor", detail: req.owner.email });
  res.status(201).json({ campaign: asVendor(campaign, null) });
}));

/**
 * PATCH /api/owner/campaigns/:slug
 *
 * Editable while it is a draft, or after an editor has asked for a change.
 * Once it is approved or running the copy is fixed — a live placement whose
 * text can be swapped is a placement nobody reviewed.
 */
router.patch("/campaigns/:slug", ah(async (req, res, next) => {
  const c = await prisma.promotionCampaign.findFirst({
    where: { slug: String(req.params.slug), ownerEmail: req.owner.email },
    include: { tool: { select: { websiteUrl: true, categoryId: true } }, plan: true },
  });
  if (!c) { const e = new Error("We couldn't find that campaign on your account."); e.status = 404; return next(e); }
  if (c.status !== STATUS.DRAFT) {
    const e = new Error("This campaign can't be edited now. Ask us to make a change and we'll open it back up.");
    e.status = 409; return next(e);
  }

  const b = req.body || {};
  const data = {};
  for (const [key, limit] of [["headline", LIMITS.headline], ["message", LIMITS.message],
    ["ctaText", LIMITS.ctaText], ["targetAudience", LIMITS.targetAudience]]) {
    if (b[key] !== undefined) data[key] = plain(b[key], limit);
  }

  if (b.destinationUrl !== undefined) {
    const dest = checkDestination(b.destinationUrl, c.tool?.websiteUrl);
    if (!dest.ok) { const e = new Error(dest.reason); e.status = 400; return next(e); }
    data.destinationUrl = dest.url;
  }

  if (Array.isArray(b.placements)) {
    const wanted = b.placements.filter((k) => c.plan.placements.includes(k));
    if (!wanted.length) { const e = new Error("Choose at least one placement included in that package."); e.status = 400; return next(e); }
    const free = await canTake(wanted, { categoryId: c.tool?.categoryId, ignoreCampaignId: c.id });
    if (!free.ok) { const e = new Error(free.reason); e.status = 409; return next(e); }
    data.placements = wanted;
  }

  if (b.startDate !== undefined) {
    const { start, end } = windowFor(c.plan, b.startDate);
    data.startDate = start; data.endDate = end;
  }

  const updated = await prisma.promotionCampaign.update({ where: { id: c.id }, data, select: campaignShape });
  await audit("campaign.edited", { campaignId: c.id, actor: "vendor", detail: Object.keys(data).join(", ") });
  res.json({ campaign: asVendor(updated, null) });
}));

/**
 * POST /api/owner/campaigns/:slug/checkout
 *
 * Opens a payment. The amount is read from the plan row here, on the server —
 * the request body has no say in what anything costs.
 */
router.post("/campaigns/:slug/checkout", ah(async (req, res, next) => {
  const c = await prisma.promotionCampaign.findFirst({
    where: { slug: String(req.params.slug), ownerEmail: req.owner.email },
    include: { plan: true, tool: { select: { name: true, categoryId: true } } },
  });
  if (!c) { const e = new Error("We couldn't find that campaign on your account."); e.status = 404; return next(e); }

  if (!canMove(c.status, STATUS.PENDING_PAYMENT)) {
    const e = new Error(refusal(c.status, STATUS.PENDING_PAYMENT)); e.status = 409; return next(e);
  }
  if (c.plan.quoteOnly) {
    const e = new Error("This package is priced per campaign. Reply to your confirmation email and we'll quote it.");
    e.status = 409; return next(e);
  }

  // The slot must still be free at the moment money changes hands, not merely
  // when the form was drawn.
  const free = await canTake(c.placements, { categoryId: c.tool?.categoryId, ignoreCampaignId: c.id });
  if (!free.ok) { const e = new Error(free.reason); e.status = 409; return next(e); }

  // The same resolver the price was quoted with, so the charge cannot end up in
  // a different currency — or on a different provider — than the one the buyer
  // was shown. Nothing about the currency is read from the request body.
  const { country } = await resolveCountry(req);

  // A custom campaign carries its own price, frozen at the moment it was
  // built. It is charged against that figure rather than the plan row's, and
  // rate changes since then do not reach a campaign already quoted.
  const priced = Number.isInteger(c.customUsdCents) || Number.isInteger(c.customNgnKobo)
    ? { priceUsdCents: c.customUsdCents, priceNgnKobo: c.customNgnKobo }
    : c.plan;

  const currency = currencyFor(country, priced);
  const amountMinor = amountFor(priced, currency);
  if (!currency || !Number.isInteger(amountMinor) || amountMinor <= 0) {
    const e = new Error("That package isn't priced in a currency we can charge you in yet."); e.status = 409; return next(e);
  }
  if (!providerReady(currency.provider)) {
    const e = new Error("Card payments aren't switched on yet. Please contact us and we'll arrange this campaign.");
    e.status = 503; return next(e);
  }

  const reference = newReference();
  await prisma.promotionPayment.create({
    data: {
      campaignId: c.id, provider: currency.provider, reference,
      amountMinor, currency: currency.code, status: PAYMENT_STATUS.PENDING,
    },
  });

  const { url } = await initialise({
    provider: currency.provider,
    email: req.owner.email,
    amountMinor, currency: currency.code, reference,
    callbackUrl: `${SITE()}/promote/dashboard?campaign=${encodeURIComponent(c.slug)}&reference=${encodeURIComponent(reference)}`,
    meta: { campaign: c.slug, tool: c.tool?.name || "", plan: c.plan.slug },
  });

  if (canMove(c.status, STATUS.PENDING_PAYMENT)) {
    await prisma.promotionCampaign.update({ where: { id: c.id }, data: { status: STATUS.PENDING_PAYMENT } });
  }
  await audit("campaign.checkout", {
    campaignId: c.id, actor: "vendor",
    detail: `${currency.provider} ${currency.code} ${amountMinor}`,
  });

  res.json({ url, reference, amount: formatMinor(amountMinor, currency.code), currency: currency.code, provider: currency.provider });
}));

/**
 * POST /api/owner/campaigns/:slug/settle  { reference }
 *
 * Called when the buyer lands back from checkout. It does not believe them: it
 * calls the provider. The webhook usually gets here first, in which case this
 * is a no-op and simply reports the campaign's real state.
 */
router.post("/campaigns/:slug/settle", ah(async (req, res, next) => {
  const c = await prisma.promotionCampaign.findFirst({
    where: { slug: String(req.params.slug), ownerEmail: req.owner.email },
    select: { id: true, slug: true },
  });
  if (!c) { const e = new Error("We couldn't find that campaign on your account."); e.status = 404; return next(e); }

  const payment = await prisma.promotionPayment.findFirst({
    where: { campaignId: c.id, reference: String(req.body?.reference || "") },
    select: { provider: true, reference: true },
  });
  if (!payment) { const e = new Error("We couldn't find that payment."); e.status = 404; return next(e); }

  const result = await settlePayment({ provider: payment.provider, reference: payment.reference, via: "return" });

  const fresh = await prisma.promotionCampaign.findUnique({ where: { id: c.id }, select: campaignShape });
  if (result.settled) await sendSubmitted(await prisma.promotionCampaign.findUnique({
    where: { id: c.id },
    include: { tool: { select: { name: true } }, plan: { select: { name: true } } },
  }));

  res.json({ settled: Boolean(result.ok), reason: result.reason || null, campaign: asVendor(fresh, null) });
}));

/** POST /api/owner/campaigns/:slug/cancel — while nothing has been paid. */
router.post("/campaigns/:slug/cancel", ah(async (req, res, next) => {
  const c = await prisma.promotionCampaign.findFirst({
    where: { slug: String(req.params.slug), ownerEmail: req.owner.email },
    select: { id: true, status: true },
  });
  if (!c) { const e = new Error("We couldn't find that campaign on your account."); e.status = 404; return next(e); }
  if (!canMove(c.status, STATUS.CANCELLED)) {
    const e = new Error(refusal(c.status, STATUS.CANCELLED)); e.status = 409; return next(e);
  }
  await prisma.promotionCampaign.update({ where: { id: c.id }, data: { status: STATUS.CANCELLED } });
  await audit("campaign.cancelled", { campaignId: c.id, actor: "vendor" });
  res.json({ ok: true });
}));

/**
 * POST /api/owner/campaigns/:slug/renew — run a finished campaign again.
 *
 * The scheduler already emails a vendor three days before their campaign ends
 * so they can decide whether to run it again. Until now there was no way to
 * act on that: the only route back was the six-step form, re-typing copy that
 * had already been written, reviewed and paid for. That is the cheapest sale
 * in the product and it was being thrown away at the last step.
 *
 * A renewal is a new campaign, not a resurrection of the old one. It copies
 * the copy and the placements into a fresh draft and nothing else: it is paid
 * for separately, reviewed again, and takes new dates. Reusing the original
 * row would leave one campaign with two payments and one report covering two
 * different runs.
 *
 * A custom campaign is re-quoted at today's rates rather than the price it was
 * frozen at. That freeze exists so a quote cannot move under someone who has
 * already been shown it — it is not a promise that last month's price is still
 * available, and silently honouring it would be a different kind of dishonesty.
 */
router.post("/campaigns/:slug/renew", ah(async (req, res, next) => {
  const old = await prisma.promotionCampaign.findFirst({
    where: { slug: String(req.params.slug), ownerEmail: req.owner.email },
    include: { plan: true, tool: { select: { id: true, name: true, categoryId: true } } },
  });
  if (!old) { const e = new Error("We couldn't find that campaign on your account."); e.status = 404; return next(e); }

  // Only a run that is over, or nearly. Renewing something still in review
  // would put two of the same advert in the queue.
  const renewable = [STATUS.COMPLETED, STATUS.EXPIRED, STATUS.ACTIVE, STATUS.PAUSED];
  if (!renewable.includes(old.status)) {
    const e = new Error("That campaign isn't finished yet — there's nothing to run again.");
    e.status = 409; return next(e);
  }

  // The listing has to still be live. A tool unpublished since the last run
  // cannot be promoted, however good the previous campaign was.
  const submission = await assertOwnership(req.owner.email, old.submissionId);
  if (!toolIsPromotable(submission)) { const e = new Error(NOT_PROMOTABLE); e.status = 409; return next(e); }

  const isCustom = Number.isInteger(old.customDays);
  let quote = null;
  if (isCustom) {
    quote = await quoteFor(old.placements, old.customDays);
    if (!quote.ok) { const e = new Error(quote.reason); e.status = 409; return next(e); }
  } else if (!old.plan?.active) {
    const e = new Error("That package isn't on sale any more. Pick a current one and we'll carry your copy across.");
    e.status = 409; return next(e);
  }

  // Someone else may hold the slot now. Checked here so the refusal arrives
  // before the vendor has been asked for money, not after.
  const free = await canTake(old.placements, { categoryId: old.tool?.categoryId });
  if (!free.ok) { const e = new Error(free.reason); e.status = 409; e.full = free.full; return next(e); }

  const { start, end } = windowFor(
    isCustom ? { ...old.plan, durationDays: quote.days } : old.plan,
    req.body?.startDate,
  );

  const fresh = await prisma.promotionCampaign.create({
    data: {
      slug: newSlug(old.tool?.name || "campaign"),
      toolId: old.toolId,
      submissionId: old.submissionId,
      ownerEmail: old.ownerEmail,
      planId: old.planId,
      status: STATUS.DRAFT,
      headline: old.headline,
      message: old.message,
      ctaText: old.ctaText,
      targetAudience: old.targetAudience,
      destinationUrl: old.destinationUrl,
      imageId: old.imageId,
      placements: old.placements,
      customDays: isCustom ? quote.days : null,
      customUsdCents: isCustom ? quote.usdCents : null,
      customNgnKobo: isCustom ? quote.ngnKobo : null,
      startDate: start,
      endDate: end,
    },
    select: campaignShape,
  });

  await audit("campaign.renewed", { campaignId: fresh.id, actor: "vendor", detail: old.slug });
  res.status(201).json({ campaign: asVendor(fresh, null, []), renewedFrom: old.slug });
}));

export default router;
