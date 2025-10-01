import { Server } from "socket.io";
import prisma from "../prisma/client";

export default function initSocket(server: any) {
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("Client connected", socket.id);

    socket.on("joinTeacherRoom", (teacherId: number) => {
      socket.join(`teacher_${teacherId}`);
      console.log(`Teacher ${teacherId} roomiga qo‘shildi`);
    });

    socket.on("testFinished", async ({ userId, testId }) => {
      try {
        const result = await prisma.userTest.findUnique({
          where: { userId_testId: { userId, testId } },
          include: { user: true, test: { include: { grade: true } } },
        });

        if (result) {
          // Testni yaratgan teacher ID sini olish
          const test = await prisma.test.findUnique({
            where: { id: testId },
            select: { teacherId: true },
          });

          if (test?.teacherId) {
            io.to(`teacher_${test.teacherId}`).emit("resultUpdated", result);
            console.log(
              `Natija teacher_${test.teacherId} roomiga yuborildi`
            );
          }
        }
      } catch (err) {
        console.error("testFinished socket error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
    });
  });

  return io;
}
