import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";

const router = Router();

const validEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

// POST /api/newsletter/subscribe  { email, name, preferredCategories: ["ai","trading"] }
router.post("/subscribe", ah(async (req, res) => {
  const { email, name, preferredCategories } = req.body;
  if (!validEmail(email)) return res.status(400).json({ error: "A valid email is required" });

  const sub = await prisma.newsletterSubscriber.upsert({
    where: { email },
    update: {
      name: name || undefined,
      preferredCategories: Array.isArray(preferredCategories) ? preferredCategories : undefined,
      unsubscribedAt: null,
    },
    create: {
      email, name,
      preferredCategories: Array.isArray(preferredCategories) ? preferredCategories : [],
    },
  });
  res.status(201).json({ ok: true, id: sub.id });
}));

// POST /api/newsletter/unsubscribe  { email }
router.post("/unsubscribe", ah(async (req, res) => {
  const { email } = req.body;
  if (!validEmail(email)) return res.status(400).json({ error: "A valid email is required" });
  await prisma.newsletterSubscriber.updateMany({
    where: { email },
    data: { unsubscribedAt: new Date() },
  });
  res.json({ ok: true });
}));

export default router;
