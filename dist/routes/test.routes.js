"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middlewares/auth");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
const uploadDir = path_1.default.join(__dirname, "../../uploads/questions");
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = (0, multer_1.default)({ storage });
router.post("/", auth_1.authenticate, (0, auth_1.authorize)(["TEACHER"]), upload.any(), async (req, res) => {
    try {
        const { title, subjectId, questions } = JSON.parse(req.body.data);
        const files = req.files;
        const fileMap = {};
        files.forEach((f) => {
            fileMap[f.fieldname] = `/uploads/questions/${f.filename}`;
        });
        const test = await client_1.default.test.create({
            data: {
                title,
                subjectId: Number(subjectId),
                teacherId: req.user.id,
                questions: {
                    create: questions.map((q) => ({
                        text: q.text,
                        img: q.imgKey && fileMap[q.imgKey] ? fileMap[q.imgKey] : null,
                        options: {
                            create: q.options.map((o) => ({
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Test yaratishda xatolik" });
    }
});
router.get("/:id", auth_1.authenticate, (0, auth_1.authorize)(["STUDENT", "TEACHER"]), async (req, res) => {
    try {
        const testId = Number(req.params.id);
        const test = await client_1.default.test.findUnique({
            where: { id: testId },
            include: { questions: { include: { answers: true } }, subject: true },
        });
        if (!test)
            return res.status(404).json({ message: "Test topilmadi" });
        res.json(test);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Testni olishda xatolik" });
    }
});
router.get("/:id/results", auth_1.authenticate, (0, auth_1.authorize)(["TEACHER"]), async (req, res) => {
    try {
        const testId = Number(req.params.id);
        const results = await client_1.default.userTest.findMany({
            where: { testId },
            include: { user: true },
        });
        res.json(results);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Natijalarni olishda xatolik" });
    }
});
router.get("/subjects/:id/tests", auth_1.authenticate, (0, auth_1.authorize)(["STUDENT", "TEACHER"]), async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        const tests = await client_1.default.test.findMany({
            where: { subjectId },
            include: {
                subject: { include: { grade: true } },
                questions: { select: { id: true } }, // faqat savollar soni uchun
            },
        });
        if (!tests.length) {
            return res.status(404).json({ message: "Bu fanga test topilmadi" });
        }
        res.json(tests.map((t) => ({
            id: t.id,
            title: t.title,
            subject: t.subject.name,
            grade: t.subject.grade.name,
            questionCount: t.questions.length,
        })));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Testlarni olishda xatolik" });
    }
});
exports.default = router;
