import bcrypt from "bcryptjs";

async function main() {
  const hashed = await bcrypt.hash("Admin10.com", 10);
  console.log("Hashed password:", hashed);
}

main();
