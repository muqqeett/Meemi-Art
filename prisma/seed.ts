/**
 * Database seed — the six Meemi Art categories, and nothing else.
 *
 * These are the real shape of the shop rather than sample data, so a live
 * store needs them. Written with `upsert`: safe to re-run, adds what is
 * missing, deletes nothing, and leaves any name or description an admin has
 * edited alone except for the structural fields.
 *
 * The demo-data generator that used to live here is gone. It fabricated
 * products, customers, orders and reviews — numbers a shop could accidentally
 * show a real visitor, and, for a catalogue of digital goods, products with no
 * file behind them that could be bought and never delivered. Real products are
 * added from the admin dashboard, where a file has to be uploaded before one
 * can be published.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { categories } from "./seed-data";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log("Seeding Meemi Art category structure…");

  let created = 0;
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      // An existing category keeps whatever the admin has set — only the name
      // and sort order are treated as structural.
      update: { name: category.name, sortOrder: category.sortOrder },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        icon: category.icon,
        sortOrder: category.sortOrder,
      },
    });
    created += 1;
  }

  console.log(`\n  ${created} categories in place.`);
  console.log("  No products, customers, orders or reviews were created.");
  console.log("  Add real products from the admin dashboard.\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
