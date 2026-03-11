import { Router } from "express";
import prisma from "../prisma/client";
import { authenticate, authorize, AuthRequest } from "../middlewares/auth";
import { upload } from "../middlewares/upload";

const router = Router();

router.post("/", authenticate, authorize(["TEACHER"]), upload.single("image"), async (req: AuthRequest, res) => {
  try {
    const { text, options } = req.body;
    const parsedOptions = JSON.parse(options);

    const question = await prisma.question.create({
      data: {
        text,
        img: req.file ? `/uploads/questions/${req.file.filename}` : null,
        teacherId: req.user!.id,
        isBank: true, 
        options: {
          create: parsedOptions.map((o: any) => ({
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        },
      },
    });
    res.json({ message: "Savol bankka saqlandi", question });
  } catch (err) {
    res.status(500).json({ message: "Xatolik yuz berdi" });
  }
});

router.get("/", authenticate, authorize(["TEACHER"]), async (req: AuthRequest, res) => {
  try {
    const questions = await prisma.question.findMany({
      where: { teacherId: req.user!.id, isBank: true },
      include: { options: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: "Bankni yuklashda xatolik" });
  }
});
router.delete("/:id", authenticate, authorize(["TEACHER"]), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const question = await prisma.question.findFirst({
      where: { 
        id: Number(id), 
        teacherId: req.user!.id 
      }
    });

    if (!question) {
      return res.status(404).json({ message: "Savol topilmadi yoki sizga tegishli emas" });
    }

    await prisma.$transaction([
      prisma.option.deleteMany({ where: { questionId: Number(id) } }),
      prisma.question.delete({ where: { id: Number(id) } })
    ]);

    res.json({ message: "Savol bankdan o'chirildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "O'chirishda xatolik yuz berdi" });
  }
});
export default router;