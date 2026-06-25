import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";

const router = Router();

const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

function card(t, cx) {
  const color = t.category?.colorPrimary || "#1C1714";
  const mono = esc(t.logoMono || (t.name || "?")[0]);
  const name = esc(clip(t.name, 16));
  const rating = Number(t.rating || 0).toFixed(1);
  return `
    <g>
      <rect x="${cx - 72}" y="198" width="144" height="144" rx="22" fill="${color}"/>
      <rect x="${cx - 72}" y="198" width="144" height="144" rx="22" fill="none" stroke="#1C1714" stroke-width="3"/>
      <text x="${cx}" y="296" text-anchor="middle" font-size="76" font-weight="700" fill="#fff">${mono}</text>
      <text x="${cx}" y="412" text-anchor="middle" font-size="40" font-weight="700" fill="#1C1714">${name}</text>
      <text x="${cx}" y="458" text-anchor="middle" font-size="28" fill="#C8841E">★ <tspan fill="#1C1714">${rating}</tspan></text>
    </g>`;
}

function buildSvg(tools) {
  const n = tools.length;
  const span = [300, 900];
  const centers = n <= 1 ? [600] : tools.map((_, i) => span[0] + ((span[1] - span[0]) * i) / (n - 1));
  const vs = [];
  for (let i = 0; i < centers.length - 1; i++) vs.push((centers[i] + centers[i + 1]) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" font-family="Georgia, 'Times New Roman', serif">
  <rect width="1200" height="630" fill="#F1EADD"/>
  <defs><pattern id="d" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#1C1714" opacity="0.12"/></pattern></defs>
  <rect width="1200" height="630" fill="url(#d)"/>
  <rect x="48" y="48" width="1104" height="534" rx="16" fill="none" stroke="#1C1714" stroke-width="4"/>
  <text x="96" y="128" font-family="'Courier New', monospace" font-size="22" letter-spacing="5" fill="#6A5F52">TOOLHAVEN · HEAD TO HEAD</text>
  <text x="1104" y="128" text-anchor="end" font-family="'Courier New', monospace" font-size="22" letter-spacing="3" fill="#E8431F">✦</text>
  <line x1="96" y1="150" x2="1104" y2="150" stroke="#1C1714" stroke-width="2"/>
  ${centers.map((cx, i) => card(tools[i], cx)).join("")}
  ${vs.map((x) => `<text x="${x}" y="288" text-anchor="middle" font-size="46" font-weight="700" font-style="italic" fill="#E8431F">vs</text>`).join("")}
  <line x1="96" y1="508" x2="1104" y2="508" stroke="#1C1714" stroke-width="3"/>
  <text x="600" y="550" text-anchor="middle" font-family="'Courier New', monospace" font-size="19" letter-spacing="3" fill="#6A5F52">PRICE · TRIAL · THE CATCH — SIDE BY SIDE</text>
</svg>`;
}

// GET /api/og/compare?slugs=claude,chatgpt,figma — a branded matchup image
router.get("/compare", ah(async (req, res) => {
  const slugs = String(req.query.slugs || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  let tools = [];
  if (slugs.length) {
    tools = await prisma.tool.findMany({ where: { slug: { in: slugs } }, include: { category: { select: { colorPrimary: true } } } });
    tools.sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));
  }
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(buildSvg(tools));
}));

export default router;
