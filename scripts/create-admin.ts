/**
 * Create a new admin, or promote an existing account to admin.
 *
 *   npx tsx scripts/create-admin.ts <email> [password] [name]
 *
 * If the email already exists the account is promoted to ADMIN and, when a
 * password is supplied, its password is reset. Otherwise a new admin is
 * created. When no password is given a strong one is generated and printed
 * once — it is stored only as a bcrypt hash and cannot be recovered later.
 *
 * Safe to re-run: it never deletes anything and never touches other accounts.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Readable but strong: 18 URL-safe characters, plus guaranteed complexity. */
function generatePassword(): string {
  const body = randomBytes(18)
    .toString("base64url")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 16);
  return `Sb${body}7!`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function main() {
  const [emailArg, passwordArg, ...nameParts] = process.argv.slice(2);

  if (!emailArg) {
    console.error("Usage: npx tsx scripts/create-admin.ts <email> [password] [name]");
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  if (!isValidEmail(email)) {
    console.error(`"${email}" is not a valid email address.`);
    process.exit(1);
  }

  const password = passwordArg?.trim() || generatePassword();
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const name = nameParts.join(" ").trim() || "Meemi Art Admin";
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        // Only reset the password when one was explicitly supplied, so
        // promoting an account does not lock its owner out.
        ...(passwordArg ? { passwordHash } : {}),
      },
    });

    console.log(`\nPromoted existing account to ADMIN: ${email}`);
    console.log(
      passwordArg
        ? `Password reset to the one you supplied.`
        : `Existing password kept (pass one as the 2nd argument to reset it).`,
    );
    console.log(`Previous role: ${existing.role}\n`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name,
      role: "ADMIN",
      passwordHash,
      emailVerified: new Date(),
      // Every account gets a wishlist; the storefront assumes one exists.
      wishlist: { create: {} },
    },
  });

  console.log("\nAdmin account created.\n");
  console.log(`  Email    : ${email}`);
  console.log(`  Password : ${password}`);
  console.log(`  Name     : ${name}`);
  console.log("\nSign in at /login, then open /admin.");
  console.log("Change this password from Account -> Settings.\n");
}

main()
  .catch((error) => {
    console.error("Failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
