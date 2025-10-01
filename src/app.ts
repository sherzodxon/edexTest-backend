import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import gradeRoutes from "./routes/grade.routes";
import testRoutes from "./routes/test.routes";
import answerRoutes from "./routes/answer.routes";
import questionRoutes from "./routes/question.routes";


const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/answers", answerRoutes);
app.use("/api/questions", questionRoutes);

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("joinTeacherRoom", (teacherId) => {
    socket.join(`teacher_${teacherId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} da ishlayapti`);
});

export { io };
