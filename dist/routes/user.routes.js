"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
/**
 * 🟢 Admin → foydalanuvchi yaratish
 */
router.post("/", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), async (req, res) => {
    try {
        const { name, surname, username, password, role, gradeId, teacherGradeIds, teacherSubjectIds } = req.body;
        if (!name || !surname || !username || !password || !role) {
            return res.status(400).json({ message: "ism, familya, username, parol va role kiritilishi kerak" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await client_1.default.user.create({
            data: {
                name,
                surname,
                username,
                password: hashedPassword,
                role,
                ...(role === "STUDENT" && gradeId
                    ? { grade: { connect: { id: gradeId } } }
                    : {}),
                ...(role === "TEACHER"
                    ? {
                        ...(Array.isArray(teacherGradeIds) && teacherGradeIds.length > 0
                            ? { teacherGrades: { connect: teacherGradeIds.map((id) => ({ id })) } }
                            : {}),
                        ...(Array.isArray(teacherSubjectIds) && teacherSubjectIds.length > 0
                            ? { teacherSubjects: { connect: teacherSubjectIds.map((id) => ({ id })) } }
                            : {}),
                    }
                    : {}),
            },
            include: { grade: true, teacherGrades: true, teacherSubjects: true },
        });
        res.json({ message: "Foydalanuvchi yaratildi", user });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server xatosi" });
    }
});
/**
 * 🟢 Barcha foydalanuvchilar
 */
router.get("/", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), async (req, res) => {
    try {
        const users = await client_1.default.user.findMany({
            include: { grade: true, teacherGrades: true, teacherSubjects: true },
        });
        res.json(users);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server xatosi" });
    }
});
/**
 * 🟢 Foydalanuvchini yangilash
 */
router.put("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, surname, username, role, gradeId, teacherGradeIds, teacherSubjectIds } = req.body;
        const user = await client_1.default.user.update({
            where: { id: Number(id) },
            data: {
                name,
                surname,
                username,
                role,
                ...(role === "STUDENT" && gradeId
                    ? { grade: { connect: { id: gradeId } } }
                    : { grade: { disconnect: true } }),
                ...(role === "TEACHER"
                    ? {
                        teacherGrades: Array.isArray(teacherGradeIds)
                            ? { set: teacherGradeIds.map((id) => ({ id })) }
                            : { set: [] },
                        teacherSubjects: Array.isArray(teacherSubjectIds)
                            ? { set: teacherSubjectIds.map((id) => ({ id })) }
                            : { set: [] },
                    }
                    : { teacherGrades: { set: [] }, teacherSubjects: { set: [] } }),
            },
            include: { grade: true, teacherGrades: true, teacherSubjects: true },
        });
        res.json({ message: "✅ Foydalanuvchi yangilandi", user });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server xatosi" });
    }
});
/**
 * 🟢 Foydalanuvchini o‘chirish
 */
router.delete("/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN"]), async (req, res) => {
    try {
        const { id } = req.params;
        await client_1.default.user.delete({ where: { id: Number(id) } });
        res.json({ message: "✅ Foydalanuvchi o‘chirildi" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server xatosi" });
    }
});
exports.default = router;
