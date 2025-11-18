import {Router} from "express";
import prisma from "../prisma/client";
import {authenticate, authorize, AuthRequest} from "../middlewares/auth";

const router = Router();

/**
 * 🟢 Subject yaratish (faqat ADMIN)
 */
router.post("/", authenticate, authorize(["ADMIN"]), async(req, res) => {
    try {
        const {name, gradeId} = req.body;

        if (!name || !gradeId) {
            return res
                .status(400)
                .json({message: "❌ name va gradeId kiritilishi shart"});
        }

        const subject = await prisma
            .subject
            .create({
                data: {
                    name,
                    gradeId: Number(gradeId)
                },
                include: {
                    grade: true
                }
            });

        res.json({message: "✅ Subject yaratildi", subject});
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .json({message: "Server xatosi"});
    }
});

/**
 * 🟢 Barcha subjectlarni olish
 */
router.get("/", authenticate, async(req, res) => {
    try {
        const subjects = await prisma
            .subject
            .findMany({
                include: {
                    grade: true
                }
            });
        res.json(subjects);
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .json({message: "Server xatosi"});
    }
});

/**
 * 🟢 Bitta grade uchun subjectlarni olish
 */
router.get("/grade/:gradeId", authenticate, async(req, res) => {
    try {
        const gradeId = Number(req.params.gradeId);
        const subjects = await prisma
            .subject
            .findMany({where: {
                    gradeId
                }});
        res.json(subjects);
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .json({message: "Server xatosi"});
    }
});
// 🟡 O'qituvchiga biriktirilgan fanlarni olish
router.get("/my", authenticate, authorize(["TEACHER"]), async(req : any, res) => {
    try {
        const teacherId = req.user.id;

        const subjects = await prisma
            .subject
            .findMany({
                where: {
                    teachers: {
                        some: {
                            id: teacherId
                        }
                    }
                },
                include: {
                    grade: true
                }
            });

        res.json(subjects);
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .json({message: "O'qituvchining fanlarini olishda xatolik"});
    }
});
router.put("/:id", authenticate, authorize(["ADMIN"]), async(req, res) => {
    const {id} = req.params;
    const updated = await prisma
        .subject
        .update({
            where: {
                id: Number(id)
            },
            data: {
                name: req.body.name
            }
        });
    res.json(updated);
});
router.delete("/:id", authenticate, authorize(["ADMIN"]), async(req, res) => {
    const {id} = req.params;
    await prisma
        .subject
        .delete({
            where: {
                id: Number(id)
            }
        });
    res.json({success: true});
});

/**
 * 🟢 Student uchun fan testlarini olish
 * GET /student/subjects/:id/tests
 */
router.get("/:id/tests", authenticate, authorize(["STUDENT"]), async (req: AuthRequest, res) => {
  try {
    const subjectId = Number(req.params.id);
    const studentId = req.user!.id;

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        grade: true,
        tests: {
          include: {
            userTests: {
              where: { userId: studentId }, // faqat o'z natijasi
            },
          },
        },
      },
    });

    if (!subject) return res.status(404).json({ message: "Fan topilmadi" });

    // Frontendga yuboriladigan format
    const tests = subject.tests.map((t) => {
      const ut = t.userTests[0];
      return {
        id: t.id,
        title: t.title,
        startTime: t.startTime,
        endTime: t.endTime,
        finished: !!ut?.finished,
        score: ut?.score ?? null,
      };
    });

    res.json({
      id: subject.id,
      name: subject.name,
      grade: subject.grade,
      tests,
    });
  } catch (err) {
    console.error("❌ Student tests fetch error:", err);
    res.status(500).json({ message: "Fan testlarini olishda xatolik yuz berdi" });
  }
});
router.get("/teacher/:id/tests", authenticate, authorize(["TEACHER"]), async (req:AuthRequest, res) => {
  try {
    const subjectId = Number(req.params.id);
    const teacherId = req.user!.id;

    const tests = await prisma.test.findMany({
      where: {
        subjectId,
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        createdAt: true
      }
    });

    res.json(tests);
  } catch (err) {
    console.error("Teacher tests error:", err);
    res.status(500).json({ message: "Testlarni olishda xatolik yuz berdi" });
  }
});


// /subjects/:id/average
router.get("/:id/average", authenticate, authorize(["TEACHER"]), async (req: AuthRequest, res) => {
  try {
    const subjectId = Number(req.params.id);
    const teacherId = req.user!.id;

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        teachers: true,
        tests: {
          where: { teacherId },
          include: { userTests: true }
        }
      }
    });

    if (!subject) return res.status(404).json({ message: "Fan topilmadi" });

    if (!subject.teachers.some(t => t.id === teacherId)) {
      return res.status(403).json({ message: "Bu fan sizga biriktirilmagan" });
    }

    const results = subject.tests.map(t => ({
      testId: t.id,
      testName: t.title,
      averageResult:
        t.userTests.length > 0
          ? Math.round(t.userTests.reduce((sum, ut) => sum + (ut.score ?? 0), 0) / t.userTests.length)
          : 0
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Teacher average natijalarni olishda xatolik" });
  }
});


router.get("/teacher/subjects/:id/tests", authenticate, authorize(["TEACHER"]), async (req: AuthRequest, res) => {
  try {
    const subjectId = Number(req.params.id);
    const teacherId = req.user!.id;

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        teachers: true,
        tests: {
          where: { teacherId },
          include: { userTests: true }
        }
      }
    });

    if (!subject) return res.status(404).json({ message: "Fan topilmadi" });

    if (!subject.teachers.some(t => t.id === teacherId)) {
      return res.status(403).json({ message: "Bu fan sizga biriktirilmagan" });
    }

    const results = subject.tests.map(t => {
      const avg =
        t.userTests.length > 0
          ? t.userTests.reduce((s, a) => s + a.score, 0) / t.userTests.length
          : 0;

      return {
        id: t.id,
        title: t.title,
        result: avg
      };
    });

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Teacher testlarini olishda xatolik" });
  }
});

// ADMIN: barcha fanlar ro'yxati
router.get("/admin/subjects", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({ include: { grade: true } });
    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fanlarni olishda xatolik" });
  }
});


/**
 * 🔹 Fan bo‘yicha testlarni olish (STUDENT / TEACHER / ADMIN)
 */
router.get("/admin/:id/tests", authenticate, async (req: AuthRequest, res) => {
  try {
    const subjectId = Number(req.params.id);
    const user = req.user!;

    // Fanni tekshiramiz
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        teachers: true,
        tests: {
          include: {
            userTests: true,
          },
        },
      },
    });

    if (!subject) return res.status(404).json({ message: "Fan topilmadi" });

    let testsData: any[] = [];

    if (user.role === "STUDENT") {
      // O‘quvchi: faqat o‘z natijasini oladi
      const studentTests = subject.tests.map((t) => {
        const ut = t.userTests.find((ut) => ut.userId === user.id);
        return {
          id: t.id,
          title: t.title,
          startTime: t.startTime,
          endTime: t.endTime,
          createdAt: t.createdAt,
          userTests: ut
            ? [
                {
                  userId: ut.userId,
                  score: ut.score,
                  finished: ut.finished,
                },
              ]
            : [],
        };
      });
      testsData = studentTests;
    } else if (user.role === "TEACHER") {
      // O‘qituvchi: faqat shu fan unga biriktirilgan bo‘lsa
      if (!subject.teachers.some((t) => t.id === user.id)) {
        return res
          .status(403)
          .json({ message: "Bu fan sizga biriktirilmagan" });
      }

      testsData = subject.tests.map((t) => {
        const avg =
          t.userTests.length > 0
            ? t.userTests.reduce((s, ut) => s + (ut.score ?? 0), 0) /
              t.userTests.length
            : 0;
        return {
          id: t.id,
          title: t.title,
          startTime: t.startTime,
          endTime: t.endTime,
          createdAt: t.createdAt,
          average: avg,
        };
      });
    } else if (user.role === "ADMIN") {
      // Admin: barcha testlar va barcha userTests
      testsData = subject.tests.map((t) => ({
        id: t.id,
        title: t.title,
        startTime: t.startTime,
        endTime: t.endTime,
        createdAt: t.createdAt,
        userTests: t.userTests.map((ut) => ({
          userId: ut.userId,
          score: ut.score,
          finished: ut.finished,
        })),
      }));
    }

    res.json({ tests: testsData });
  } catch (err) {
    console.error("Error fetching tests:", err);
    res.status(500).json({ message: "Testlarni olishda xatolik" });
  }
});

export default router;
