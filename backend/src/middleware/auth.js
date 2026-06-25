// Shared editor gate — protects admin-only endpoints with a token sent as a
// header (compared against ADMIN_TOKEN). Used by submissions and reviews.
export function requireAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: "Admin access isn't configured." });
  if (req.get("x-admin-token") !== token) return res.status(401).json({ error: "Unauthorized" });
  next();
}
