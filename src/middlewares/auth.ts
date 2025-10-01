import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export interface AuthRequest extends Request {
  user?: { id: number; role: string; gradeId?: number };
}

// 🔑 JWT tokenni tekshiradi
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// 🔑 Faqat muayyan rollarni ruxsat berish
export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};

// 🔑 Birinchi adminni qo‘shishga ruxsat beradi
export const allowFirstAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.body.role !== "ADMIN") return authorize(["ADMIN"])(req, res, next);

  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) return authorize(["ADMIN"])(req, res, next);

  next(); // birinchi admin bo‘lsa ruxsat beriladi
};
