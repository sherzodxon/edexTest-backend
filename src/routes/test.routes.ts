import { Router } from "express";
import prisma from "../prisma/client";
import { authenticate, authorize, AuthRequest } from "../middlewares/auth";
import { upload } from "../middlewares/upload";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize(["TEACHER"]),
  upload.array("images"), 
  async (req: AuthRequest, res) => {
    try {
      const { title, subject, gradeId, questions } = req.body;

      const parsedQuestions = JSON.parse(questions);

      const test = await prisma.test.create({
        data: {
          title,
          subject,
          gradeId: Number(gradeId),
          teacherId: req.user!.id,
          questions: {
            create: parsedQuestions.map((q: any, i: number) => ({
              text: q.text,
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

      res.json({ message: "Test yaratildi", test });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Test yaratishda xatolik" });
    }
  }
);


router.get("/:id", authenticate, authorize(["STUDENT", "TEACHER"]), async (req, res) => {
  try {
    const testId = Number(req.params.id);

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { questions: { include: { options: true } } },
    });

    if (!test) return res.status(404).json({ message: "Test topilmadi" });

    res.json(test);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Testni olishda xatolik" });
  }
});

export default router;
