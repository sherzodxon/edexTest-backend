"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowFirstAdmin = exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = __importDefault(require("../prisma/client"));
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return res.status(401).json({ message: "No token provided" });
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};
exports.authenticate = authenticate;
const authorize = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        next();
    };
};
exports.authorize = authorize;
const allowFirstAdmin = async (req, res, next) => {
    if (req.body.role !== "ADMIN")
        return (0, exports.authorize)(["ADMIN"])(req, res, next);
    const existingAdmin = await client_1.default.user.findFirst({ where: { role: "ADMIN" } });
    if (existingAdmin)
        return (0, exports.authorize)(["ADMIN"])(req, res, next);
    next();
};
exports.allowFirstAdmin = allowFirstAdmin;
