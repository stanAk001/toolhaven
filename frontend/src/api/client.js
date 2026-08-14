import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
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
export const updateToolAdmin = (id, body, token) =>
  api.patch(`/tools/manage/${id}`, body, adminHeaders(token)).then((r) => r.data);
export const getClickStats = (token, days = 30) =>
  api.get(`/affiliate-clicks/stats?days=${days}`, adminHeaders(token)).then((r) => r.data);
export const getPost = (slug) => api.get(`/blog/${slug}`).then((r) => r.data);
export const subscribe = (body) => api.post("/newsletter/subscribe", body).then((r) => r.data);
export const sendContact = (body) => api.post("/contact", body).then((r) => r.data);
export const submitTool = (body) => api.post("/submissions", body).then((r) => r.data);

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
