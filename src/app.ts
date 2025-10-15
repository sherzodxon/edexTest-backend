import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import bodyParser from "body-parser";

// 🔸 Routelarni import qilish
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import gradeRoutes from "./routes/grade.routes";
import testRoutes from "./routes/test.routes";
import answerRoutes from "./routes/answer.routes";
import questionRoutes from "./routes/question.routes";
import subjectRoutes from "./routes/subject.routes";

// 🔸 Express ilovasini yaratamiz
const app = express();

// 🔸 HTTP server
const server = http.createServer(app);

// 🔸 Socket.io ulaymiz
const io = new Server(server, {
  cors: {
    origin: "*",   // frontend localhost:3000,5173 va boshqalar uchun ruxsat
    methods: ["GET", "POST"]
  }
});

// 🔸 Middleware-lar
app.use(cors());
app.use(bodyParser.json());

// 🔸 Statik fayllar (rasmlar, fayllar va h.k.)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 🔸 API routelar
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/answers", answerRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/subjects", subjectRoutes);

// 🔸 Socket.io hodisalari
io.on("connection", (socket) => {
  console.log(`📡 Yangi client ulandi: ${socket.id}`);

  // Masalan, o‘qituvchi xonaga qo‘shilishi uchun
  socket.on("joinTeacherRoom", (teacherId: string) => {
    socket.join(`teacher_${teacherId}`);
    console.log(`👨‍🏫 Teacher ${teacherId} xonasiga qo‘shildi`);
  });

  // O‘quvchi onlaynligini aniqlash uchun
  socket.on("studentOnline", (userId: string) => {
    console.log(`🧑‍🎓 O‘quvchi ${userId} onlayn`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Client uzildi: ${socket.id}`);
  });
});

// 🔸 Serverni ishga tushiramiz
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} da ishlayapti`);
});

// 🔸 Boshqa fayllarda ishlatish uchun io ni eksport qilamiz
export { io };
