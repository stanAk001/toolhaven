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
import stacks from "./routes/stacks.js";
import og from "./routes/og.js";
import clicks from "./routes/clicks.js";
import sitemap from "./routes/sitemap.js";
import best from "./routes/best.js";
import pricing from "./routes/pricing.js";
import pricingAdmin from "./routes/pricingadmin.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { warmUp } from "./lib/prisma.js";
import { invalidateOnWrite } from "./lib/cache.js";
import { warmCache } from "./lib/warm.js";
import { startPricingWorker } from "./lib/pricing/scheduler.js";
import { mailProvider } from "./lib/mailer.js";

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json());

const origins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",").map((s) => s.trim());
app.use(cors({ origin: origins, credentials: true }));

// basic rate limit on writes/clicks to keep spam down
app.use("/api", rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));

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
// Pricing reads hang off the tools namespace so a caller already holding a
// tool slug does not need a second identifier.
app.use("/api/tools", pricing);
app.use("/api/admin/pricing", pricingAdmin);
app.use("/api/newsletter", newsletter);
app.use("/api/contact", contact);
app.use("/api/submissions", submissions);
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
  // Connect, then pay the first-request cost here rather than making a reader
  // wait for it. Neither step is allowed to take the server down with it.
  warmUp().then(() => warmCache(PORT)).catch(() => {});
  // Prices refresh themselves in the background; readers are always served
  // from the database. Set PRICING_WORKER=off to stop it.
  startPricingWorker();
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other process or set a different PORT.`);
    process.exit(1);
  }
  throw err;
});
