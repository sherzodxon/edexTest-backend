import { Router } from "express";
import prisma from "../prisma/client";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

/**
 * 🟢 Admin → yangi grade yaratadi
 */
router.post("/", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "❌ Grade nomi kerak" });
    }

    const existing = await prisma.grade.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ message: "❌ Bu grade allaqachon mavjud" });
    }

    const grade = await prisma.grade.create({
      data: { name },
    });

    res.json({ message: "✅ Grade yaratildi", grade });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Grade yaratishda xatolik" });
  }
});

/**
 * 🟢 Admin → barcha gradelarni ko‘rish
 */
router.get("/", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const grades = await prisma.grade.findMany({
      include: {
        students: true,
        teachers: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(grades);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gradelarni olishda xatolik" });
  }
});

/**
 * 🟢 Admin → grade yangilash
 */
router.put("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const grade = await prisma.grade.update({
      where: { id: Number(id) },
      data: { name },
    });

    res.json({ message: "✅ Grade yangilandi", grade });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Grade yangilashda xatolik" });
  }
});

/**
 * 🟢 Admin → grade o‘chirish
 */
router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.grade.delete({ where: { id: Number(id) } });

    res.json({ message: "🗑️ Grade o‘chirildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Grade o‘chirishda xatolik" });
  }
});

/**
 * 🟢 Admin → gradega teacher biriktirish
 */
router.post("/:id/add-teacher", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;

    const teacher = await prisma.user.findUnique({ where: { id: Number(teacherId) } });
    if (!teacher || teacher.role !== "TEACHER") {
      return res.status(400).json({ message: "❌ Bunday teacher mavjud emas" });
    }

    const grade = await prisma.grade.update({
      where: { id: Number(id) },
      data: {
        teachers: {
          connect: { id: Number(teacherId) },
        },
      },
      include: { teachers: true },
    });

    res.json({ message: "✅ Teacher gradega biriktirildi", grade });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Teacher qo‘shishda xatolik" });
  }
});

/**
 * 🟢 Admin → gradega teacher’ni olib tashlash
 */
router.post("/:id/remove-teacher", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;

    const grade = await prisma.grade.update({
      where: { id: Number(id) },
      data: {
        teachers: {
          disconnect: { id: Number(teacherId) },
        },
      },
      include: { teachers: true },
    });

    res.json({ message: "✅ Teacher grade’dan olib tashlandi", grade });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Teacher olib tashlashda xatolik" });
  }
});

export default router;
