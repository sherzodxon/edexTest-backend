import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import bodyParser from "body-parser";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import gradeRoutes from "./routes/grade.routes";
import testRoutes from "./routes/test.routes";
import answerRoutes from "./routes/answer.routes";
import questionRoutes from "./routes/question.routes";
import subjectRoutes from "./routes/subject.routes";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",  
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(bodyParser.json());

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/answers", answerRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/subjects", subjectRoutes);

io.on("connection", (socket) => {
  console.log(`Yangi client ulandi: ${socket.id}`);

  socket.on("joinTeacherRoom", (teacherId: string) => {
    socket.join(`teacher_${teacherId}`);
    console.log(`O'qituvchi ${teacherId} xonasiga qo'shildi`);
  });

  socket.on("studentOnline", (userId: string) => {
    console.log(`O'quvchi ${userId} onlayn`);
  });

  socket.on("disconnect", () => {
    console.log(`Client uzildi: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} da ishlayapti`);
});

export { io };
