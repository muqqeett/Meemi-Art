import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

prisma.category
  .findMany({
    select: { name: true, slug: true, description: true, icon: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  })
  .then((rows) => {
    for (const row of rows) {
      console.log(`${row.slug.padEnd(22)} ${row.name.padEnd(22)} ${row.description ?? "(no description)"}`);
    }
  })
  .finally(() => prisma.$disconnect());
