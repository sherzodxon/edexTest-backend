import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import bodyParser from "body-parser";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import gradeRoutes from "./routes/grade.routes";
import testRoutes from "./routes/test.routes";
import questionRoutes from "./routes/question.routes";
import subjectRoutes from "./routes/subject.routes";

const app = express();

app.use(
  cors({
    origin: "https://test.edexschool.uz/",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(bodyParser.json());

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/subjects", subjectRoutes);

const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 5000;

server.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} da ishga tushdi`);
});
