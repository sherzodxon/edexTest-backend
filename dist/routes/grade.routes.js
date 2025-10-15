"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.post("/", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: "Sinf nomi kerak" });
        }
        const existing = await client_1.default.grade.findUnique({ where: { name } });
        if (existing) {
            return res.status(400).json({ message: "Bu sinf allaqachon mavjud" });
        }
        const grade = await client_1.default.grade.create({
            data: { name },
        });
        res.json({ message: "Sinf yaratildi", grade });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Sinf yaratishda xatolik" });
    }
});
router.get("/", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), async (req, res) => {
    try {
        const grades = await client_1.default.grade.findMany({
            include: {
                students: true,
                teachers: true,
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(grades);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Sinflarni olishda xatolik" });
    }
});
router.put("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const grade = await client_1.default.grade.update({
            where: { id: Number(id) },
            data: { name },
        });
        res.json({ message: "Sinf  yangilandi", grade });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Sinf yangilashda xatolik" });
    }
});
router.delete("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), async (req, res) => {
    try {
        const { id } = req.params;
        await client_1.default.grade.delete({ where: { id: Number(id) } });
        res.json({ message: "Sinf o'chirildi" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Sinf o'chirishda xatolik" });
    }
});
router.post("/:id/add-teacher", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { teacherId } = req.body;
        const teacher = await client_1.default.user.findUnique({ where: { id: Number(teacherId) } });
        if (!teacher || teacher.role !== "TEACHER") {
            return res.status(400).json({ message: "Bunday o'qituvchi mavjud emas" });
        }
        const grade = await client_1.default.grade.update({
            where: { id: Number(id) },
            data: {
                teachers: {
                    connect: { id: Number(teacherId) },
                },
            },
            include: { teachers: true },
        });
        res.json({ message: "O'qituvchi sinfga biriktirildi", grade });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "O'qituvchi qo'shishda xatolik" });
    }
});
router.post("/:id/remove-teacher", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { teacherId } = req.body;
        const grade = await client_1.default.grade.update({
            where: { id: Number(id) },
            data: {
                teachers: {
                    disconnect: { id: Number(teacherId) },
                },
            },
            include: { teachers: true },
        });
        res.json({ message: "O'qituvchu sinf'dan olib tashlandi", grade });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "O'qituvchi olib tashlashda xatolik" });
    }
});
exports.default = router;
