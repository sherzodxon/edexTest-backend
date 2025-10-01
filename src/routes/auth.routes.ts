import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prisma/client";
import { authenticate, authorize, allowFirstAdmin, AuthRequest } from "../middlewares/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";


router.post("/register", authenticate, allowFirstAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, surname, username, password, role, gradeId } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ message: "Majburiy maydonlar to'ldirilishi kerak" });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: "Bu username allaqachon olingan" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});


router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(400).json({ message: "Foydalanuvchi topilmadi" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Parol noto'g'ri" });

   
    const token = jwt.sign(
      { id: user.id, role: user.role, gradeId: user.gradeId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ message: "Muvaffaqiyatli login qilindi", token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});


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
