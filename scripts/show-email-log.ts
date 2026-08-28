import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const rows = await prisma.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  for (const row of rows) {
    console.log(
      [
        row.createdAt.toISOString(),
        row.status.padEnd(7),
        row.template.padEnd(20),
        row.to.padEnd(32),
        row.dedupeKey ?? "-",
      ].join("  "),
    );
    console.log(`    subject: ${row.subject}`);
  }
  console.log(`\n${rows.length} row(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
