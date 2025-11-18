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
// 👨‍🏫 Teacherning o‘ziga biriktirilgan sinflar ro‘yxati
router.get("/my", authenticate, authorize(["TEACHER"]), async (req: any, res) => {
  try {
    const teacherId = req.user.id;

    const grades = await prisma.grade.findMany({
      where: { teachers: { some: { id: teacherId } } },
      include: { subjects: true },
    });

    res.json(grades);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Sinflarni olishda xatolik" });
  }
});
// 🧍‍♂️ Berilgan sinfga tegishli o‘quvchilarni olish (teacher/student uchun)
router.get("/:gradeId/students", authenticate, async (req: any, res) => {
  try {
    const gradeId = Number(req.params.gradeId);
    const user = req.user;

    // 👨‍🏫 Agar teacher bo‘lsa — shu sinfga biriktirilganligini tekshiramiz
    if (user.role === "TEACHER") {
      const teacherHasAccess = await prisma.grade.findFirst({
        where: {
          id: gradeId,
          teachers: {
            some: { id: user.id },
          },
        },
      });

      if (!teacherHasAccess) {
        return res.status(403).json({ message: "❌ Siz bu sinfga kirish huquqiga ega emassiz" });
      }
    }

    // 👨‍🎓 Agar student bo‘lsa — faqat o‘z sinfiga ruxsat
    if (user.role === "STUDENT" && user.gradeId !== gradeId) {
      return res.status(403).json({ message: "❌ Siz boshqa sinf ma'lumotlariga kira olmaysiz" });
    }

    const students = await prisma.user.findMany({
      where: {
        gradeId: gradeId,
        role: "STUDENT",
      },
      select: {
        id: true,
        name: true,
        surname: true,
        username: true,
      },
      orderBy: [{ surname: "asc" },{name:"asc"}]
    });

    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "O‘quvchilarni olishda xatolik" });
  }
});
/**
 * 🔹 Ma’lum bir sinfni ID bo‘yicha olish (faqat o‘sha sinfga tegishli)
 */
router.get("/:gradeId", authenticate, authorize(["ADMIN", "TEACHER"]), async (req, res) => {
  try {
    const { gradeId } = req.params;

    const grade = await prisma.grade.findUnique({
      where: { id: Number(gradeId) },
      select: {
        id: true,
        name: true,
      },
    });

    if (!grade) {
      return res.status(404).json({ message: "Sinf topilmadi" });
    }

    res.json(grade);
  } catch (err) {
    console.error("Xatolik (GET /grades/:gradeId):", err);
    res.status(500).json({ message: "Sinfni olishda xatolik" });
  }
});

export default router;
