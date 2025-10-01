// src/routes/user.routes.ts
import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prisma/client";
import { authenticate, authorize, AuthRequest } from "../middlewares/auth";

const router = Router();

router.post("/", authenticate, authorize(["ADMIN"]), async (req: AuthRequest, res) => {
  try {
    const { name, surname, username, password, role, gradeId, teacherGradeIds } = req.body;

    if (!name || !surname || !username || !password || !role) {
      return res.status(400).json({ message: "ism, familya, username, parol va role kiritilishi kerak" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        surname,
        username,
        password: hashedPassword,
        role,

        ...(role === "STUDENT" && gradeId
          ? { grade: { connect: { id: gradeId } } }
          : {}),

        ...(role === "TEACHER" && Array.isArray(teacherGradeIds) && teacherGradeIds.length > 0
          ? { teacherGrades: { connect: teacherGradeIds.map((id: number) => ({ id })) } }
          : {}),
      },
      include: { grade: true, teacherGrades: true },
    });

    res.json({ message: "✅ Foydalanuvchi yaratildi", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.get("/", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { grade: true, teacherGrades: true },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});


router.put("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, surname, username, role, gradeId, teacherGradeIds } = req.body;

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
        ...(role === "TEACHER" && Array.isArray(teacherGradeIds)
          ? { teacherGrades: { set: teacherGradeIds.map((id: number) => ({ id })) } }
          : { teacherGrades: { set: [] } }),
      },
      include: { grade: true, teacherGrades: true },
    });

    res.json({ message: "Foydalanuvchi yangilandi", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});


router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id: Number(id) } });
    res.json({ message: "Foydalanuvchi o'chirildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

export default router;
