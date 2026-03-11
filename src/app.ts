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
import groupRoutes from "./routes/group.routes";
import pointRoutes from "./routes/point.routes";
import qbankRoutes from "./routes/q-bank.routes"

const app = express();

// app.use(
//   cors({
//     origin: "*",
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "https://test.edexschool.uz", 
        "http://localhost:3000",      
      ];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy: Kirishga ruxsat berilmagan"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
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
app.use("/api/groups",groupRoutes);
app.use("/api/points",pointRoutes);
app.use("/api/question-bank",qbankRoutes)
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server http://0.0.0.0:${PORT} da ishga tushdi`);
});
