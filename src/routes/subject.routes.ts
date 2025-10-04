import { Router } from "express";
import prisma from "../prisma/client";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

/**
 * 🟢 Subject yaratish (faqat ADMIN)
 */
router.post("/", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { name, gradeId } = req.body;

    if (!name || !gradeId) {
      return res.status(400).json({ message: "❌ name va gradeId kiritilishi shart" });
    }

    const subject = await prisma.subject.create({
      data: {
        name,
        gradeId,
      },
      include: { grade: true },
    });

    res.json({ message: "✅ Subject yaratildi", subject });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

/**
 * 🟢 Barcha subjectlarni olish
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: { grade: true },
    });
    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

/**
 * 🟢 Bitta grade uchun subjectlarni olish
 */
router.get("/grade/:gradeId", authenticate, async (req, res) => {
  try {
    const gradeId = Number(req.params.gradeId);
    const subjects = await prisma.subject.findMany({
      where: { gradeId },
    });
    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

export default router;
