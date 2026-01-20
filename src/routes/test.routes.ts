import { Router } from "express";
import prisma from "../prisma/client";
import { authenticate, authorize, AuthRequest } from "../middlewares/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();


const uploadDir = path.join(__dirname, "../../uploads/questions");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

router.post("/", authenticate, authorize(["TEACHER"]), upload.any(), async (req: AuthRequest, res) => {
  try {
    const { title, subjectId, startTime, endTime, questions } = JSON.parse(req.body.data);
    const files = req.files as Express.Multer.File[];

    const fileMap: Record<string, string> = {};
    files.forEach((f) => (fileMap[f.fieldname] = `/uploads/questions/${f.filename}`));

    const test = await prisma.test.create({
      data: {
        title,
        subjectId: Number(subjectId),
        teacherId: req.user!.id,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        questions: {
          create: questions.map((q: any) => ({
            text: q.text,
            img: q.imgKey && fileMap[q.imgKey] ? fileMap[q.imgKey] : null,
            options: { create: q.options.map((o: any) => ({ text: o.text, isCorrect: o.isCorrect })) },
          })),
        },
      },
      include: { questions: { include: { options: true } } },
    });

    res.json({ message: "Test yaratildi", test });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Test yaratishda xatolik" });
  }
});

router.get("/subjects/:id/tests", authenticate, authorize(["STUDENT", "TEACHER"]), async (req, res) => {
  try {
    const subjectId = Number(req.params.id);

    const tests = await prisma.test.findMany({
      where: { subjectId },
      include: { subject: { include: { grade: true } }, questions: { select: { id: true } } },
    });

    res.json(tests.map((t) => ({
      id: t.id,
      title: t.title,
      subject: t.subject.name,
      grade: t.subject.grade.name,
      questionCount: t.questions.length,
      startTime: t.startTime,
      endTime: t.endTime,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Testlarni olishda xatolik" });
  }
});

router.get("/:id", authenticate, authorize(["STUDENT", "TEACHER", "ADMIN"]), async (req: AuthRequest, res) => {
  try {
    const testId = Number(req.params.id);
    const userId = req.user!.id;
    const now = new Date();

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        subject: true,
        questions: {
          include: { options: true, answers: { where: { studentId: userId } } },
        },
      },
    });

    if (!test) return res.status(404).json({ message: "Test topilmadi" });

    const hasEnded = test.endTime ? now > test.endTime : false;
    const hasStarted = test.startTime ? now >= test.startTime : true;

    if (req.user?.role === "STUDENT" && !hasStarted)
      return res.status(400).json({ message: "Test hali boshlanmagan" });

    let userTest = await prisma.userTest.findUnique({
      where: { userId_testId: { userId, testId } },
    });

    if (!userTest) {
      const randomOrder = test.questions
        .map((q) => q.id)
        .sort(() => Math.random() - 0.5)
        .join(",");

      userTest = await prisma.userTest.create({
        data: { userId, testId, questionOrder: randomOrder },
      });
    }

    const questionOrder = userTest.questionOrder
      ? userTest.questionOrder.split(",").map((id) => Number(id))
      : test.questions.map((q) => q.id);

    const orderedQuestions = questionOrder
      .map((qid) => test.questions.find((q) => q.id === qid))
      .filter(Boolean) as typeof test.questions;

    const userFinished = !!userTest.finished || hasEnded;
    const userScore = userTest.score ?? null;

    if (userFinished) {
      const resultData = {
        id: test.id,
        title: test.title,
        subject: test.subject.name,
        userFinished,
        userScore,
        questions: orderedQuestions.map((q) => {
          const userAnswer = q.answers.find((a) => a.studentId === userId);
          const correctOption = q.options.find((o) => o.isCorrect);

          return {
            id: q.id,
            text: q.text,
            img: q.img ? `https://api.edexschool.uz${q.img}` : null,
            correctOption: correctOption?.text ?? null,
            selectedOption: userAnswer
              ? q.options.find((o) => o.id === userAnswer.optionId)?.text
              : null,
            isCorrect: userAnswer
              ? q.options.find((o) => o.id === userAnswer.optionId)?.isCorrect
              : false,
            options: q.options.map((o) => ({
              id: o.id,
              text: o.text,
              isCorrect: o.isCorrect,
            })),
          };
        }),
      };
      return res.json(resultData);
    }
    const activeData = {
      id: test.id,
      title: test.title,
      subject: test.subject.name,
      startTime: test.startTime,
      endTime: test.endTime,
      userFinished: false,
      questions: orderedQuestions.map((q) => ({
        id: q.id,
        text: q.text,
        img: q.img ? `https://api.edexschool.uz${q.img}` : null,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
      })),
    };

    res.json(activeData);
  } catch (err) {
    console.error("Testni olishda xatolik:", err);
    res.status(500).json({ message: "Testni olishda xatolik" });
  }
});

router.post("/:id/submit", authenticate, authorize(["STUDENT"]), async (req: AuthRequest, res) => {
  try {
    const testId = Number(req.params.id);
    const userId = req.user!.id;
    const now = new Date();

    let answers = req.body.answers;
    if (!answers && Array.isArray(req.body)) answers = req.body;
    if (!answers) return res.status(400).json({ message: "answers topilmadi yoki noto'g'ri formatda" });


    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { questions: { include: { options: true } } },
    });

    if (!test) return res.status(404).json({ message: "Test topilmadi" });
    if (!test.questions.length) return res.status(400).json({ message: "Testda savollar mavjud emas" });

    if (test.startTime && now < test.startTime) return res.status(400).json({ message: "Test hali boshlanmagan" });

    await prisma.answer.deleteMany({
      where: { studentId: userId, questionId: { in: test.questions.map((q) => q.id) } },
    });

    for (const ans of answers) {
      if (!ans.questionId || !ans.optionId) continue;
      await prisma.answer.create({
        data: {
          studentId: userId,
          questionId: Number(ans.questionId),
          optionId: Number(ans.optionId),
        },
      });
    }

    let correctCount = 0;
    for (const q of test.questions) {
      const correctOption = q.options.find((o) => o.isCorrect);
      const studentAns = answers.find((a: any) => a.questionId === q.id);
      if (studentAns && studentAns.optionId === correctOption?.id) correctCount++;
    }

    const percentage = Math.round((correctCount / test.questions.length) * 100);

    await prisma.userTest.upsert({
      where: { userId_testId: { userId, testId } },
      update: { finished: true, score: percentage },
      create: { userId, testId, finished: true, score: percentage },
    });

    const resultData = {
      id: test.id,
      title: test.title,
      subject: (await prisma.subject.findUnique({ where: { id: test.subjectId } }))?.name ?? "",
      userFinished: true,
      userScore: percentage,
      questions: test.questions.map((q) => {
        const userAnswer = answers.find((a: any) => a.questionId === q.id);
        const correctOption = q.options.find((o) => o.isCorrect);

        return {
          id: q.id,
          text: q.text,
          img: q.img ? `${q.img}` : null,
          correctOption: correctOption?.text ?? null,
          selectedOption: userAnswer ? q.options.find((o) => o.id === userAnswer.optionId)?.text : null,
          isCorrect: userAnswer ? q.options.find((o) => o.id === userAnswer.optionId)?.isCorrect : false,
          options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
        };
      }),
    };

    return res.json(resultData);

  } catch (err: any) {
    console.error("/submit error:", err.message || err);
    return res.status(500).json({ message: "Testni yakunlashda xatolik yuz berdi" });
  }
});

router.get("/:id/results", authenticate, authorize(["TEACHER"]), async (req, res) => {
  try {
    
    const testId = Number(req.params.id);

    const results = await prisma.userTest.findMany({
      where: {
        testId,                      
        user: { role: "STUDENT" },  
      },
      include: {
        user: true, 
        test: {
          include: {
            questions: {
              include: {
                options: true, 
                answers: true, 
              },
            },
          },
        },
      },
    });


    const formatted = results.map((r) => ({
      student: `${r.user.name} ${r.user.surname}`,
      score: r.score,
      answers: r.test.questions.map((q) => {
        const ans = q.answers.find((a) => a.studentId === r.userId);
        return {
          question: q.text,
          selected: ans
            ? q.options.find((o) => o.id === ans.optionId)?.text
            : null,
          correct: q.options.find((o) => o.isCorrect)?.text,
          isCorrect: ans
            ? q.options.find((o) => o.id === ans.optionId)?.isCorrect
            : false,
        };
      }),
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Natijalarni olishda xatolik" });
  }
});



router.get("/", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const tests = await prisma.test.findMany({
      include: { subject: true, questions: { include: { options: true } } },
      orderBy: { id: "desc" },
    });
    res.json(tests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Testlarni olishda xatolik yuz berdi" });
  }
});

router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const test = await prisma.test.findUnique({ where: { id } });
    if (!test) return res.status(404).json({ message: "Test topilmadi" });

    await prisma.answer.deleteMany({ where: { question: { testId: id } } });
    await prisma.option.deleteMany({ where: { question: { testId: id } } });
    await prisma.question.deleteMany({ where: { testId: id } });
    await prisma.userTest.deleteMany({ where: { testId: id } });
    await prisma.test.delete({ where: { id } });

    res.json({ message: "Test muvaffaqiyatli o'chirildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Testni o'chirishda xatolik yuz berdi" });
  }
});
router.get("/:id", authenticate, authorize(["STUDENT", "TEACHER", "ADMIN"]), async (req: AuthRequest, res) => {
  try {
    const testId = Number(req.params.id);
    const userId = req.user!.id;
    const now = new Date();

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        subject: true,
        questions: { include: { options: true, answers: { where: { studentId: userId } } } },
      },
    });

    if (!test) return res.status(404).json({ message: "Test topilmadi" });

    const hasEnded = test.endTime && now > test.endTime;
    const hasStarted = test.startTime ? now >= test.startTime : true;

    if (req.user?.role === "STUDENT" && !hasStarted)
      return res.status(400).json({ message: "Test hali boshlanmagan" });

    
    let userTest = await prisma.userTest.findUnique({
      where: { userId_testId: { userId, testId } },
    });

    if (hasEnded && !userTest) {
      let correctCount = 0;
      for (const q of test.questions) {
        const studentAns = q.answers[0]; 
        const correctOption = q.options.find((o) => o.isCorrect);
        if (studentAns && studentAns.optionId === correctOption?.id) correctCount++;
      }
      const score = Math.round((correctCount / test.questions.length) * 100);
      userTest = await prisma.userTest.create({
        data: { userId, testId, finished: true, score },
      });
    }

    const userFinished = !!userTest || hasEnded;
    const userScore = userTest?.score ?? null;

    const resultData = {
      id: test.id,
      title: test.title,
      subject: test.subject.name,
      userFinished,
      userScore,
      questions: test.questions.map((q) => {
        const userAnswer = q.answers[0]; 
        const correctOption = q.options.find((o) => o.isCorrect);
        return {
          id: q.id,
          text: q.text,
          img: q.img ? `https://api.edexschool.uz${q.img}` : null,
          correctOption: correctOption?.text ?? null,
          selectedOption: userAnswer ? q.options.find((o) => o.id === userAnswer.optionId)?.text : null,
          isCorrect: userAnswer ? q.options.find((o) => o.id === userAnswer.optionId)?.isCorrect : false,
          options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
        };
      }),
    };

    return res.json(resultData);

  } catch (err) {
    console.error("Testni olishda xatolik:", err);
    return res.status(500).json({ message: "Testni olishda xatolik" });
  }
});

router.get(
  "/results/:subjectId",
  authenticate,
  authorize(["STUDENT", "TEACHER", "ADMIN"]),
  async (req: AuthRequest, res) => {
    try {
      const subjectId = Number(req.params.subjectId);
      const user = req.user!;
      const role = user.role;
      const { type } = req.query; 
      const tests = await prisma.test.findMany({
        where: { subjectId },
        include: {
          userTests: {
            include: {
              user: {
                select: { id: true, name: true, surname: true },
              },
            },
          },
          subject: { select: { name: true } },
        },
        orderBy: { id: "desc" },
      });

      if (!tests.length)
        return res
          .status(404)
          .json({ message: "Bu fan bo'yicha testlar topilmadi" });

      if (role === "STUDENT") {
        const results = tests
          .map((t) => {
            const studentTest = t.userTests.find((ut) => ut.userId === user.id);
            return studentTest
              ? { testName: t.title, result: studentTest.score }
              : null;
          })
          .filter(Boolean);
        return res.json(results);
      }

      if (role === "TEACHER" || role === "ADMIN") {
        if (type === "detailed") {
          const detailed = tests.map((t) => ({
            testId: t.id,
            testName: t.title,
            results: t.userTests.map((ut) => ({
              studentId: ut.user.id,
              name: ut.user.name,
              surname: ut.user.surname,
              score: ut.score ?? 0,
            })),
          }));
          return res.json(detailed);
        }

        const results = tests.map((t) => {
          const avg =
            t.userTests.length > 0
              ? Math.round(
                  t.userTests.reduce((sum, ut) => sum + (ut.score ?? 0), 0) /
                    t.userTests.length
                )
              : 0;
          return { testName: t.title, averageResult: avg };
        });
        return res.json(results);
      }
    } catch (err) {
      console.error("Fan bo'yicha natijalarni olishda xatolik:", err);
      res
        .status(500)
        .json({ message: "Fan bo'yicha natijalarni olishda xatolik" });
    }
  }
);
router.get(
  "/results/student/:studentId/:subjectId",
  authenticate,
  authorize(["TEACHER", "ADMIN"]),
  async (req: AuthRequest, res) => {
    try {
      const studentId = Number(req.params.studentId);
      const subjectId = Number(req.params.subjectId);

      const tests = await prisma.test.findMany({
        where: { subjectId },
        include: {
          userTests: {
            where: { userId: studentId },
            select: { score: true },
          },
        },
        orderBy: { id: "desc" },
      });

      if (!tests.length)
        return res
          .status(404)
          .json({ message: "Bu fan bo'yicha testlar topilmadi" });

      const results = tests.map((t) => ({
        testId: t.id,
        testName: t.title,
        score: t.userTests[0]?.score ?? null, 
      }));

      const validScores = results
        .map((r) => r.score)
        .filter((s) => s !== null) as number[];

      const average =
        validScores.length > 0
          ? Math.round(
              validScores.reduce((sum, s) => sum + s, 0) / validScores.length
            )
          : 0;

      return res.json({
        studentId,
        subjectId,
        averageScore: average,
        results,
      });
    } catch (err) {
      console.error("O'quvchi natijalarini olishda xatolik:", err);
      res
        .status(500)
        .json({ message: "O'quvchi natijalarini olishda xatolik yuz berdi" });
    }
  }
);


export default router;
