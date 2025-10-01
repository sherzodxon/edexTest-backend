import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prisma/client";
import { authenticate, authorize, allowFirstAdmin, AuthRequest } from "../middlewares/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

/**
 * 🟢 Foydalanuvchi ro‘yxatdan o‘tishi
 * - Birinchi ADMIN cheklovsiz yaratiladi
 * - Keyingi foydalanuvchilarni faqat ADMIN qo‘shadi
 */
router.post("/register", authenticate, allowFirstAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, surname, username, password, role, gradeId } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ message: "❌ Majburiy maydonlar to‘ldirilishi kerak" });
    }

    // Username unikal bo‘lishi kerak
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: "❌ Bu username allaqachon olingan" });
    }

    // Parolni hashlaymiz
    const hashedPassword = await bcrypt.hash(password, 10);

    // 👤 Yangi foydalanuvchini yaratamiz
    const newUser = await prisma.user.create({
      data: {
        name,
        surname,
        username,
        password: hashedPassword,
        role,
        gradeId: role === "STUDENT" ? gradeId : null, // faqat studentda grade bo‘ladi
      },
    });

    res.json({ message: "✅ Foydalanuvchi yaratildi", user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

/**
 * 🟢 Login
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(400).json({ message: "❌ Foydalanuvchi topilmadi" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "❌ Parol noto‘g‘ri" });

    // JWT token yaratamiz
    const token = jwt.sign(
      { id: user.id, role: user.role, gradeId: user.gradeId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ message: "✅ Muvaffaqiyatli login qilindi", token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

/**
 * 🟢 Profil ma'lumotlarini olish
 */
router.get("/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { grade: true },
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

export default router;
