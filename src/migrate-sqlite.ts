import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";

const sqlite = new Database("./prisma/dev.db");
const prisma = new PrismaClient();

function transformRow(row: any) {
  const newRow = { ...row };
  
  const dateFields = ['createdAt', 'updatedAt', 'startTime', 'endTime', 'date'];
  for (const field of dateFields) {
    if (newRow[field] !== undefined && newRow[field] !== null) {
      const val = newRow[field];
      newRow[field] = isNaN(Number(val)) ? new Date(val) : new Date(Number(val));
    }
  }
  
  const booleanFields = ['isBank', 'isCorrect', 'finished'];
  for (const field of booleanFields) {
    if (newRow[field] !== undefined && newRow[field] !== null) {
      newRow[field] = Boolean(newRow[field]);
    }
  }

  return newRow;
}

async function main() {
  try {
    console.log("🚀 PostgreSQL-ga migratsiya boshlandi...");
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("📦 SQLite faylidagi mavjud jadvallar:", tables.map((t: any) => t.name));

    // 1️⃣ TOZALASH
    console.log("♻️ Eski ma'lumotlar tozalanmoqda...");
    const models = ['pointLog', 'userTest', 'answer', 'option', 'question', 'test', 'subject', 'user', 'group', 'grade'];
    for (const model of models) {
      await (prisma as any)[model].deleteMany({});
    }

    // 2️⃣ GRADE
    const grades = sqlite.prepare("SELECT * FROM Grade").all();
    if (grades.length > 0) {
      await prisma.grade.createMany({ data: grades.map(transformRow) });
      console.log(`✅ Grades: ${grades.length} ta.`);
    }
// 3️⃣ GROUP (xavfsiz holatga keltiramiz)
try {
  const groups = sqlite.prepare("SELECT * FROM \"Group\"").all(); 
  if (groups.length > 0) {
    await prisma.group.createMany({ data: groups.map(transformRow) });
    console.log(`✅ Groups: ${groups.length} ta.`);
  }
} catch (e: any) {
  // Agar jadval bo'lmasa, xato bermasdan keyingi bosqichga o'tamiz
  console.log("ℹ️  Group jadvali SQLite-da mavjud emas, o'tkazib yuborildi.");
}

    // 4️⃣ USER
    const users = sqlite.prepare("SELECT * FROM User").all();
    if (users.length > 0) {
      await prisma.user.createMany({ data: users.map(transformRow) });
      console.log(`✅ Users: ${users.length} ta.`);
    }

    // 5️⃣ SUBJECT
    const subjects = sqlite.prepare("SELECT * FROM Subject").all();
    if (subjects.length > 0) {
      await prisma.subject.createMany({ data: subjects.map(transformRow) });
      console.log(`✅ Subjects: ${subjects.length} ta.`);
    }

   // 6️⃣ MANY-TO-MANY BOG'LANISHLARNI TIKLASH (MUHIM!)
    console.log("🔗 O'qituvchi bog'lanishlarini tiklash boshlandi...");
    
    try {
      const tSubjects = sqlite.prepare('SELECT * FROM "_TeacherSubjects"').all() as { A: number, B: number }[];
      for (const rel of tSubjects) {
        await prisma.user.update({
          where: { id: rel.B }, 
          data: { teacherSubjects: { connect: { id: rel.A } } }
        });
      }
      console.log(`✅ Teacher-Subject bog'landi: ${tSubjects.length} ta.`);
    } catch (e: any) { 
      console.log("⚠️ Teacher-Subject bog'lashda xato:", e.message); 
    }

    try {
      const tGrades = sqlite.prepare('SELECT * FROM "_TeacherGrades"').all() as { A: number, B: number }[];
      for (const rel of tGrades) {
        await prisma.user.update({
          where: { id: rel.B },
          data: { teacherGrades: { connect: { id: rel.A } } }
        });
      }
      console.log(`✅ Teacher-Grade bog'landi: ${tGrades.length} ta.`);
    } catch (e: any) { 
      console.log("⚠️ Teacher-Grade bog'lashda xato:", e.message); 
    }

    // 7️⃣ TEST, QUESTION, OPTION
    const tests = sqlite.prepare("SELECT * FROM Test").all();
    if (tests.length > 0) {
      await prisma.test.createMany({ data: tests.map(transformRow) });
      console.log(`✅ Tests: ${tests.length} ta.`);
    }

    const questions = sqlite.prepare("SELECT * FROM Question").all();
    if (questions.length > 0) {
      await prisma.question.createMany({ data: questions.map(transformRow) });
      const options = sqlite.prepare("SELECT * FROM Option").all();
      if (options.length > 0) {
        await prisma.option.createMany({ data: options.map(transformRow) });
      }
      console.log(`✅ Questions & Options ko'chirildi.`);
    }

    // 8️⃣ POINTLOG, ANSWER, USERTEST
const remaining = [
  { table: "PointLog", model: "pointLog" },
  { table: "Answer", model: "answer" },
  { table: "UserTest", model: "userTest" }
];

for (const item of remaining) {
  try {
    const tableExists = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(item.table);
    
    if (tableExists) {
      const rows = sqlite.prepare(`SELECT * FROM ${item.table}`).all();
      if (rows.length > 0) {
        await (prisma as any)[item.model].createMany({ data: rows.map(transformRow) });
        console.log(`✅ ${item.table}: ${rows.length} ta.`);
      }
    } else {
      console.log(`ℹ️  ${item.table} jadvali SQLite-da yo'q, o'tkazib yuborildi.`);
    }
  } catch (e: any) {
    console.log(`⚠️ ${item.table} ko'chirishda xatolik:`, e.message);
  }
}

    // 9️⃣ ID SEQUENCE-LARNI YANGILASH
    console.log("🛠 ID Sequence-lar yangilanmoqda...");
    for (const model of models) {
      const tableName = model.charAt(0).toUpperCase() + model.slice(1);
      await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM "${tableName}";`);
    }

    console.log("🏁 MUVAFFAQIYATLI YAKUNLANDI!");
  } catch (error) {
    console.error("❌ Xatolik:", error);
  } finally {
    await prisma.$disconnect();
    sqlite.close();
  }
}

main();