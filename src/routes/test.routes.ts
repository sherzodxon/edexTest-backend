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

     if (!tests.length) {
  return res.status(200).json([]);
}

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

router.get("/:id", authenticate, authorize(["STUDENT", "TEACHER"]), async (req:AuthRequest, res) => {
  try {
    const testId = Number(req.params.id);
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        questions: {
          include: {
            options: true,
            answers: {
              where: { studentId: req.user?.id },
            },
          },
        },
        subject: true,
      },
    });

    if (!test) return res.status(404).json({ message: "Test topilmadi" });

    const now = new Date();

    if (req.user?.role === "STUDENT") {
      // Test hali boshlanmagan
      if (test.startTime && now < test.startTime) {
        return res.status(400).json({ message: "⏰ Test hali boshlanmagan" });
      }

      // Test tugagan bo‘lsa — natija qaytariladi
      if (test.endTime && now > test.endTime) {
        const userTest = await prisma.userTest.findUnique({
          where: { userId_testId: { userId: req.user.id, testId } },
          include: { test: true },
        });

        if (!userTest) {
          return res.status(400).json({ message: "❌ Siz bu testni topshirmagansiz" });
        }

        // Foydalanuvchining javoblari bilan natija
        const resultData = {
          testId: test.id,
          title: test.title,
          score: userTest.score,
          questions: test.questions.map((q) => {
            const userAnswer = q.answers.find((a) => a.studentId === req.user!.id);
            const correctOption = q.options.find((o) => o.isCorrect);
            return {
              id: q.id,
              text: q.text,
              img: q.img,
              correctOption: correctOption?.text || null,
              selectedOption: userAnswer
                ? q.options.find((o) => o.id === userAnswer.optionId)?.text
                : null,
              isCorrect: userAnswer
                ? q.options.find((o) => o.id === userAnswer.optionId)?.isCorrect
                : false,
            };
          }),
        };

        return res.json(resultData);
      }
    }

    // Test davom etmoqda — testni qaytaramiz
    res.json(test);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Testni olishda xatolik" });
  }
});

/* ─────────────────────────────────────────────
 📌 4. TEST TOPSHIRISH (student)
────────────────────────────────────────────── */
router.post("/:id/submit", authenticate, authorize(["STUDENT"]), async (req: AuthRequest, res) => {
  try {
    const testId = Number(req.params.id);
    const { answers } = req.body; // [{ questionId, optionId }]

    // Test mavjudligini tekshirish
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { questions: { include: { options: true } } },
    });
    if (!test) return res.status(404).json({ message: "Test topilmadi" });

    // Vaqt cheklovi
    const now = new Date();
    if (test.startTime && now < test.startTime)
      return res.status(400).json({ message: "Test hali boshlanmagan" });
    if (test.endTime && now > test.endTime)
      return res.status(400).json({ message: "Test muddati tugagan" });

    // Har bir javobni saqlash
    let score = 0;
    for (const ans of answers) {
      const question = test.questions.find((q) => q.id === ans.questionId);
      if (!question) continue;

      const selectedOption = question.options.find((o) => o.id === ans.optionId);
      if (selectedOption?.isCorrect) score++;

      await prisma.answer.create({
        data: {
          studentId: req.user!.id,
          questionId: ans.questionId,
          optionId: ans.optionId,
        },
      });
    }

    // UserTest yozuvi yaratish yoki yangilash
    await prisma.userTest.upsert({
      where: { userId_testId: { userId: req.user!.id, testId } },
      update: { finished: true, score },
      create: { userId: req.user!.id, testId, finished: true, score },
    });

    res.json({ message: "✅ Javoblar topshirildi", score });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Javoblarni yuborishda xatolik" });
  }
});

/* ─────────────────────────────────────────────
 📌 5. TEST BO‘YICHA BARCHA NATIJALAR (teacher)
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
router.get(
  "/:id/active-students",
  authenticate,
  authorize(["TEACHER"]),
  async (req: AuthRequest, res) => {
    try {
      const testId = Number(req.params.id);

      if (isNaN(testId)) {
        return res.status(400).json({ message: "Noto‘g‘ri test ID" });
      }

      // test_{id} xonasidagi socketlarni olish
      const room = io.sockets.adapter.rooms.get(`test_${testId}`);

      if (!room || room.size === 0) {
        return res.json({ active: [] });
      }

      const socketIds = Array.from(room);

      // 🔹 Agar socket bilan foydalanuvchi bog‘langan bo‘lsa (join paytida biz saqlaymiz)
      // misol uchun: socket.data.userId
      const connectedUsers: number[] = [];

      socketIds.forEach((socketId) => {
        const socket = io.sockets.sockets.get(socketId);
        if (socket && socket.data?.userId) {
          connectedUsers.push(socket.data.userId);
        }
      });

      // 🔹 Endi bu userId'lar orqali o‘quvchilarni olish
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

export default router;
