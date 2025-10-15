"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = initSocket;
const socket_io_1 = require("socket.io");
const client_1 = __importDefault(require("../prisma/client"));
function initSocket(server) {
    const io = new socket_io_1.Server(server, {
        cors: { origin: "*" },
    });
    io.on("connection", (socket) => {
        console.log("Client connected", socket.id);
        socket.on("joinTeacherRoom", (teacherId) => {
            socket.join(`teacher_${teacherId}`);
            console.log(`Teacher ${teacherId} roomiga qo‘shildi`);
        });
        socket.on("testFinished", async ({ userId, testId }) => {
            try {
                const result = await client_1.default.userTest.findUnique({
                    where: { userId_testId: { userId, testId } },
                    include: { user: true, test: { include: { grade: true } } },
                });
                if (result) {
                    // Testni yaratgan teacher ID sini olish
                    const test = await client_1.default.test.findUnique({
                        where: { id: testId },
                        select: { teacherId: true },
                    });
                    if (test?.teacherId) {
                        io.to(`teacher_${test.teacherId}`).emit("resultUpdated", result);
                        console.log(`Natija teacher_${test.teacherId} roomiga yuborildi`);
                    }
                }
            }
            catch (err) {
                console.error("testFinished socket error:", err);
            }
        });
        socket.on("disconnect", () => {
            console.log("Client disconnected", socket.id);
        });
    });
    return io;
}
