import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import categories from "./routes/categories.js";
import tools from "./routes/tools.js";
import reviews from "./routes/reviews.js";
import testimonials from "./routes/testimonials.js";
import blog from "./routes/blog.js";
import newsletter from "./routes/newsletter.js";
import contact from "./routes/contact.js";
import submissions from "./routes/submissions.js";
import uploads from "./routes/uploads.js";
import stacks from "./routes/stacks.js";
import og from "./routes/og.js";
import clicks from "./routes/clicks.js";
import sitemap from "./routes/sitemap.js";
import best from "./routes/best.js";
import guides from "./routes/guides.js";
import guidesAdmin from "./routes/guidesadmin.js";
import promote from "./routes/promote.js";
import promoteAdmin from "./routes/promoteadmin.js";
import owner from "./routes/owner.js";
import pricing from "./routes/pricing.js";
import pricingAdmin from "./routes/pricingadmin.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { warmUp } from "./lib/prisma.js";
import { invalidateOnWrite } from "./lib/cache.js";
import { warmCache } from "./lib/warm.js";
import { startPricingWorker } from "./lib/pricing/scheduler.js";
import { startPromotionScheduler } from "./lib/promotion/scheduler.js";
import { providerReady, PROVIDERS } from "./lib/promotion/payments.js";
import { mailProvider } from "./lib/mailer.js";
import { adminTokenStrength, isAdmin } from "./middleware/auth.js";

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({
  // Keep the untouched bytes for the promotion webhooks. Paystack signs the
  // exact body it sent, so a signature can only be checked against what
  // arrived — re-serialising the parsed object changes the bytes and every
  // genuine webhook would be rejected.
  verify: (req, _res, buf) => { if (buf?.length) req.rawBody = buf; },
}));

const origins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",").map((s) => s.trim());
app.use(cors({ origin: origins, credentials: true }));

// basic rate limit on writes/clicks to keep spam down
app.use("/api", rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));

/**
 * A much tighter limit on anything that checks a credential.
 *
 * 120 requests a minute is a sensible ceiling for reading tool pages and a
 * generous one for guessing a token: it allows around 173,000 attempts a day
 * from a single address. Against a short admin token that is not a
 * theoretical risk, and the admin gate controls publishing, deletion, campaign
 * approval and refunds.
 *
 * Only a rejected credential counts — a 401, and nothing else.
 *
 * The first version of this counted every non-2xx, which sounds equivalent and
 * is not: an editor working through a queue is refused all day long for
 * ordinary reasons. Approving a campaign that is still a draft is a 409.
 * Rejecting one without typing a reason is a 400. Opening something already
 * deleted is a 404. None of those are guesses, and counting them locked the
 * editor out of their own desk after ten normal mistakes — which the admin
 * test suite demonstrated immediately.
 *
 * Someone guessing a token produces 401s and nothing else, so that is the only
 * thing worth counting.
 */
const guessLimit = (max) => rateLimit({
  windowMs: 10 * 60_000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 401,
  message: { error: "Too many attempts. Wait a few minutes and try again." },
});

/**
 * Sign-in is different: it answers 200 to everyone by design, so that a
 * stranger cannot learn which addresses have an account. There is no failure
 * to count, and the thing worth limiting is the volume itself — someone
 * working through a list of addresses, or using the form to send mail.
 */
const floodLimit = (max) => rateLimit({
  windowMs: 10 * 60_000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Wait a few minutes and try again." },
});

app.use("/api/admin", guessLimit(10));
app.use("/api/owner/session", guessLimit(20));
app.use("/api/owner/login", floodLimit(10));

/**
 * Uploading is open to the public, and has to be: someone submitting a tool
 * attaches a logo before there is any account to attach it to.
 *
 * The cost of that is real. Every upload is up to 5 MB written straight into
 * Postgres, and under the general 120-a-minute ceiling one address could push
 * roughly 36 GB an hour into the database — an outage and a bill rather than a
 * break-in, but the site is just as down either way. Deduplication by hash does
 * not help: one changed byte is a new row.
 *
 * A person submitting a tool uploads one logo. Ten in ten minutes is generous
 * for that and useless for filling a disk. An editor laying out a buying guide
 * legitimately uploads many photos in a row, so a valid admin token lifts the
 * limit — and only the upload itself is limited, never the GET that serves
 * images to every page on the site.
 */
const uploadLimit = floodLimit(10);
app.use("/api/uploads", (req, res, next) => {
  if (req.method !== "POST" || isAdmin(req)) return next();
  return uploadLimit(req, res, next);
});

// Any write anywhere under /api drops the whole read cache, so an editor's
// save is visible on the next request rather than whenever a timer expires.
app.use("/api", invalidateOnWrite);

app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api/categories", categories);
app.use("/api/tools", tools);
app.use("/api/reviews", reviews);
app.use("/api/testimonials", testimonials);
app.use("/api/blog", blog);
app.use("/api/best", best);
app.use("/api/guides", guides);
app.use("/api/admin/guides", guidesAdmin);
// Toolhaven Promote. Public surfaces and provider webhooks; the vendor's own
// endpoints sit behind an owner session of their own.
app.use("/api/promote", promote);
app.use("/api/owner", owner);
app.use("/api/admin/promotions", promoteAdmin);
// Pricing reads hang off the tools namespace so a caller already holding a
// tool slug does not need a second identifier.
app.use("/api/tools", pricing);
app.use("/api/admin/pricing", pricingAdmin);
app.use("/api/newsletter", newsletter);
app.use("/api/contact", contact);
app.use("/api/submissions", submissions);
app.use("/api/uploads", uploads);
app.use("/api/stacks", stacks);
app.use("/api/og", og);
app.use("/api/affiliate-clicks", clicks);

// Served at the site root, not under /api — crawlers only look for
// /sitemap.xml. The frontend host proxies this path through to the API so it
// answers on the public domain (see frontend/vercel.json).
app.use("/sitemap.xml", sitemap);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Toolhaven API running on http://localhost:${PORT}`);

  // Say out loud which transport is live and where alerts go. A silent mail
  // misconfiguration is invisible for weeks — submission alerts were being
  // sent to the same Gmail account they were sent from, which Gmail quietly
  // keeps out of the inbox, and nothing anywhere said so.
  const provider = mailProvider();
  const alertsTo = process.env.NOTIFY_EMAIL || process.env.SMTP_USER || "(nowhere)";
  if (!provider) console.warn("[mail] no provider configured — submission alerts will not be sent");
  else {
    console.log(`[mail] ${provider} → alerts to ${alertsTo}`);
    const from = (process.env.MAIL_FROM || "").match(/<([^>]+)>/)?.[1] || process.env.MAIL_FROM || process.env.SMTP_USER || "";
    if (from && alertsTo && from.toLowerCase() === alertsTo.toLowerCase()) {
      console.warn("[mail] NOTIFY_EMAIL is the same address alerts are sent FROM. Gmail hides self-addressed mail from the inbox — point NOTIFY_EMAIL somewhere else.");
    }
  }
  // The credential that guards publishing, deletion, campaign approval and
  // refunds. Said plainly at boot, because a weak one here undoes everything
  // else and nothing in the running site would ever mention it.
  {
    const strength = adminTokenStrength();
    if (!strength.ok) {
      console.warn(`[security] ADMIN_TOKEN is weak — ${strength.reason}.`);
      console.warn("[security] it guards publishing, deletion, refunds and campaign approval.");
      console.warn("[security] replace it with: node -e \"console.log(require('crypto').randomBytes(24).toString('base64url'))\"");
    }
  }

  // Same reasoning for the payment rails. Without keys, Promote still shows
  // prices and still builds campaigns — it just cannot take money, and the
  // vendor discovers that at the checkout button. Better to say it here.
  {
    const paystack = providerReady(PROVIDERS.PAYSTACK);
    const flutterwave = providerReady(PROVIDERS.FLUTTERWAVE);
    const geo = process.env.GEO_COUNTRY ? ` (GEO_COUNTRY=${process.env.GEO_COUNTRY} — remove before deploying)` : "";
    if (!paystack && !flutterwave) {
      console.warn("[promote] no payment provider configured — campaigns can be built but not paid for.");
      console.warn("[promote] set PAYSTACK_SECRET_KEY (naira) and FLUTTERWAVE_SECRET_KEY (dollars) in backend/.env");
    } else {
      console.log(`[promote] naira → ${paystack ? "paystack ready" : "PAYSTACK_SECRET_KEY missing"}`);
      console.log(`[promote] dollars → ${flutterwave ? "flutterwave ready" : "FLUTTERWAVE_SECRET_KEY missing"}`);
      if (paystack && !process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_")) {
        console.warn("[promote] PAYSTACK_SECRET_KEY does not look like a secret key (expected sk_…)");
      }
      if (flutterwave && !process.env.FLUTTERWAVE_WEBHOOK_HASH) {
        console.warn("[promote] FLUTTERWAVE_WEBHOOK_HASH is not set — Flutterwave webhooks will be rejected as unsigned");
      }
    }
    if (geo) console.warn(`[promote] geo detection is overridden${geo}`);
  }

  // Connect, then pay the first-request cost here rather than making a reader
  // wait for it. Neither step is allowed to take the server down with it.
  warmUp().then(() => warmCache(PORT)).catch(() => {});
  // Prices refresh themselves in the background; readers are always served
  // from the database. Set PRICING_WORKER=off to stop it.
  startPricingWorker();
  // Campaigns start, finish and report themselves. Off unless PROMOTE_WORKER=1,
  // so only one process does it — two workers means two "your campaign is
  // live" emails for the same campaign.
  startPromotionScheduler();
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other process or set a different PORT.`);
    process.exit(1);
  }
  throw err;
});
