"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
/**
 * 🟢 Subject yaratish (faqat ADMIN)
 */
router.post("/", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), async (req, res) => {
    try {
        const { name, gradeId } = req.body;
        if (!name || !gradeId) {
            return res.status(400).json({ message: "❌ name va gradeId kiritilishi shart" });
        }
        const subject = await client_1.default.subject.create({
            data: {
                name,
                gradeId,
            },
            include: { grade: true },
        });
        res.json({ message: "✅ Subject yaratildi", subject });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server xatosi" });
    }
});
/**
 * 🟢 Barcha subjectlarni olish
 */
router.get("/", auth_1.authenticate, async (req, res) => {
    try {
        const subjects = await client_1.default.subject.findMany({
            include: { grade: true },
        });
        res.json(subjects);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server xatosi" });
    }
});
/**
 * 🟢 Bitta grade uchun subjectlarni olish
 */
router.get("/grade/:gradeId", auth_1.authenticate, async (req, res) => {
    try {
        const gradeId = Number(req.params.gradeId);
        const subjects = await client_1.default.subject.findMany({
            where: { gradeId },
        });
        res.json(subjects);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server xatosi" });
    }
});
exports.default = router;
