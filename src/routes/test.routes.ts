import { Router } from "express";
import prisma from "../prisma/client";
import { authenticate, authorize, AuthRequest } from "../middlewares/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();


const uploadDir = path.join(__dirname, "../../uploads/questions");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage })


router.post(
  "/",
  authenticate,
  authorize(["TEACHER"]),
  upload.any(), 
  async (req: AuthRequest, res) => {
    try {
      const { title, subjectId, questions } = JSON.parse(req.body.data);
      const files = req.files as Express.Multer.File[];

      const fileMap: Record<string, string> = {};
      files.forEach((f) => {
        fileMap[f.fieldname] = `/uploads/questions/${f.filename}`;
      });

      const test = await prisma.test.create({
        data: {
          title,
          subjectId: Number(subjectId),
          teacherId: req.user!.id,
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
      include: { questions: { include: { answers: true } }, subject: true },
    });

    if (!test) return res.status(404).json({ message: "Test topilmadi" });

    res.json(test);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Testni olishda xatolik" });
  }
});

router.get("/:id/results", authenticate, authorize(["TEACHER"]), async (req, res) => {
  try {
    const testId = Number(req.params.id);

    const results = await prisma.userTest.findMany({
      where: { testId },
      include: { user: true },
    });

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Natijalarni olishda xatolik" });
  }
});

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
          questions: { select: { id: true } }, // faqat savollar soni uchun
        },
      });

      if (!tests.length) {
        return res.status(404).json({ message: "Bu fanga test topilmadi" });
      }

      res.json(
        tests.map((t) => ({
          id: t.id,
          title: t.title,
          subject: t.subject.name,
          grade: t.subject.grade.name,
          questionCount: t.questions.length,
        }))
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Testlarni olishda xatolik" });
    }
  }
);

export default router;
