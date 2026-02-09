import {Router} from "express";
import prisma from "../prisma/client";
import {authenticate, authorize, AuthRequest} from "../middlewares/auth";

const router = Router();

router.post("/", authenticate, authorize(["ADMIN"]), async(req, res) => {
    try {
        const {name, gradeId} = req.body;

        if (!name || !gradeId) {
            return res
                .status(400)
                .json({message: "name va gradeId kiritilishi shart"});
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

        res.json({message: "Subject yaratildi", subject});
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .json({message: "Server xatosi"});
    }
});

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
              where: { userId: studentId }, 
            },
          },
        },
      },
    });

    if (!subject) return res.status(404).json({ message: "Fan topilmadi" });

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
    console.error("Student tests fetch error:", err);
    res.status(500).json({ message: "Fan testlarini olishda xatolik yuz berdi" });
  }
});
router.get("/teacher/:id/tests", authenticate, authorize(["TEACHER"]), async (req: AuthRequest, res) => {
  try {
    const subjectId = Number(req.params.id);
    const teacherId = req.user!.id;

    const tests = await prisma.test.findMany({
      where: {
        subjectId,
        teacherId, 
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        createdAt: true,
        _count: {
          select: { questions: true } 
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedTests = tests.map(t => ({
      id: t.id,
      title: t.title,
      startTime: t.startTime,
      endTime: t.endTime,
      createdAt: t.createdAt,
      questionCount: t._count.questions 
    }));

    res.json(formattedTests);
  } catch (err) {
    console.error("Teacher tests error:", err);
    res.status(500).json({ message: "Testlarni olishda xatolik yuz berdi" });
  }
});

router.get("/:id/average", authenticate, authorize(["TEACHER"]), async (req: AuthRequest, res) => {
  try {
    const subjectId = Number(req.params.id);
    const teacherId = req.user!.id;

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        teachers: { where: { id: teacherId } },
        tests: {
          where: { teacherId: teacherId },
          select: { id: true, title: true }
        }
      }
    });

    if (!subject) return res.status(404).json({ message: "Fan topilmadi" });
    if (subject.teachers.length === 0) {
      return res.status(403).json({ message: "Bu fan sizga biriktirilmagan" });
    }

    const results = await Promise.all(
      subject.tests.map(async (test) => {
        const stats = await prisma.userTest.aggregate({
          where: {
            testId: test.id,
            user: {
              role: "STUDENT"
            },
            finished: true
          },
          _avg: {
            score: true
          },
          _count: {
            id: true
          }
        });

        return {
          testId: test.id,
          testName: test.title,
          participantsCount: stats._count.id || 0,
          averageResult: stats._avg.score ? Math.round(stats._avg.score) : 0
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error("Average calculation error:", err);
    res.status(500).json({ message: "Statistikani hisoblashda xatolik" });
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

router.get("/admin/subjects", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({ include: { grade: true } });
    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fanlarni olishda xatolik" });
  }
});


router.get("/admin/:id/tests", authenticate, async (req: AuthRequest, res) => {
  try {
    const subjectId = Number(req.params.id);
    const user = req.user!;

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: { 
        teachers: true,
        tests: true 
      }
    });

    if (!subject) return res.status(404).json({ message: "Fan topilmadi" });

    if (user.role === "TEACHER" && !subject.teachers.some((t) => t.id === user.id)) {
      return res.status(403).json({ message: "Bu fan sizga biriktirilmagan" });
    }

    const testsData = await Promise.all(
      subject.tests.map(async (test) => {
        const stats = await prisma.userTest.aggregate({
          where: {
            testId: test.id,
            user: { role: "STUDENT" },
            finished: true
          },
          _avg: { score: true },
          _count: { id: true }
        });

        const count = stats._count.id;
        const avg = stats._avg.score ? Math.round(stats._avg.score) : 0;

        if (user.role === "STUDENT") {
          const myTest = await prisma.userTest.findFirst({
            where: { testId: test.id, userId: user.id }
          });
          return {
            id: test.id,
            title: test.title,
            userTests: myTest ? [myTest] : []
          };
        }

        let participants = undefined;
        if (user.role === "ADMIN") {
          participants = await prisma.userTest.findMany({
            where: { testId: test.id, user: { role: "STUDENT" }, finished: true },
            include: { user: { select: { name: true, role: true } } }
          });
        }

        return {
          id: test.id,
          title: test.title,
          startTime: test.startTime,
          endTime: test.endTime,
          createdAt: test.createdAt,
          average: avg,
          participantsCount: count,
          userTests: participants
        };
      })
    );

    res.json({ tests: testsData });
  } catch (err) {
    console.error("Aggregation Error:", err);
    res.status(500).json({ message: "Statistikani olishda xatolik" });
  }
});
export default router;
