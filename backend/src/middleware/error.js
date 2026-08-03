export function notFound(req, res, next) {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
}

import { isTransient } from "../lib/prisma.js";

export function errorHandler(err, req, res, next) {
  // Connection-level failures that survived the retries in lib/prisma.js. These
  // mean the database is unreachable, not that the request was wrong, so they
  // get 503 (come back in a moment) rather than 500 (we broke), and a sentence
  // instead of a Prisma stack dump. Reuses the same detector as the retry
  // wrapper — matching on err.code alone misses the initialization-error shape.
  if (isTransient(err)) {
    // eslint-disable-next-line no-console
    console.error(`[db] unreachable after retries (${err.code || err.name}) on ${req.method} ${req.originalUrl}`);
    return res.status(503).json({
      error: "The database is temporarily unreachable. Please try again in a moment.",
      code: err.code || "P1001",
    });
  }

  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Something went wrong",
    ...(process.env.NODE_ENV !== "production" && err.stack ? { stack: err.stack } : {}),
  });
}

// tiny async wrapper so route handlers can throw
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
