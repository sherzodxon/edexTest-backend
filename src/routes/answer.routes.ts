import { Router } from "express";
import prisma from "../prisma/client";
import { authenticate, authorize, AuthRequest } from "../middlewares/auth";
import multer from "multer";
import { io } from "../socket/index";
import path from "path";
import fs from "fs";

const router = Router();

/** 📁 Fayllar uchun uploads papkasi tayyorlash */
const uploadDir = path.join(__dirname, "../../uploads/questions");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/** 🧰 Multer sozlamasi */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

/* ─────────────────────────────────────────────
 📌 1. TEST YARATISH (teacher)
────────────────────────────────────────────── */
router.post(
  "/",
  authenticate,
  authorize(["TEACHER"]),
  upload.any(),
  async (req: AuthRequest, res) => {
    try {
      const { title, subjectId, startTime, endTime, questions } = JSON.parse(req.body.data);
      const files = req.files as Express.Multer.File[];

      // Rasm fayllarini map qilish
      const fileMap: Record<string, string> = {};
      files.forEach((f) => {
        fileMap[f.fieldname] = `/uploads/questions/${f.filename}`;
      });

      // Test yaratish
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
              options: {
                create: q.options.map((o: any) => ({
                  text: o.text,
                  isCorrect: o.isCorrect,
                })),
              },
            })),
          },
        },
        include: { questions: { include: { options: true } } },
      });

      res.json({ message: "✅ Test yaratildi", test });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "❌ Test yaratishda xatolik" });
    }
  }
);

/* ─────────────────────────────────────────────
 📌 2. FAN BO‘YICHA TESTLAR RO‘YXATI
────────────────────────────────────────────── */
router.get(
  "/subjects/:id/tests",
  authenticate,
  authorize(["STUDENT", "TEACHER"]),
  async (req, res) => {
    try {
      const subjectId = Number(req.params.id);

      const tests = await prisma.test.findMany({
        where: { subjectId },
        include: {
          subject: { include: { grade: true } },
          questions: { select: { id: true } },
        },
      });

      if (!tests.length) return res.status(200).json([]);

      res.json(
        tests.map((t) => ({
          id: t.id,
          title: t.title,
          subject: t.subject.name,
          grade: t.subject.grade.name,
          questionCount: t.questions.length,
          startTime: t.startTime,
          endTime: t.endTime,
        }))
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Testlarni olishda xatolik" });
    }
  }
);

/* ─────────────────────────────────────────────
 📌 3. TESTNI O‘QUVCHI YOKI O‘QITUVCHI OLAYOTGANDA
────────────────────────────────────────────── */
router.get("/:id", authenticate, authorize(["STUDENT", "TEACHER"]), async (req: AuthRequest, res) => {
  try {
    const testId = Number(req.params.id);
    const userId = req.user!.id;
    const now = new Date();

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        subject: true,
        questions: {
          include: {
            options: true,
            answers: {
              where: { studentId: userId },
            },
          },
        },
      },
    });

    if (!test) return res.status(404).json({ message: "Test topilmadi" });

    const hasEnded = test.endTime && now > test.endTime;
    const hasStarted = test.startTime ? now >= test.startTime : true;

    // 🔹 Agar hali boshlanmagan bo‘lsa
    if (req.user?.role === "STUDENT" && !hasStarted) {
      return res.status(400).json({ message: "⏰ Test hali boshlanmagan" });
    }

    // 🔹 Foydalanuvchi testni yakunlaganmi?
    const userTest = await prisma.userTest.findUnique({
      where: { userId_testId: { userId, testId } },
    });

    const userFinished = !!userTest;
    const userScore = userTest?.score ?? null;

    // 🔹 Agar test yakunlangan yoki vaqti tugagan bo‘lsa — to‘liq natijalar qaytadi
    if (userFinished || hasEnded) {
      const resultData = {
        id: test.id,
        title: test.title,
        subject: test.subject.name,
        userFinished,
        userScore,
        questions: test.questions.map((q) => {
          const userAnswer = q.answers.find((a) => a.studentId === userId);
          const correctOption = q.options.find((o) => o.isCorrect);

          return {
            id: q.id,
            text: q.text,
            img: q.img ? `http://localhost:5000${q.img}` : null,
            correctOption: correctOption ? correctOption.text : null,
            selectedOption: userAnswer
              ? q.options.find((o) => o.id === userAnswer.optionId)?.text
              : null,
            isCorrect: userAnswer
              ? q.options.find((o) => o.id === userAnswer.optionId)?.isCorrect
              : false,
            options: q.options.map((o) => ({
              id: o.id,
              text: o.text,
              isCorrect: o.isCorrect, // ✅ to‘liq ko‘rsatiladi
            })),
          };
        }),
      };

      return res.json(resultData);
    }

    // 🔹 Aks holda (test davom etayotgan bo‘lsa)
    const activeData = {
      id: test.id,
      title: test.title,
      subject: test.subject.name,
      startTime: test.startTime,
      endTime: test.endTime,
      userFinished: false,
      questions: test.questions.map((q) => ({
        id: q.id,
        text: q.text,
        img: q.img ? `http://localhost:5000${q.img}` : null,
        options: q.options.map((o) => ({
          id: o.id,
          text: o.text,
          // ❌ isCorrect yuborilmaydi (test davom etayotgan paytda)
        })),
      })),
    };

    return res.json(activeData);
  } catch (err) {
    console.error("❌ Testni olishda xatolik:", err);
    res.status(500).json({ message: "Testni olishda xatolik" });
  }
});


/* ─────────────────────────────────────────────
 📌 4. TEST TOPSHIRISH (student)
────────────────────────────────────────────── */
/* ─────────────────────────────────────────────
 📌 4. TEST TOPSHIRISH (student) — TO‘G‘RI VERSIYA
────────────────────────────────────────────── */
router.post("/:id/submit", authenticate, authorize(["STUDENT"]), async (req: AuthRequest, res) => {
  try {
    const testId = Number(req.params.id);
    const userId = req.user!.id;
    const { answers } = req.body; // [{ questionId, optionId }]

    // Testni savollari bilan olish
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { questions: { include: { options: true } } },
    });
    if (!test) return res.status(404).json({ message: "Test topilmadi" });

    // Hozirgi vaqtni tekshiramiz
    const now = new Date();
    if (test.startTime && now < test.startTime)
      return res.status(400).json({ message: "Test hali boshlanmagan" });
    if (test.endTime && now > test.endTime)
      return res.status(400).json({ message: "Test muddati tugagan" });

    // Avval eski javoblarni tozalaymiz (agar qayta topshirsa)
    await prisma.answer.deleteMany({
      where: { studentId: userId, questionId: { in: test.questions.map((q) => q.id) } },
    });

    // Har bir javobni saqlaymiz
    for (const ans of answers) {
      await prisma.answer.create({
        data: {
          studentId: userId,
          questionId: ans.questionId,
          optionId: ans.optionId,
        },
      });
    }

    // Endi ballni hisoblaymiz
    let correctCount = 0;
    for (const q of test.questions) {
      const correctOption = q.options.find((o) => o.isCorrect);
      const studentAns = answers.find((a: any) => a.questionId === q.id);
      if (studentAns && studentAns.optionId === correctOption?.id) {
        correctCount++;
      }
    }

    // Foizga aylantiramiz
    const percentage = Math.round((correctCount / test.questions.length) * 100);

    // userTest jadvalida saqlaymiz
    await prisma.userTest.upsert({
      where: { userId_testId: { userId, testId } },
      update: { finished: true, score: percentage },
      create: { userId, testId, finished: true, score: percentage },
    });

    res.json({ message: "✅ Test yakunlandi", score: percentage });
  } catch (err) {
    console.error("❌ Testni yakunlashda xatolik:", err);
    res.status(500).json({ message: "Testni yakunlashda xatolik yuz berdi" });
  }
});

/* ─────────────────────────────────────────────
 📌 5. TEST NATIJALARI (teacher)
────────────────────────────────────────────── */
router.get("/:id/results", authenticate, authorize(["TEACHER"]), async (req, res) => {
  try {
    const testId = Number(req.params.id);

    const results = await prisma.userTest.findMany({
      where: { testId },
      include: {
        user: true,
        test: {
          include: {
            questions: {
              include: { options: true, answers: true },
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

/* ─────────────────────────────────────────────
 📌 6. FAOL TALABALAR (socket orqali)
────────────────────────────────────────────── */
router.get(
  "/:id/active-students",
  authenticate,
  authorize(["TEACHER"]),
  async (req: AuthRequest, res) => {
    try {
      const testId = Number(req.params.id);
      if (isNaN(testId)) return res.status(400).json({ message: "Noto‘g‘ri test ID" });

      const room = io.sockets.adapter.rooms.get(`test_${testId}`);
      if (!room || room.size === 0) return res.json({ active: [] });

      const socketIds = Array.from(room);
      const connectedUsers: number[] = [];

      socketIds.forEach((socketId) => {
        const socket = io.sockets.sockets.get(socketId);
        if (socket && socket.data?.userId) connectedUsers.push(socket.data.userId);
      });

      const students = await prisma.user.findMany({
        where: { id: { in: connectedUsers } },
        select: { id: true, name: true, surname: true },
      });

      res.json({ active: students });
    } catch (err) {
      console.error("❌ Faol talabalarni olishda xatolik:", err);
      res.status(500).json({ message: "Faol talabalarni olishda xatolik" });
    }
  }
);

/* ======================================
   📘 ADMIN: barcha testlarni olish
====================================== */
router.get("/", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const tests = await prisma.test.findMany({
      include: {
        subject: true,
        questions: {
          include: { options: true },
        },
      },
      orderBy: { id: "desc" },
    });
    res.json(tests);
  } catch (err) {
    console.error("Testlarni olishda xatolik:", err);
    res.status(500).json({ message: "Testlarni olishda xatolik yuz berdi" });
  }
});

/* ======================================
   📘 ADMIN: testni o‘chirish
====================================== */
router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Avval test bor-yo‘qligini tekshiramiz
    const test = await prisma.test.findUnique({ where: { id } });
    if (!test) {
      return res.status(404).json({ message: "Test topilmadi" });
    }

    // Tegishli savollar, variantlar va javoblarni o‘chiramiz
    await prisma.answer.deleteMany({
      where: { question: { testId: id } },
    });
    await prisma.option.deleteMany({
      where: { question: { testId: id } },
    });
    await prisma.question.deleteMany({
      where: { testId: id },
    });
    await prisma.userTest.deleteMany({
      where: { testId: id },
    });

    // Eng so‘ng testni o‘chiramiz
    await prisma.test.delete({ where: { id } });

    res.json({ message: "Test muvaffaqiyatli o‘chirildi" });
  } catch (err) {
    console.error("Testni o‘chirishda xatolik:", err);
    res.status(500).json({ message: "Testni o‘chirishda xatolik yuz berdi" });
  }
});

/* ======================================
   🎓 STUDENT: testni olish (va yakunlangandan keyin ko‘rsatish)
====================================== */
router.get("/:id", authenticate, authorize(["STUDENT", "ADMIN"]), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.id;

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!test) return res.status(404).json({ message: "Test topilmadi" });

    // O‘quvchi bu testni tugatganmi?
    const userTest = await prisma.userTest.findUnique({
      where: { userId_testId: { userId, testId: id } },
    });

    // Agar tugallanmagan bo‘lsa — isCorrect maydoni olib tashlanadi
    if (!userTest?.finished) {
      const safeTest = {
        ...test,
        questions: test.questions.map((q) => ({
          ...q,
          options: q.options.map(({ isCorrect, ...rest }) => rest),
        })),
      };
      return res.json(safeTest);
    }

    // Tugallangan bo‘lsa — isCorrect bilan qaytariladi
    res.json({
      ...test,
      userTest,
    });
  } catch (err) {
    console.error("Testni olishda xatolik:", err);
    res.status(500).json({ message: "Testni olishda xatolik yuz berdi" });
  }
});


export default router;
