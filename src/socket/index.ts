import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "*", // frontend domenini qo'yish mumkin
  },
});

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("joinTest", async (payload) => {
    try {
      const { userId, name, surname, testId, role } = payload;
      socket.data.userId = userId;
      socket.data.role = role;
      socket.data.testId = testId;
      socket.join(`test_${testId}`);
      console.log(`Socket ${socket.id} joined test_${testId} as ${role} (${userId})`);

      // Agar bu student bo'lsa — barchaga notify qilamiz
      if (role !== "teacher") {
        // agar kerak bo'lsa, DBdan to'liq user ma'lumotini olishingiz mumkin
        // const user = await prisma.user.findUnique({ where: { id: Number(userId) }, select: { id: true, name: true, surname: true } });
        io.to(`test_${testId}`).emit("userOnline", {
          userId,
          name,
          surname,
          isOnline: true,
        });
      }
    } catch (err) {
      console.error("joinTest error:", err);
    }
  });

  socket.on("disconnect", () => {
    const { userId, role, testId } = socket.data;
    console.log("🔴 Disconnected:", socket.id, userId, role, testId);

    // agar bu student bo'lsa notify
    if (role && role !== "teacher" && testId) {
      io.to(`test_${testId}`).emit("userOffline", { userId, isOnline: false });
    }
  });
});
 

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`✅ Socket server ${PORT}-portda ishlayapti`);
});
