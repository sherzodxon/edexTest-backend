import {Router} from "express";
import prisma from "../prisma/client";
import {authenticate, authorize} from "../middlewares/auth";

const router = Router();

/**
 * 🟢 Subject yaratish (faqat ADMIN)
 */
router.post("/", authenticate, authorize(["ADMIN"]), async(req, res) => {
    try {
        const {name, gradeId} = req.body;

        if (!name || !gradeId) {
            return res
                .status(400)
                .json({message: "❌ name va gradeId kiritilishi shart"});
        }

        const subject = await prisma
            .subject
            .create({
                data: {
                    name,
                    gradeId: Number(gradeId)
                },
                include: {
                    grade: true
                }
            });

        res.json({message: "✅ Subject yaratildi", subject});
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .json({message: "Server xatosi"});
    }
});

/**
 * 🟢 Barcha subjectlarni olish
 */
router.get("/", authenticate, async(req, res) => {
    try {
        const subjects = await prisma
            .subject
            .findMany({
                include: {
                    grade: true
                }
            });
        res.json(subjects);
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .json({message: "Server xatosi"});
    }
});

/**
 * 🟢 Bitta grade uchun subjectlarni olish
 */
router.get("/grade/:gradeId", authenticate, async(req, res) => {
    try {
        const gradeId = Number(req.params.gradeId);
        const subjects = await prisma
            .subject
            .findMany({where: {
                    gradeId
                }});
        res.json(subjects);
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .json({message: "Server xatosi"});
    }
});
// 🟡 O'qituvchiga biriktirilgan fanlarni olish
router.get("/my", authenticate, authorize(["TEACHER"]), async(req : any, res) => {
    try {
        const teacherId = req.user.id;

        const subjects = await prisma
            .subject
            .findMany({
                where: {
                    teachers: {
                        some: {
                            id: teacherId
                        }
                    }
                },
                include: {
                    grade: true
                }
            });

        res.json(subjects);
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .json({message: "O'qituvchining fanlarini olishda xatolik"});
    }
});
router.put("/:id", authenticate, authorize(["ADMIN"]), async(req, res) => {
    const {id} = req.params;
    const updated = await prisma
        .subject
        .update({
            where: {
                id: Number(id)
            },
            data: {
                name: req.body.name
            }
        });
    res.json(updated);
});
router.delete("/:id", authenticate, authorize(["ADMIN"]), async(req, res) => {
    const {id} = req.params;
    await prisma
        .subject
        .delete({
            where: {
                id: Number(id)
            }
        });
    res.json({success: true});
});
router.get("/:id/tests", authenticate, authorize(["STUDENT", "TEACHER"]), async(req, res) => {
    try {
        const subjectId = Number(req.params.id);

        const subject = await prisma
            .subject
            .findUnique({
                where: {
                    id: subjectId
                },
                include: {
                    grade: true,
                    tests: {
                        orderBy: {
                            createdAt: "desc"
                        },
                        include: {
                            questions: true
                        }
                    }
                }
            });

        if (!subject) {
            return res
                .status(404)
                .json({message: "Fan topilmadi"});
        }

        res.json(subject);
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .json({message: "Fan ma'lumotlarini olishda xatolik"});
    }
});
export default router;
