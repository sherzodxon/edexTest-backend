import {
  Router
} from "express";
import prisma from "../prisma/client";
import {
  authenticate,
  authorize
} from "../middlewares/auth";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        students: {
          select: {
            totalPoints: true
          }
        },
        _count: {
          select: {
            students: true
          }
        }
      }
    });
    const groupsWithPoints = groups.map(group => {
      const totalGroupPoints = group.students.reduce((sum, s) => sum + (s.totalPoints || 0), 0);
      return {
        ...group,
        totalGroupPoints
      };
    });

    res.json(groupsWithPoints);
  } catch (err) {
    res.status(500).json({
      message: "Xatolik yuz berdi"
    });
  }
});

router.post("/", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const {
      name
    } = req.body;
    const group = await prisma.group.create({
      data: {
        name,
        totalPoints: 0
      }
    });
    res.json(group);
  } catch (err) {
    res.status(500).json({
      message: "Guruh yaratishda xatolik"
    });
  }
});

router.delete("/:id", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const {
      id
    } = req.params;

    const group = await prisma.group.findUnique({
      where: {
        id: Number(id)
      }
    });
    if (!group) return res.status(404).json({
      message: "Guruh topilmadi"
    });

    await prisma.group.delete({
      where: {
        id: Number(id)
      }
    });

    res.json({
      message: "Guruh muvaffaqiyatli o'chirildi"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Guruhni o'chirishda xatolik yuz berdi. Balki guruhda o'quvchilar bordir?"
    });
  }
});
router.post("/:id/add-students", authenticate, authorize(["ADMIN"]), async (req, res) => {
  const {
    id
  } = req.params; 
  const {
    studentIds
  } = req.body; 

  try {
    await prisma.user.updateMany({
      where: {
        id: {
          in: studentIds.map(Number)
        }
      },
      data: {
        groupId: Number(id)
      }
    });
    res.json({
      message: "O'quvchilar muvaffaqiyatli qo'shildi"
    });
  } catch (err) {
    res.status(500).json({
      message: "Xatolik yuz berdi"
    });
  }
});

router.get("/:id/students",  async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: {
        groupId: Number(req.params.id)
      },
      include: {
        grade: true
      } 
    });
    res.json(students);
  } catch (err) {
    res.status(500).json({
      message: "O'quvchilarni olishda xatolik"
    });
  }
});

router.post("/remove-student", authenticate, authorize(["ADMIN"]), async (req, res) => {
  const {
    studentId
  } = req.body;
  try {
    await prisma.user.update({
      where: {
        id: Number(studentId)
      },
      data: {
        groupId: null
      } 
    });
    res.json({
      message: "O'quvchi guruhdan chiqarildi"
    });
  } catch (err) {
    res.status(500).json({
      message: "Xatolik yuz berdi"
    });
  }
});

export default router;