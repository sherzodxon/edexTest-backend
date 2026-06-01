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
    if (!student || !student.groupId) 
      return res.status(400).json({ message: "O'quvchi topilmadi yoki guruhga biriktirilmagan" });

    // --- KUNLIK LIMIT TEKSHIRUVI ---
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayCount = await prisma.pointLog.count({
      where: {
        teacherId: req.user!.id,
        studentId: Number(studentId),
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });

    if (todayCount >= 3) {
      return res.status(429).json({ 
        message: `Siz bugun ${student.name} ${student.surname}ga allaqachon 3 marta ball kiritgansiz. Kunlik limit: 3 ta.` 
      });
    }
    // --- LIMIT TUGADI ---

    const pointsValue = Number(points);

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
        data: { totalPoints: { increment: pointsValue } }
      })
    ]);

    res.json({ 
      message: "Muvaffaqiyatli bajarildi", 
      data: result[0],
      remainingToday: 2 - todayCount // nechta qoldi
    });
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
const getMondayOfCurrentWeek = () => {
  const today = new Date();
  const day = today.getDay(); // 0 (yakshanba) - 6 (shanba)
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Dushanbaga qaytish
  const monday = new Date(today.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};
router.get("/weekly-stats", async (req, res) => {
  try {
    const monday = getMondayOfCurrentWeek();
    const groups = await prisma.group.findMany({
      include: {
        students: {
          include: {
            receivedLogs: {
              where: { createdAt: { gte: monday } },
              select: { points: true }
            }
          }
        },
        pointLogs: {
          where: { createdAt: { gte: monday } },
          select: { points: true }
        }
      }
    });

    const groupStats = groups.map(g => {
      const weeklyTotal = g.pointLogs.reduce((sum: number, log: { points: number }) => sum + log.points, 0);

      const studentsWithWeeklyPoints = g.students.map((s) => ({
        id: s.id,
        name: s.name,
        surname: s.surname,
        totalPoints: s.receivedLogs.reduce((sum: number, log: { points: number }) => sum + log.points, 0)
      })).sort((a, b) => b.totalPoints - a.totalPoints);

      return {
        id: g.id,
        name: g.name,
        logo: g.logo,
        totalPoints: weeklyTotal,
        students: studentsWithWeeklyPoints
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);

    const recentLogs = await prisma.pointLog.findMany({
      where: { createdAt: { gte: monday } },
      take: 300,
      include: {
        student: { select: { name: true, surname: true } },
        teacher: { select: { name: true, surname: true } },
        group: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ groupStats, recentLogs });
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ message: "Server xatoligi" });
  }
});
// GET /api/points/range-stats?from=2026-05-01&to=2026-06-01&groupId=1
router.get("/range-stats", async (req, res) => {
  try {
    const { from, to, groupId } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "'from' va 'to' parametrlari majburiy (YYYY-MM-DD)" });
    }

    const fromDate = new Date(from as string);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to as string);
    toDate.setHours(23, 59, 59, 999);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ message: "Noto'g'ri sana formati. YYYY-MM-DD formatida yuboring" });
    }

    const whereGroup = groupId ? { id: Number(groupId) } : {};

    const groups = await prisma.group.findMany({
      where: whereGroup,
      include: {
        students: {
          include: {
            receivedLogs: {
              where: { createdAt: { gte: fromDate, lte: toDate } },
              select: { points: true }
            }
          }
        },
        pointLogs: {
          where: { createdAt: { gte: fromDate, lte: toDate } },
          select: { points: true }
        }
      }
    });

    const groupStats = groups.map(g => {
      const totalPoints = g.pointLogs.reduce((sum, log) => sum + log.points, 0);

      const students = g.students
        .map(s => ({
          id: s.id,
          name: s.name,
          surname: s.surname,
          points: s.receivedLogs.reduce((sum, log) => sum + log.points, 0)
        }))
        .sort((a, b) => b.points - a.points);

      return {
        id: g.id,
        name: g.name,
        logo: g.logo,
        totalPoints,
        students
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);

    const recentLogs = await prisma.pointLog.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
        ...(groupId ? { groupId: Number(groupId) } : {})
      },
      take: 300,
      include: {
        student: { select: { name: true, surname: true } },
        teacher: { select: { name: true, surname: true } },
        group: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ 
      groupStats, 
      recentLogs,
      period: { from: fromDate, to: toDate }
    });
  } catch (err) {
    console.error("Range stats error:", err);
    res.status(500).json({ message: "Server xatoligi" });
  }
});
export default router;