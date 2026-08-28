import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const [products, orders, users, reviews, categories, images] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count(),
    prisma.review.count(),
    prisma.category.count(),
    prisma.productImage.count(),
  ]);
  console.log({ products, orders, users, reviews, categories, images });

  const owned = await prisma.productImage.count({ where: { storageKey: { not: null } } });
  console.log(`product images with a Cloudinary storageKey: ${owned}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
