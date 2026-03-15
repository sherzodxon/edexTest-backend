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


const allowedOrigins = [
  "https://test.edexschool.uz",
  "https://gradoria.vercel.app"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS blocked"));
  },
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true
}));

// Preflight
app.options(/.*/, cors());

app.use(bodyParser.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} -> ${req.url}`);
  next();
});

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
