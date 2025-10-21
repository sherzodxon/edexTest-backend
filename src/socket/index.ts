import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "*", // yoki frontend domenini yozish mumkin
  },
});

io.on("connection", (socket) => {
  console.log("🟢 Yangi foydalanuvchi ulandi:", socket.id);

  socket.on("joinTest", ({ userId, testId }) => {
    socket.data.userId = userId; // foydalanuvchini socketga biriktiramiz
    socket.join(`test_${testId}`);
    console.log(`👤 User ${userId} test_${testId} xonasiga qo‘shildi`);

    io.to(`test_${testId}`).emit("userOnline", { userId, online: true });
  });

  socket.on("leaveTest", ({ userId, testId }) => {
    socket.leave(`test_${testId}`);
    console.log(`🚪 User ${userId} test_${testId} dan chiqdi`);

    io.to(`test_${testId}`).emit("userOnline", { userId, online: false });
  });

  socket.on("disconnect", () => {
    console.log(`🔴 User socket uzildi: ${socket.id}`);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`✅ Socket server ${PORT}-portda ishlayapti`);
});
