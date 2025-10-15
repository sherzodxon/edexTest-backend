"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const grade_routes_1 = __importDefault(require("./routes/grade.routes"));
const test_routes_1 = __importDefault(require("./routes/test.routes"));
const answer_routes_1 = __importDefault(require("./routes/answer.routes"));
const question_routes_1 = __importDefault(require("./routes/question.routes"));
const subject_routes_1 = __importDefault(require("./routes/subject.routes"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, { cors: { origin: "*" } });
exports.io = io;
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../uploads")));
app.use("/api/auth", auth_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/grades", grade_routes_1.default);
app.use("/api/tests", test_routes_1.default);
app.use("/api/answers", answer_routes_1.default);
app.use("/api/questions", question_routes_1.default);
app.use("/api/subjects", subject_routes_1.default);
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
