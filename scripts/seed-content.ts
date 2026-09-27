/**
 * Seed the articles that ship with the content platform.
 *
 * Idempotent, and deliberately conservative:
 *
 *   - Articles are written as DRAFTS. Nothing this script does can publish
 *     anything; publishing is a decision made in the admin by a person who has
 *     read the piece.
 *   - An article that already exists is updated only while it is still a
 *     draft. Once it has been published, or edited and published, this leaves
 *     it alone — a seed script must never overwrite an editor's work.
 *   - Topics are created if missing and never renamed.
 *
 * Safe to run against production (it writes drafts only), but it is run
 * locally first. Usage: npm run seed:content
 */
import "dotenv/config";

import { SEED_ARTICLES, SEED_TOPICS } from "../src/content/seed/articles";
import { SEED_TUTORIALS } from "../src/content/seed/tutorials";

async function main() {
  const target = process.env.DATABASE_URL;
  if (!target) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  console.log(`Seeding content into: ${new URL(target).hostname}`);

  const { prisma } = await import("../src/lib/prisma");
  const { parseAuthoringSteps, parseAuthoringText } = await import("../src/lib/content/authoring");
  const { countWords, outline, readingMinutes, tutorialBlocks } = await import("../src/lib/content/blocks");

  try {
    for (const topic of SEED_TOPICS) {
      const existing = await prisma.contentTopic.findUnique({ where: { slug: topic.slug }, select: { id: true } });
      if (existing) {
        console.log(`  topic ${topic.slug}: already exists`);
        continue;
      }
      await prisma.contentTopic.create({ data: topic });
      console.log(`  topic ${topic.slug}: created`);
    }

    for (const article of SEED_ARTICLES) {
      const body = parseAuthoringText(article.body);
      const words = countWords(body);
      const sections = outline(body).length;

      const topic = await prisma.contentTopic.findUnique({ where: { slug: article.topicSlug }, select: { id: true } });
      const existing = await prisma.article.findUnique({
        where: { slug: article.slug },
        select: { id: true, status: true },
      });

      const data = {
        title: article.title,
        excerpt: article.excerpt,
        body,
        topicId: topic?.id ?? null,
        teaches: article.teaches,
        tags: article.tags,
        seoTitle: article.seoTitle ?? null,
        seoDescription: article.seoDescription ?? null,
        readingMinutes: readingMinutes(body),
      };

      if (!existing) {
        await prisma.article.create({ data: { ...data, slug: article.slug, status: "DRAFT" } });
        console.log(`  article ${article.slug}: created as DRAFT (${words} words, ${sections} sections, ${data.readingMinutes} min)`);
        continue;
      }

      if (existing.status === "PUBLISHED") {
        console.log(`  article ${article.slug}: published already — left untouched`);
        continue;
      }

      await prisma.article.update({ where: { id: existing.id }, data });
      console.log(`  article ${article.slug}: draft refreshed (${words} words, ${sections} sections, ${data.readingMinutes} min)`);
    }

    for (const tutorial of SEED_TUTORIALS) {
      const intro = parseAuthoringText(tutorial.intro);
      const steps = parseAuthoringSteps(tutorial.steps);
      const outro = tutorial.outro ? parseAuthoringText(tutorial.outro) : [];
      const all = tutorialBlocks(intro, steps, outro);
      const words = countWords(all);

      const topic = await prisma.contentTopic.findUnique({
        where: { slug: tutorial.topicSlug },
        select: { id: true },
      });

      // Featured patterns, by slug so the seed does not carry database ids.
      // A slug that does not exist here is skipped rather than failing the run:
      // the catalogue differs between a local database and production.
      const products = tutorial.productSlugs?.length
        ? await prisma.product.findMany({
            where: { slug: { in: tutorial.productSlugs } },
            select: { id: true, slug: true },
          })
        : [];
      const missing = (tutorial.productSlugs ?? []).filter((slug) => !products.some((p) => p.slug === slug));

      const existing = await prisma.tutorial.findUnique({
        where: { slug: tutorial.slug },
        select: { id: true, status: true },
      });

      const data = {
        title: tutorial.title,
        excerpt: tutorial.excerpt,
        intro,
        steps,
        outro,
        materials: tutorial.materials,
        difficulty: tutorial.difficulty,
        minutesMin: tutorial.minutesMin,
        minutesMax: tutorial.minutesMax,
        topicId: topic?.id ?? null,
        teaches: tutorial.teaches,
        tags: tutorial.tags,
        seoTitle: tutorial.seoTitle ?? null,
        seoDescription: tutorial.seoDescription ?? null,
        readingMinutes: readingMinutes(all),
      };

      const note = `${words} words, ${steps.length} steps, ${data.readingMinutes} min${
        products.length > 0 ? `, ${products.length} featured pattern(s)` : ""
      }${missing.length > 0 ? ` — not found here: ${missing.join(", ")}` : ""}`;

      if (!existing) {
        await prisma.tutorial.create({
          data: {
            ...data,
            slug: tutorial.slug,
            status: "DRAFT",
            products: { create: products.map((product, index) => ({ productId: product.id, sortOrder: index })) },
          },
        });
        console.log(`  tutorial ${tutorial.slug}: created as DRAFT (${note})`);
        continue;
      }

      if (existing.status === "PUBLISHED") {
        console.log(`  tutorial ${tutorial.slug}: published already — left untouched`);
        continue;
      }

      await prisma.tutorialProduct.deleteMany({ where: { tutorialId: existing.id } });
      await prisma.tutorial.update({
        where: { id: existing.id },
        data: {
          ...data,
          products: { create: products.map((product, index) => ({ productId: product.id, sortOrder: index })) },
        },
      });
      console.log(`  tutorial ${tutorial.slug}: draft refreshed (${note})`);
    }

    const [drafts, published, tutorialDrafts, tutorialsPublished] = await Promise.all([
      prisma.article.count({ where: { status: "DRAFT" } }),
      prisma.article.count({ where: { status: "PUBLISHED" } }),
      prisma.tutorial.count({ where: { status: "DRAFT" } }),
      prisma.tutorial.count({ where: { status: "PUBLISHED" } }),
    ]);
    console.log(`\nDone. Articles: ${drafts} draft(s), ${published} published.`);
    console.log(`Tutorials: ${tutorialDrafts} draft(s), ${tutorialsPublished} published.`);
    await prisma.$disconnect();
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  }
}

void main();
