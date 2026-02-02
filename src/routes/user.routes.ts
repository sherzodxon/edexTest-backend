import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../prisma/client";
import { authenticate, authorize, AuthRequest } from "../middlewares/auth";

const router = Router();

router.post("/", authenticate, authorize(["ADMIN"]), async (req: AuthRequest, res) => {
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
      return res.status(400).json({ message: "ism, familya, username, parol va role kiritilishi kerak" });
    }

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

    if (role === "STUDENT" && gradeId) {
      data.grade = { connect: { id: Number(gradeId) } };
    }

    if (role === "TEACHER") {
      if (Array.isArray(teacherGradeIds) && teacherGradeIds.length > 0) {
        data.teacherGrades = { connect: teacherGradeIds.map((id: any) => ({ id: Number(id) })) };
      }
      if (Array.isArray(teacherSubjectIds) && teacherSubjectIds.length > 0) {
        data.teacherSubjects = { connect: teacherSubjectIds.map((id: any) => ({ id: Number(id) })) };
      }
    }

    const user = await prisma.user.create({
      data,
      include: { grade: true, teacherGrades: true, teacherSubjects: true },
    });

    res.json({ message: "Foydalanuvchi yaratildi", user });
  } catch (err: any) {
    console.error("User create error:", err);
    res.status(500).json({ message: "Server xatosi", error: err.message || err });
  }
});

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

router.get("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      include: { grade: true, teacherGrades: true, teacherSubjects: true },
    });
    if (!user) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.put("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, surname, username, role, gradeId, teacherGradeIds, teacherSubjectIds, password } = req.body;

    const data: any = {
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
    };

    if (password) {
      const bcrypt = require("bcryptjs");
      data.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data,
      include: { grade: true, teacherGrades: true, teacherSubjects: true },
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
router.get("/user-analysis/:userId", authenticate, authorize(["ADMIN", "TEACHER"]), async (req: AuthRequest, res) => {
  try {
    const targetUserId = Number(req.params.userId);

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { 
        teacherSubjects: true 
      }
    });

    if (!targetUser) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });

    let labels: string[] = [];
    let dataPoints: number[] = [];

    if (targetUser.role === "TEACHER") {
      for (const subject of targetUser.teacherSubjects) {
        const stats = await prisma.userTest.aggregate({
          where: {
            test: { subjectId: subject.id },
            user: { role: "STUDENT" },
            finished: true
          },
          _avg: { score: true }
        });

        if (stats._avg.score !== null) {
          labels.push(subject.name);
          dataPoints.push(Math.round(stats._avg.score));
        }
      }
    } else {
      
      const userTests = await prisma.userTest.findMany({
        where: { userId: targetUserId, finished: true },
        include: { test: { include: { subject: true } } }
      });

      const subjectStats: Record<string, { total: number; count: number }> = {};
      userTests.forEach(ut => {
        const name = ut.test.subject.name;
        if (!subjectStats[name]) subjectStats[name] = { total: 0, count: 0 };
        subjectStats[name].total += ut.score;
        subjectStats[name].count += 1;
      });

      for (const name of Object.keys(subjectStats)) {
        labels.push(name);
        dataPoints.push(Math.round(subjectStats[name].total / subjectStats[name].count));
      }
    }

    res.json({
      userName: `${targetUser.name} ${targetUser.surname}`,
      labels,
      dataset: {
        label: targetUser.role === "TEACHER" ? "Sinf o'rtacha ko'rsatkichi" : "Shaxsiy natija",
        data: dataPoints,
        backgroundColor: "rgba(34, 197, 94, 0.2)", 
        borderColor: "rgb(34, 197, 94)",
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Xatolik" });
  }
});
export default router;
