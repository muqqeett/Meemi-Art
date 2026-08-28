/**
 * Lists admin accounts and verifies whether the documented seed password still
 * works. Read-only — it never changes anything.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, name: true, passwordHash: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (admins.length === 0) {
    console.log("No ADMIN accounts exist.");
    return;
  }

  console.log(`${admins.length} admin account(s):\n`);
  for (const admin of admins) {
    const usable = admin.passwordHash
      ? await bcrypt.compare("Admin123!", admin.passwordHash)
      : false;

    console.log(`  email    : ${admin.email}`);
    console.log(`  name     : ${admin.name ?? "(none)"}`);
    console.log(`  id       : ${admin.id}`);
    console.log(`  password : ${admin.passwordHash ? "set" : "NOT SET — cannot sign in"}`);
    console.log(`  "Admin123!" works: ${usable ? "yes" : "no"}`);
    console.log("");
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
