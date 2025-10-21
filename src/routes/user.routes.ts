import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prisma/client";
import { authenticate, authorize, AuthRequest } from "../middlewares/auth";

const router = Router();

/**
 * 🟢 Admin → foydalanuvchi yaratish
 */
router.post(
  "/",
  authenticate,
  authorize(["ADMIN"]),
  async (req: AuthRequest, res) => {
    try {
      const {
        name,
        surname,
        username,
        password,
        role,
        gradeId,
        teacherGradeIds,
        teacherSubjectIds,
      } = req.body;

      if (!name || !surname || !username || !password || !role) {
        return res
          .status(400)
          .json({ message: "ism, familya, username, parol va role kiritilishi kerak" });
      }

      // Username uniqueness tekshiruvi (unique constraint xatolarini oldini oladi)
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return res.status(400).json({ message: "Bu username allaqachon mavjud" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const data: any = {
        name,
        surname,
        username,
        password: hashedPassword,
        role,
      };

      // Student uchun: to'g'ridan-to'g'ri grade bog'lash
      if (role === "STUDENT" && gradeId) {
        data.grade = { connect: { id: Number(gradeId) } };
      }

      // Teacher uchun: teacherGrades va teacherSubjects nomlari
      if (role === "TEACHER") {
        if (Array.isArray(teacherGradeIds) && teacherGradeIds.length > 0) {
          data.teacherGrades = {
            connect: teacherGradeIds.map((id: any) => ({ id: Number(id) })),
          };
        }
        if (Array.isArray(teacherSubjectIds) && teacherSubjectIds.length > 0) {
          data.teacherSubjects = {
            connect: teacherSubjectIds.map((id: any) => ({ id: Number(id) })),
          };
        }
      }

      const user = await prisma.user.create({
        data,
        include: {
          grade: true,
          teacherGrades: true,
          teacherSubjects: true,
        },
      });

      res.json({ message: "Foydalanuvchi yaratildi", user });
    } catch (err: any) {
      console.error("User create error:", err);
      // Development uchun xato xabarini yuborish (productionda ehtiyot bo'ling)
      res.status(500).json({ message: "Server xatosi", error: err.message || err });
    }
  }
);

/**
 * 🟢 Barcha foydalanuvchilar
 */
router.get("/", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { grade: true, teacherGrades: true, teacherSubjects: true },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

/**
 * 🟢 Foydalanuvchini yangilash
 */
router.put("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, surname, username, role, gradeId, teacherGradeIds, teacherSubjectIds } = req.body;

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        name,
        surname,
        username,
        role,

        ...(role === "STUDENT" && gradeId
          ? { grade: { connect: { id: gradeId } } }
          : { grade: { disconnect: true } }),

        ...(role === "TEACHER"
          ? {
              teacherGrades: Array.isArray(teacherGradeIds)
                ? { set: teacherGradeIds.map((id: number) => ({ id })) }
                : { set: [] },
              teacherSubjects: Array.isArray(teacherSubjectIds)
                ? { set: teacherSubjectIds.map((id: number) => ({ id })) }
                : { set: [] },
            }
          : { teacherGrades: { set: [] }, teacherSubjects: { set: [] } }),
      },
      include: { grade: true, teacherGrades: true, teacherSubjects: true },
    });

    res.json({ message: "✅ Foydalanuvchi yangilandi", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

/**
 * 🟢 Foydalanuvchini o‘chirish
 */
router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id: Number(id) } });
    res.json({ message: "✅ Foydalanuvchi o‘chirildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

export default router;
 