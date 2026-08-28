/**
 * Removes accounts and orders created by verification harnesses.
 *
 * Targets only the throwaway domains the harnesses use, so real customers and
 * orders are untouched.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DOMAINS = ["@sebha.invalid", "@meemiart.invalid"];

async function main() {
  for (const domain of DOMAINS) {
    const match = { endsWith: domain };

    const orders = await prisma.order.findMany({
      where: { email: match },
      select: { id: true, orderNumber: true },
    });

    for (const order of orders) {
      await prisma.order.delete({ where: { id: order.id } });
      console.log(`Deleted order ${order.orderNumber}.`);
    }

    const logs = await prisma.emailLog.deleteMany({ where: { to: match } });
    const users = await prisma.user.deleteMany({ where: { email: match } });
    console.log(`${domain}: ${users.count} account(s), ${logs.count} email log row(s).`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
