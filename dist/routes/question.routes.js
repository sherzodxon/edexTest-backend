"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload");
const router = (0, express_1.Router)();
router.post("/:testId", auth_1.authenticate, (0, auth_1.authorize)(["TEACHER"]), upload_1.upload.single("image"), async (req, res) => {
    try {
        const { text, options } = req.body;
        const { testId } = req.params;
        const parsedOptions = JSON.parse(options);
        const question = await client_1.default.question.create({
            data: {
                text,
                img: req.file ? `/uploads/questions/${req.file.filename}` : null,
                testId: Number(testId),
                options: {
                    create: parsedOptions.map((o) => ({
                        text: o.text,
                        isCorrect: o.isCorrect,
                    })),
                },
            },
            include: { options: true },
        });
        res.json({ message: "Savol qo'shildi", question });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Savol yaratishda xatolik" });
    }
});
router.put("/:id", auth_1.authenticate, (0, auth_1.authorize)(["TEACHER"]), upload_1.upload.single("image"), async (req, res) => {
    try {
        const { id } = req.params;
        const { text, options } = req.body;
        const parsedOptions = JSON.parse(options);
        const question = await client_1.default.question.update({
            where: { id: Number(id) },
            data: {
                text,
                img: req.file ? `/uploads/questions/${req.file.filename}` : undefined,
                options: {
                    deleteMany: {},
                    create: parsedOptions.map((o) => ({
                        text: o.text,
                        isCorrect: o.isCorrect,
                    })),
                },
            },
            include: { options: true },
        });
        res.json({ message: "Savol yangilandi", question });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Savolni yangilashda xatolik" });
    }
});
exports.default = router;
