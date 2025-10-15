"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
router.post("/register", auth_1.authenticate, auth_1.allowFirstAdmin, async (req, res) => {
    try {
        const { name, surname, username, password, role, gradeId } = req.body;
        if (!username || !password || !role) {
            return res.status(400).json({ message: "Majburiy maydonlar to'ldirilishi kerak" });
        }
        const existingUser = await client_1.default.user.findUnique({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ message: "Bu username allaqachon olingan" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const newUser = await client_1.default.user.create({
            data: {
                name,
                surname,
                username,
                password: hashedPassword,
                role,
                gradeId: role === "STUDENT" ? gradeId : null,
            },
        });
        res.json({ message: "Foydalanuvchi yaratildi", user: newUser });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server xatosi" });
    }
});
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await client_1.default.user.findUnique({ where: { username } });
        if (!user)
            return res.status(400).json({ message: "Foydalanuvchi topilmadi" });
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid)
            return res.status(400).json({ message: "Parol noto'g'ri" });
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role, gradeId: user.gradeId }, JWT_SECRET, { expiresIn: "7d" });
        res.json({ message: "Muvaffaqiyatli login qilindi", token, user });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server xatosi" });
    }
});
router.get("/me", auth_1.authenticate, async (req, res) => {
    try {
        const user = await client_1.default.user.findUnique({
            where: { id: req.user.id },
            include: { grade: true },
        });
        res.json(user);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server xatosi" });
    }
});
exports.default = router;
