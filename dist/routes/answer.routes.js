"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.post("/", auth_1.authenticate, (0, auth_1.authorize)(["STUDENT"]), async (req, res) => {
    try {
        const { questionId, optionId } = req.body;
        const userId = req.user.id;
        const question = await client_1.default.question.findUnique({
            where: { id: questionId },
            include: { options: true, test: true },
        });
        if (!question) {
            return res.status(404).json({ message: "Savol topilmadi" });
        }
        const userTest = await client_1.default.userTest.findUnique({
            where: { userId_testId: { userId, testId: question.testId } },
        });
        if (userTest?.finished) {
            return res.status(400).json({ message: "Siz testni yakunlagansiz, qayta javob yubora olmaysiz" });
        }
        const answer = await client_1.default.answer.upsert({
            where: {
                studentId_questionId: { studentId: userId, questionId },
            },
            update: { optionId },
            create: { studentId: userId, questionId, optionId },
        });
        res.json({ message: "Javob qabul qilindi", answer });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Javobni yuborishda xatolik" });
    }
});
router.post("/finish/:testId", auth_1.authenticate, (0, auth_1.authorize)(["STUDENT"]), async (req, res) => {
    try {
        const testId = Number(req.params.testId);
        const userId = req.user.id;
        const questions = await client_1.default.question.findMany({
            where: { testId },
            include: { options: true },
        });
        if (!questions.length) {
            return res.status(404).json({ message: "Test topilmadi" });
        }
        const answers = await client_1.default.answer.findMany({
            where: { studentId: userId, questionId: { in: questions.map((q) => q.id) } },
        });
        let score = 0;
        for (const q of questions) {
            const correctOption = q.options.find((o) => o.isCorrect);
            const studentAnswer = answers.find((a) => a.questionId === q.id);
            if (studentAnswer && studentAnswer.optionId === correctOption?.id) {
                score++;
            }
        }
        await client_1.default.userTest.upsert({
            where: { userId_testId: { userId, testId } },
            update: { finished: true, score },
            create: { userId, testId, finished: true, score },
        });
        res.json({ message: "Test yakunlandi", score });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Testni tugatishda xatolik" });
    }
});
exports.default = router;
