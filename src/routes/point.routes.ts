import { Router } from "express";
import prisma from "../prisma/client";
import { authenticate, authorize, AuthRequest } from "../middlewares/auth";

const router = Router();

router.post("/teacher/give", authenticate, authorize(["TEACHER"]), async (req: AuthRequest, res) => {
  try {
    const { studentId, points, band, article, description } = req.body;

    if (!band || !article) {
      return res.status(400).json({ message: "O'qituvchi faqat qoidalar (bob va modda) asosida ball bera oladi!" });
    }

    const student = await prisma.user.findUnique({ where: { id: Number(studentId) } });
    if (!student || !student.groupId) return res.status(400).json({ message: "O'quvchi topilmadi yoki guruhga biriktirilmagan" });

    const pointsValue = Number(points); // MUHIM: Son ekanligini ta'minlash

    const result = await prisma.$transaction([
      prisma.pointLog.create({
        data: {
          points: pointsValue,
          band: Number(band),
          article: Number(article),
          description,
          studentId: student.id,
          groupId: student.groupId,
          teacherId: req.user!.id
        }
      }),
      prisma.user.update({
        where: { id: student.id },
        data: { totalPoints: { increment: pointsValue } } // 10 + (-20) = -10 chiqadi
      })
    ]);

    res.json({ message: "Muvaffaqiyatli bajarildi", data: result[0] });
  } catch (err) {
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.post("/admin/adjust", authenticate, authorize(["ADMIN"]), async (req: AuthRequest, res) => {
  try {
    const { studentId, groupId, points, description } = req.body;
    const pointsValue = Number(points); 

    if (studentId) {
      const student = await prisma.user.findUnique({ where: { id: Number(studentId) } });
      if (!student) return res.status(404).json({ message: "O'quvchi topilmadi" });

      const result = await prisma.$transaction([
        prisma.pointLog.create({
          data: {
            points: pointsValue,
            band: 0, article: 0, 
            description: description || "Admin tomonidan tuzatish",
            studentId: student.id,
            groupId: student.groupId!,
            teacherId: req.user!.id
          }
        }),
        prisma.user.update({
          where: { id: student.id },
          data: { totalPoints: { increment: pointsValue } }
        })
      ]);
      return res.json({ message: "Ball o'zgartirildi", result });
    }

    if (groupId) {
      const result = await prisma.$transaction([
        prisma.pointLog.create({
          data: {
            points: pointsValue,
            band: 0, article: 0,
            description: description || "Admin tomonidan guruhga ball",
            groupId: Number(groupId),
            teacherId: req.user!.id
          }
        }),
        prisma.group.update({
          where: { id: Number(groupId) },
          data: { totalPoints: { increment: pointsValue } } 
        })
      ]);
      return res.json({ message: "Guruh bali yangilandi", result });
    }

    res.status(400).json({ message: "StudentId yoki GroupId kerak" });
  } catch (err) {
    res.status(500).json({ message: "Admin operatsiyasida xatolik" });
  }
});

router.delete("/admin/cancel/:logId", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const logId = Number(req.params.logId);

    const log = await prisma.pointLog.findUnique({
      where: { id: logId }
    });

    if (!log) {
      return res.status(404).json({ message: "Ball hodisasi topilmadi" });
    }

    await prisma.$transaction(async (tx) => {
      
      if (log.studentId) {
        await tx.user.update({
          where: { id: log.studentId },
          data: {
            totalPoints: { decrement: log.points } 
          }
        });
      }

      await tx.pointLog.delete({
        where: { id: logId }
      });
    });

    res.json({ message: "Ball muvaffaqiyatli bekor qilindi va student balidan olib tashlandi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Bekor qilishda xatolik yuz berdi" });
  }
});
router.get("/logs",
   async (req, res) => {
  const { groupId, studentId } = req.query;
  
  try {
    const logs = await prisma.pointLog.findMany({
      where: {
        AND: [
          groupId ? { groupId: Number(groupId) } : {},
          studentId ? { studentId: Number(studentId) } : {}
        ]
      },
      include: { 
        student: { select: { name: true, surname: true } },
        teacher: { select: { name: true, surname: true } } 
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: "Loglarni yuklashda xatolik" });
  }
});
router.get("/stats", async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        students: true 
      }
    });

    const groupStats = groups.map(g => ({
      id: g.id,
      name: g.name,
      totalPoints: g.students.reduce((sum, s: any) => sum + (s.points || 0), 0)
    })).sort((a, b) => b.totalPoints - a.totalPoints);

    const recentLogs = await prisma.pointLog.findMany({
      take: 20,
      include: {
        student: { select: { name: true, surname: true } },
        teacher: { select: { name: true, surname: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ groupStats, recentLogs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Dashboard xatoligi" });
  }
});
export default router;