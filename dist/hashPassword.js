"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function main() {
    const hashed = await bcryptjs_1.default.hash("Admin10.com", 10);
    console.log("Hashed password:", hashed);
}
main();
