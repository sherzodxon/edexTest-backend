  import { Router } from "express";
  import prisma from "../prisma/client";
  import { authenticate, authorize, AuthRequest } from "../middlewares/auth";

  const router = Router();

  /**
   * 🟢 Student → savolga javob yuboradi
   */
  router.post("/", authenticate, authorize(["STUDENT"]), async (req: AuthRequest, res) => {
    try {
      const { questionId, optionId } = req.body;
      const userId = req.user!.id;

      // Savolni topamiz
      const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: { options: true, test: true },
      });

      if (!question) {
        return res.status(404).json({ message: "❌ Savol topilmadi" });
      }

      // Student testni tugatmagan bo‘lishi kerak
      const userTest = await prisma.userTest.findUnique({
        where: { userId_testId: { userId, testId: question.testId } },
      });

      if (userTest?.finished) {
        return res.status(400).json({ message: "❌ Siz testni yakunlagansiz, qayta javob yubora olmaysiz" });
      }

      // Javobni saqlaymiz (agar mavjud bo‘lsa update qilamiz)
      const answer = await prisma.answer.upsert({
        where: {
          studentId_questionId: { studentId: userId, questionId },
        },
        update: { optionId },
        create: { studentId: userId, questionId, optionId },
      });

      res.json({ message: "✅ Javob qabul qilindi", answer });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Javobni yuborishda xatolik" });
    }
  });

  /**
   * 🟢 Student → testni tugatadi
   */
  router.post("/finish/:testId", authenticate, authorize(["STUDENT"]), async (req: AuthRequest, res) => {
    try {
      const testId = Number(req.params.testId);
      const userId = req.user!.id;

      // Savollarni olamiz
      const questions = await prisma.question.findMany({
        where: { testId },
        include: { options: true },
      });

      if (!questions.length) {
        return res.status(404).json({ message: "❌ Test topilmadi" });
      }

      // Student javoblarini olamiz
      const answers = await prisma.answer.findMany({
        where: { studentId: userId, questionId: { in: questions.map((q) => q.id) } },
      });

      // Score hisoblash
      let score = 0;
      for (const q of questions) {
        const correctOption = q.options.find((o) => o.isCorrect);
        const studentAnswer = answers.find((a) => a.questionId === q.id);
        if (studentAnswer && studentAnswer.optionId === correctOption?.id) {
          score++;
        }
      }

      // UserTest yangilash yoki yaratish
      await prisma.userTest.upsert({
        where: { userId_testId: { userId, testId } },
        update: { finished: true, score },
        create: { userId, testId, finished: true, score },
      });

      res.json({ message: "✅ Test yakunlandi", score });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Testni tugatishda xatolik" });
    }
  });

  export default router;
