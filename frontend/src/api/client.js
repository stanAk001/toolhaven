import axios from "axios";
import { clearDataCache } from "../lib/datacache.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
});

// An editor's own save has to be visible to them immediately. The read cache
// under useData holds a page for five minutes before it will even check for
// changes, which is right for a reader and wrong for the person who just
// changed it — so any authenticated write empties it. One interceptor rather
// than a call at each of the twenty-odd admin helpers, because the one that
// gets forgotten is the one that produces "I saved it and nothing happened".
api.interceptors.response.use((res) => {
  const cfg = res.config || {};
  const method = (cfg.method || "get").toLowerCase();
  const authed = !!(cfg.headers && (cfg.headers["x-admin-token"] || cfg.headers.get?.("x-admin-token")));
  if (authed && method !== "get") clearDataCache();
  return res;
});

export default api;

// convenience wrappers used across pages
export const getCategories = () => api.get("/categories").then((r) => r.data);
export const getCategory = (slug) => api.get(`/categories/${slug}`).then((r) => r.data);
export const getTools = (params) => api.get("/tools", { params }).then((r) => r.data);
export const getTool = (slug) => api.get(`/tools/${slug}`).then((r) => r.data);
export const compareTools = (slugs) =>
  api.get("/tools/compare", { params: { slugs: slugs.join(",") } }).then((r) => r.data);
export const getTestimonials = (params) => api.get("/testimonials", { params }).then((r) => r.data);
export const getPosts = (params) => api.get("/blog", { params }).then((r) => r.data);
export const getToolRails = () => api.get("/tools/rails").then((r) => r.data);
// buying guides
export const getGuides = () => api.get("/guides").then((r) => r.data);
export const getGuide = (slug) => api.get(`/guides/${slug}`).then((r) => r.data);

// buying guides — the editor's desk
export const listGuidesAdmin = (token) => api.get("/admin/guides", adminHeaders(token)).then((r) => r.data);
export const getGuideAdmin = (id, token) => api.get(`/admin/guides/${id}`, adminHeaders(token)).then((r) => r.data);
export const createGuide = (body, token) => api.post("/admin/guides", body, adminHeaders(token)).then((r) => r.data);
export const updateGuide = (id, body, token) => api.patch(`/admin/guides/${id}`, body, adminHeaders(token)).then((r) => r.data);
export const deleteGuide = (id, token) => api.delete(`/admin/guides/${id}`, adminHeaders(token)).then((r) => r.data);
export const saveGuidePicks = (id, picks, token) => api.put(`/admin/guides/${id}/picks`, { picks }, adminHeaders(token)).then((r) => r.data);
export const saveGuideFaqs = (id, faqs, token) => api.put(`/admin/guides/${id}/faqs`, { faqs }, adminHeaders(token)).then((r) => r.data);
// Recent images that are not attached to any pick, for putting a photo back
// without uploading it again.
export const recentGuideUploads = (token) => api.get("/admin/guides/uploads/recent", adminHeaders(token)).then((r) => r.data);

export const getBestLists = () => api.get("/best").then((r) => r.data);
export const getBestList = (slug) => api.get(`/best/${slug}`).then((r) => r.data);

// editor-only — best-of lists
const adminHeaders = (token) => ({ headers: { "x-admin-token": token } });
export const listBestAdmin = (token) => api.get("/best/manage", adminHeaders(token)).then((r) => r.data);
export const getBestAdmin = (id, token) => api.get(`/best/manage/${id}`, adminHeaders(token)).then((r) => r.data);
export const createBest = (body, token) => api.post("/best/manage", body, adminHeaders(token)).then((r) => r.data);
export const updateBest = (id, body, token) => api.patch(`/best/manage/${id}`, body, adminHeaders(token)).then((r) => r.data);
export const deleteBest = (id, token) => api.delete(`/best/manage/${id}`, adminHeaders(token)).then((r) => r.data);
export const saveBestEntries = (id, entries, token) =>
  api.put(`/best/manage/${id}/entries`, { entries }, adminHeaders(token)).then((r) => r.data);
export const saveBestFaqs = (id, faqs, token) =>
  api.put(`/best/manage/${id}/faqs`, { faqs }, adminHeaders(token)).then((r) => r.data);

// editor-only — tools and outbound clicks
export const listToolsAdmin = (token) => api.get("/tools/manage", adminHeaders(token)).then((r) => r.data);
// Adding a tool from the desk, partner and tracking link included, so getting
// approved by a programme never needs a deploy.
export const createTool = (body, token) =>
  api.post("/tools/manage", body, adminHeaders(token)).then((r) => r.data);

export const updateToolAdmin = (id, body, token) =>
  api.patch(`/tools/manage/${id}`, body, adminHeaders(token)).then((r) => r.data);
export const saveToolScore = (id, body, token) =>
  api.put(`/tools/manage/${id}/score`, body, adminHeaders(token)).then((r) => r.data);
export const clearToolScore = (id, token) =>
  api.delete(`/tools/manage/${id}/score`, adminHeaders(token)).then((r) => r.data);
export const saveToolFacts = (id, facts, token) =>
  api.put(`/tools/manage/${id}/facts`, { facts }, adminHeaders(token)).then((r) => r.data);
export const saveExternalRatings = (id, ratings, token) =>
  api.put(`/tools/manage/${id}/external`, { ratings }, adminHeaders(token)).then((r) => r.data);
export const saveToolVerdict = (id, verdict, token) =>
  api.put(`/tools/manage/${id}/verdict`, verdict, adminHeaders(token)).then((r) => r.data);
export const saveToolAlternatives = (id, alternatives, token) =>
  api.put(`/tools/manage/${id}/alternatives`, { alternatives }, adminHeaders(token)).then((r) => r.data);
// pricing intelligence — public reads
export const getToolPricing = (slug) => api.get(`/tools/${slug}/pricing`).then((r) => r.data);
export const getPricingHistory = (slug) => api.get(`/tools/${slug}/pricing/history`).then((r) => r.data);

// pricing intelligence — the editor's desk
export const listPricingAdmin = (token) => api.get("/admin/pricing", adminHeaders(token)).then((r) => r.data);
export const verifyPricing = (id, token, force = false) =>
  api.post(`/admin/pricing/${id}/verify`, { force }, adminHeaders(token)).then((r) => r.data);
export const runPricingSweep = (token, limit = 5) =>
  api.post("/admin/pricing/run", { limit }, adminHeaders(token)).then((r) => r.data);
export const getPricingLogs = (id, token) =>
  api.get(`/admin/pricing/${id}/logs`, adminHeaders(token)).then((r) => r.data);
export const approvePricing = (id, token, note) =>
  api.post(`/admin/pricing/${id}/approve`, { note }, adminHeaders(token)).then((r) => r.data);
export const rejectPricing = (id, token, note) =>
  api.post(`/admin/pricing/${id}/reject`, { note }, adminHeaders(token)).then((r) => r.data);
export const overridePricing = (id, body, token) =>
  api.put(`/admin/pricing/${id}/override`, body, adminHeaders(token)).then((r) => r.data);
export const clearPricingOverride = (id, token) =>
  api.delete(`/admin/pricing/${id}/override`, adminHeaders(token)).then((r) => r.data);

export const getClickStats = (token, days = 30) =>
  api.get(`/affiliate-clicks/stats?days=${days}`, adminHeaders(token)).then((r) => r.data);
export const getPost = (slug) => api.get(`/blog/${slug}`).then((r) => r.data);
export const subscribe = (body) => api.post("/newsletter/subscribe", body).then((r) => r.data);
export const sendContact = (body) => api.post("/contact", body).then((r) => r.data);
export const submitTool = (body) => api.post("/submissions", body).then((r) => r.data);

// The raw file is the request body — no multipart, no parsing dependency, and
// the size cap is enforced by the server before a byte reaches the handler.
export const uploadImage = (file) =>
  api.post("/uploads", file, {
    headers: {
      "content-type": file.type || "application/octet-stream",
      "x-filename": file.name || "",
    },
  }).then((r) => r.data);

// The submitter's own view of their submission. The token in the URL is the
// credential — there are no accounts.
export const trackSubmission = (token) =>
  api.get(`/submissions/track/${token}`).then((r) => r.data);
export const updateSubmission_public = (token, body) =>
  api.patch(`/submissions/track/${token}`, body).then((r) => r.data);

// Editor-only review desk
export const getSubmission = (id, token) =>
  api.get(`/submissions/${id}`, adminHeaders(token)).then((r) => r.data);
export const reviewSubmission = (id, body, token) =>
  api.patch(`/submissions/${id}`, body, adminHeaders(token)).then((r) => r.data);

// editor-only — token sent as a header
export const listSubmissions = (token) =>
  api.get("/submissions", { headers: { "x-admin-token": token } }).then((r) => r.data);
export const updateSubmission = (id, status, token) =>
  api.patch(`/submissions/${id}`, { status }, { headers: { "x-admin-token": token } }).then((r) => r.data);
export const deleteSubmission = (id, token) =>
  api.delete(`/submissions/${id}`, { headers: { "x-admin-token": token } }).then((r) => r.data);
export const logClick = (toolId, referrerPage) =>
  api.post("/affiliate-clicks", { toolId, referrerPage }).then((r) => r.data);

// reader reviews
export const createReview = (body) => api.post("/reviews", body).then((r) => r.data);
export const voteHelpful = (id) => api.post(`/reviews/${id}/helpful`).then((r) => r.data);
// editor-only review moderation
export const listPendingReviews = (token) =>
  api.get("/reviews/pending", { headers: { "x-admin-token": token } }).then((r) => r.data);
export const moderateReview = (id, status, token) =>
  api.patch(`/reviews/${id}`, { status }, { headers: { "x-admin-token": token } }).then((r) => r.data);
export const deleteReview = (id, token) =>
  api.delete(`/reviews/${id}`, { headers: { "x-admin-token": token } }).then((r) => r.data);

// community stacks
export const getStacks = (params) => api.get("/stacks", { params }).then((r) => r.data);
export const createStack = (body) => api.post("/stacks", body).then((r) => r.data);
export const listPendingStacks = (token) =>
  api.get("/stacks/pending", { headers: { "x-admin-token": token } }).then((r) => r.data);
export const moderateStack = (id, status, token) =>
  api.patch(`/stacks/${id}`, { status }, { headers: { "x-admin-token": token } }).then((r) => r.data);
export const deleteStack = (id, token) =>
  api.delete(`/stacks/${id}`, { headers: { "x-admin-token": token } }).then((r) => r.data);
