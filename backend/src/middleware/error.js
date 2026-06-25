export function notFound(req, res, next) {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
}

export function errorHandler(err, req, res, next) {
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
