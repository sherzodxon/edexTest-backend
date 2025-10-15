import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // yoki front URL ni yozasiz
  },
});

io.on("connection", (socket) => {
  console.log("Yangi foydalanuvchi ulandi:", socket.id);

  socket.on("joinTest", ({ userId, testId }) => {
    socket.join(`test_${testId}`);
    console.log(`User ${userId} test_${testId} xonasiga qo‘shildi`);

    io.to(`test_${testId}`).emit("userOnline", { userId, online: true });
  });

  socket.on("disconnect", () => {
    console.log(`User socket uzildi: ${socket.id}`);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`✅ Server ${PORT}-portda ishlayapti`);
});
