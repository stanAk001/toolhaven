import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ah } from "../middleware/error.js";

const router = Router();

const TYPES = ["bug", "suggestion", "partnership", "general"];

// POST /api/contact  { name, email, subject, messageType, message }
router.post("/", ah(async (req, res) => {
  const { name, email, subject, messageType, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "name, email and message are required" });
  }
  const saved = await prisma.contactMessage.create({
    data: {
      name, email, subject,
      messageType: TYPES.includes(messageType) ? messageType : "general",
      message,
    },
  });
  // In production you'd also fire an email here (Nodemailer) to the admin.
  res.status(201).json({ ok: true, id: saved.id });
}));

export default router;
