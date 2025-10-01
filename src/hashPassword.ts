import bcrypt from "bcryptjs";

async function main() {
  const hashed = await bcrypt.hash("parol", 10);
  console.log("Hashed password:", hashed);
}

main();
