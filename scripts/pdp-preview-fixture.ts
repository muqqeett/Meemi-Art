/**
 * Creates a throwaway product so the product page can be looked at, then
 * removes it again.
 *
 * The catalogue is empty, so there is otherwise no URL that renders the page.
 * Everything it writes is prefixed `PDP-PREVIEW` and deleted by `--down`, and
 * nothing here is ever published to the storefront listing for longer than the
 * check takes.
 *
 *   npx tsx scripts/pdp-preview-fixture.ts        # create, print the slug
 *   npx tsx scripts/pdp-preview-fixture.ts --down # remove everything
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const SKU = "PDP-PREVIEW-1";
const SLUG = "pdp-preview";
const EMAIL_DOMAIN = "@pdp-preview.invalid";

const IMAGES = [
  "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1516961642265-531546e84af2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1502720705749-871143f0e671?auto=format&fit=crop&w=1200&q=80",
];

// One review per person: the schema holds a unique constraint on
// (productId, userId), which is the right rule and worth respecting here.
const REVIEWS = [
  { author: "Samir Ahmed", rating: 5, title: "This is amazing product here.", body: "Exactly what I hoped for. The file opened cleanly and the detail holds up at full size." },
  { author: "Bethany Mowbry", rating: 5, title: "This is amazing product here.", body: "Downloaded in seconds and the licence terms were clear. Would buy again." },
  { author: "Ronald Richards", rating: 4, title: "Very good, one small note", body: "Lovely work. I would have liked a second colourway included, but no complaints otherwise." },
];

async function down() {
  await prisma.product.deleteMany({ where: { sku: { startsWith: "PDP-PREVIEW" } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  console.log("Preview fixture removed.");
}

async function up() {
  await down();

  const category = await prisma.category.findFirst({ select: { id: true, slug: true } });
  if (!category) throw new Error("Seed the categories first: npm run db:seed");

  const reviewers = await Promise.all(
    REVIEWS.map((review, index) =>
      prisma.user.create({
        data: {
          email: `reviewer-${index}${EMAIL_DOMAIN}`,
          name: review.author,
          role: "CUSTOMER",
        },
        select: { id: true },
      }),
    ),
  );

  const ratingAvg =
    REVIEWS.reduce((sum, review) => sum + review.rating, 0) / REVIEWS.length;

  const product = await prisma.product.create({
    data: {
      name: "Long Sleeve Overshirt Study, Khaki",
      slug: SLUG,
      brand: "Meemi Art Originals",
      sku: SKU,
      description:
        "A hand-drawn study rendered as a layered digital file, ready to print at up to A1 without softening. " +
        "Supplied as a high-resolution PDF with the original line work kept on its own layer, so the fill colours " +
        "can be changed without touching the drawing. Includes a personal-use licence and a short note on how the " +
        "piece was built, from the first pencil pass through to the final pass of colour.",
      shortDescription: "A layered digital study, ready to print at up to A1.",
      categoryId: category.id,
      priceCents: 2800,
      compareAtCents: 4000,
      isActive: true,
      ratingAvg,
      reviewCount: REVIEWS.length,
      images: {
        create: IMAGES.map((url, index) => ({
          url,
          alt: "A layered digital study in khaki tones",
          sortOrder: index,
        })),
      },
      asset: {
        create: {
          storageKey: "pdp-preview/never-signed",
          filename: "long-sleeve-overshirt-study.pdf",
          contentType: "application/pdf",
          bytes: 18_400_000,
          version: "1.2",
        },
      },
      reviews: {
        create: REVIEWS.map((review, index) => ({
          rating: review.rating,
          title: review.title,
          body: review.body,
          userId: reviewers[index].id,
        })),
      },
    },
    select: { slug: true },
  });

  console.log(`Preview product created: /products/${product.slug}`);
  console.log(`Category listing:        /shop/${category.slug}`);
  console.log("\nRemove it with: npx tsx scripts/pdp-preview-fixture.ts --down\n");
}

const main = process.argv.includes("--down") ? down : up;

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
