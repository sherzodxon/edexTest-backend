import { Router } from "express";
import prisma from "../prisma/client";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

router.post("/", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Sinf nomi kerak" });
    }

    const existing = await prisma.grade.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ message: "Bu sinf allaqachon mavjud" });
    }

    const grade = await prisma.grade.create({
      data: { name },
    });

    res.json({ message: "Sinf yaratildi", grade });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Sinf yaratishda xatolik" });
  }
});


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
    res.status(500).json({ message: "Sinflarni olishda xatolik" });
  }
});


router.put("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const grade = await prisma.grade.update({
      where: { id: Number(id) },
      data: { name },
    });

    res.json({ message: "Sinf  yangilandi", grade });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Sinf yangilashda xatolik" });
  }
});


router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.grade.delete({ where: { id: Number(id) } });

    res.json({ message: "Sinf o'chirildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Sinf o'chirishda xatolik" });
  }
});

router.post("/:id/add-teacher", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;

    const teacher = await prisma.user.findUnique({ where: { id: Number(teacherId) } });
    if (!teacher || teacher.role !== "TEACHER") {
      return res.status(400).json({ message: "Bunday o'qituvchi mavjud emas" });
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

    res.json({ message: "O'qituvchi sinfga biriktirildi", grade });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "O'qituvchi qo'shishda xatolik" });
  }
});


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

    res.json({ message: "O'qituvchu sinf'dan olib tashlandi", grade });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "O'qituvchi olib tashlashda xatolik" });
  }
});

export default router;
