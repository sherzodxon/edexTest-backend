import { Router } from "express";
import prisma from "../prisma/client";
import { authenticate, authorize, AuthRequest } from "../middlewares/auth";
import { upload } from "../middlewares/upload";

const router = Router();

router.post(
  "/:testId",
  authenticate,
  authorize(["TEACHER"]),
  upload.single("image"), 
  async (req: AuthRequest, res) => {
    try {
      const { text, options } = req.body;
      const { testId } = req.params;

      const parsedOptions = JSON.parse(options);

      const question = await prisma.question.create({
        data: {
          text,
          img: req.file ? `/uploads/questions/${req.file.filename}` : null,
          testId: Number(testId),
          options: {
            create: parsedOptions.map((o: any) => ({
              text: o.text,
              isCorrect: o.isCorrect,
            })),
          },
        },
        include: { options: true },
      });

      res.json({ message: "Savol qo'shildi", question });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Savol yaratishda xatolik" });
    }
  }
);


router.put(
  "/:id",
  authenticate,
  authorize(["TEACHER"]),
  upload.single("image"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { text, options } = req.body;
      const parsedOptions = JSON.parse(options);

      const question = await prisma.question.update({
        where: { id: Number(id) },
        data: {
          text,
          img: req.file ? `/uploads/questions/${req.file.filename}` : undefined,
          options: {
            deleteMany: {}, 
            create: parsedOptions.map((o: any) => ({
              text: o.text,
              isCorrect: o.isCorrect,
            })),
          },
        },
        include: { options: true },
      });

      res.json({ message: "Savol yangilandi", question });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Savolni yangilashda xatolik" });
    }
  }
);

export default router;
