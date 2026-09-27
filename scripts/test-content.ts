/**
 * Content platform harness — Wave 1.
 *
 * Covers the content model (typed blocks, link safety, reading time), the
 * crochet reference data the resource pages render, the resource registry, the
 * technique-driven link between learning pages and patterns, navigation, and
 * indexing: what belongs in the sitemap and what must never appear in it.
 *
 * LOCAL DATABASE ONLY, NO NETWORK — same guards as the other harnesses.
 *
 * Run: npm run test:content
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const localUrl = process.env.LOCAL_DATABASE_URL;
if (!localUrl) {
  console.error("Refusing to run: LOCAL_DATABASE_URL is not set.");
  process.exit(1);
}
if (!LOCAL_HOSTS.has(new URL(localUrl).hostname)) {
  console.error("Refusing to run: LOCAL_DATABASE_URL is not a local database.");
  process.exit(1);
}
process.env.DATABASE_URL = localUrl;
process.env.SITE_URL = process.env.SITE_URL ?? "https://www.meemiart.com";

for (const name of [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "GEMINI_API_KEY",
  "PADDLE_API_KEY",
]) {
  delete process.env[name];
}

let outbound = 0;
const refuse = (): never => {
  outbound++;
  throw new Error("Outbound network request blocked by the content harness.");
};
globalThis.fetch = (async () => refuse()) as typeof fetch;
https.request = refuse as unknown as typeof https.request;
https.get = refuse as unknown as typeof https.get;
http.request = refuse as unknown as typeof http.request;
http.get = refuse as unknown as typeof http.get;

const RUN = `zz-content-${randomUUID().slice(0, 8)}`;
const ROOT = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const exists = (file: string) => existsSync(path.join(ROOT, file));

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const blocks = await import("../src/lib/content/blocks");
  const resources = await import("../src/lib/content/resources");
  const seo = await import("../src/lib/content/seo");
  const abbreviations = await import("../src/lib/crochet/abbreviations");
  const hooks = await import("../src/lib/crochet/hooks");
  const yarn = await import("../src/lib/crochet/yarn-weights");
  const links = await import("../src/lib/queries/content-links");
  const { TECHNIQUE_SLUGS } = await import("../src/lib/difficulty/techniques");
  const { mainNav, legalNav } = await import("../src/lib/config");
  const authoring = await import("../src/lib/content/authoring");
  const articles = await import("../src/lib/queries/articles");
  const validations = await import("../src/lib/validations/content");
  const seeds = await import("../src/content/seed/articles");
  const tutorials = await import("../src/lib/queries/tutorials");
  const tutorialSeeds = await import("../src/content/seed/tutorials");
  const diagrams = await import("../src/components/content/diagrams");

  const createdProducts: string[] = [];
  const createdArticles: string[] = [];
  const createdTutorials: string[] = [];
  const createdTopics: string[] = [];
  let categoryId: string | null = null;

  try {
    // ------------------------------------------------------------ blocks
    console.log("\nContent model");
    const sample = blocks.parseBlocks([
      { type: "heading", level: 2, text: "Reading a round" },
      { type: "paragraph", content: ["Count at the end of ", { text: "every round", strong: true }, "."] },
      { type: "list", ordered: true, items: [["First"], ["Second"]] },
      { type: "callout", tone: "tip", title: "Tip", content: ["Place a marker."] },
      { type: "table", columns: ["A", "B"], rows: [["1", "2"]] },
    ]);
    check("valid blocks survive parsing", sample.length === 5, String(sample.length));
    check("headings keep their level", sample[0].type === "heading" && sample[0].level === 2);

    const hostile = blocks.parseBlocks([
      { type: "script", content: ["alert(1)"] },
      { type: "paragraph", content: [{ text: "click", href: "javascript:alert(1)" }] },
      { type: "paragraph", content: [{ text: "off site", href: "//evil.example" }] },
      { type: "image", url: "/a.png" },
      "not a block",
      null,
    ]);
    check("unknown block types are dropped", !hostile.some((block) => (block as { type: string }).type === "script"));
    check(
      "a javascript: link is stripped but the text survives",
      hostile.some((block) => block.type === "paragraph" && block.content.some((node) => typeof node === "object" && node.text === "click" && !node.href)),
    );
    check(
      "a protocol-relative link is stripped",
      hostile.some((block) => block.type === "paragraph" && block.content.some((node) => typeof node === "object" && node.text === "off site" && !node.href)),
    );
    check("an image with no alt text is refused", !hostile.some((block) => block.type === "image"));
    check("internal and https links are kept", blocks.safeContentHref("/tutorials/magic-ring") === "/tutorials/magic-ring" && blocks.safeContentHref("https://example.com/x") === "https://example.com/x");
    check(
      "everything else is refused",
      ["javascript:alert(1)", "//evil.example", "http://insecure.example", "/a b", "data:text/html,x", ""].every((href) => blocks.safeContentHref(href) === null),
    );
    const longRead = blocks.parseBlocks([
      { type: "paragraph", content: ["word ".repeat(399).trim()] },
      { type: "paragraph", content: ["word ".repeat(399).trim()] },
    ]);
    check("reading time is at least a minute", blocks.readingMinutes(sample) >= 1);
    check("reading time scales with the words actually read", blocks.countWords(longRead) === 798 && blocks.readingMinutes(longRead) === 4, String(blocks.countWords(longRead)));
    check("a single block cannot hold unbounded text", blocks.parseBlocks([{ type: "paragraph", content: ["x".repeat(2100)] }]).length === 0);
    check("heading anchors are stable and url-safe", blocks.headingId("Rows & rounds are written differently!") === "rows-rounds-are-written-differently");
    check("the outline lists only h2s", blocks.outline(sample).length === 1 && blocks.outline(sample)[0].text === "Reading a round");
    check("plain text ignores markup structure", blocks.blocksToPlainText(sample).includes("Count at the end of every round"));

    // ------------------------------------------------------------ reference data
    console.log("\nCrochet reference data");
    const abbrs = abbreviations.ABBREVIATIONS;
    check("every abbreviation is unique", new Set(abbrs.map((a) => a.abbr.toLowerCase())).size === abbrs.length);
    check("every abbreviation explains what to do, not just the words", abbrs.every((a) => a.meaning.length > 60));
    check("every abbreviation belongs to a declared group", abbrs.every((a) => abbreviations.ABBREVIATION_GROUPS.some((g) => g.slug === a.group)));
    check("every group has entries", abbreviations.ABBREVIATION_GROUPS.every((g) => abbreviations.abbreviationsInGroup(g.slug).length > 0));
    check(
      "the stitches that differ between US and UK say so",
      ["sc", "hdc", "dc", "tr"].every((abbr) => (abbreviations.ABBREVIATION_BY_ABBR.get(abbr)?.ukNote ?? "").length > 0),
    );
    check("the US/UK table pairs every common stitch", abbreviations.US_UK_STITCH_NAMES.length >= 5);

    const sizes = hooks.HOOK_SIZES;
    check("hook sizes are listed smallest first", sizes.every((hook, i) => i === 0 || hook.mm > sizes[i - 1].mm));
    check("every hook size is in millimetres and unique", new Set(sizes.map((h) => h.mm)).size === sizes.length);
    check(
      "every hook names yarn weights that exist",
      sizes.every((hook) => hook.yarnWeights.every((n) => yarn.yarnWeightByNumber(n) !== undefined)),
    );
    check("the common sizes convert correctly", hooks.hookByMm(4)?.us === "G-6" && hooks.hookByMm(5)?.us === "H-8" && hooks.hookByMm(3.5)?.us === "E-4");
    check("hooks can be found for a yarn weight", hooks.hooksForYarnWeight(4).length >= 3);

    const weights = yarn.YARN_WEIGHTS;
    check("yarn weights cover 0 to 7 exactly once", weights.map((w) => w.number).join() === "0,1,2,3,4,5,6,7");
    check("each weight has a hook range that makes sense", weights.every((w) => w.hookMm[0] < w.hookMm[1]));
    check("each weight lists the names it goes by and a practical note", weights.every((w) => w.alsoCalled.length > 0 && w.note.length > 60));
    check("substitution advice is concrete", yarn.SUBSTITUTION_CHECKS.length >= 4);

    // ------------------------------------------------------------ resources
    console.log("\nResource registry and pages");
    const list = resources.RESOURCES;
    check("resource slugs are unique", new Set(list.map((r) => r.slug)).size === list.length);
    check("every resource has a page that exists", list.every((r) => exists(`src/app/(storefront)/resources/${r.slug}/page.tsx`)));
    check("the hub page exists", exists("src/app/(storefront)/learn/page.tsx"));
    check(
      "every resource describes itself for search and for readers",
      list.every((r) => r.description.length >= 80 && r.description.length <= 200 && r.audience.length > 20),
    );
    check(
      "technique tags come from the Project Difficulty vocabulary",
      list.every((r) => r.teaches.every((slug) => (TECHNIQUE_SLUGS as readonly string[]).includes(slug))),
      list.flatMap((r) => r.teaches).join(", "),
    );
    check("resources can be found by the techniques they explain", resources.resourcesForTechniques(["single-crochet"]).length > 0);
    check("a page is returned by slug, and an unknown slug is not", resources.resourceBySlug("abbreviations") !== undefined && resources.resourceBySlug("nope") === undefined);

    for (const resource of list) {
      const source = read(`src/app/(storefront)/resources/${resource.slug}/page.tsx`);
      check(`${resource.slug}: has page metadata`, /export const metadata/.test(source));
      check(`${resource.slug}: renders no raw HTML`, !/dangerouslySetInnerHTML/.test(source));
      check(`${resource.slug}: links to other learning pages`, /href="\/resources\/|href="\/learn|LearnPage/.test(source));
    }
    check(
      "no content component injects raw markup",
      ["src/components/content/learn-page.tsx", "src/components/content/reference-table.tsx", "src/components/content/related-patterns.tsx"].every(
        (file) => !/dangerouslySetInnerHTML/.test(read(file)),
      ),
    );

    // ------------------------------------------------------------ metadata
    console.log("\nSEO metadata");
    const meta = seo.learnMetadata({ title: "T", description: "D", path: "/resources/hook-sizes" });
    check("canonical is the page's own path", meta.alternates?.canonical === "/resources/hook-sizes");
    check("Open Graph restates title, description and url", meta.openGraph?.title === "T" && "url" in (meta.openGraph ?? {}));
    check("Twitter card is a summary_large_image", (meta.twitter as { card?: string })?.card === "summary_large_image");
    const overridden = seo.learnMetadata({ title: "T", description: "D", path: "/x", canonicalOverride: "https://elsewhere.example/x" });
    check("a canonical override is honoured", overridden.alternates?.canonical === "https://elsewhere.example/x");

    // ------------------------------------------------------------ linking
    console.log("\nLearning pages link to real patterns");
    const category = await prisma.category.create({ data: { name: `${RUN} cat`, slug: `${RUN}-cat` }, select: { id: true } });
    categoryId = category.id;
    const makeProduct = async (suffix: string, isActive: boolean, techniques: string[], enabled = true) => {
      const product = await prisma.product.create({
        data: {
          name: `${RUN} ${suffix}`,
          slug: `${RUN}-${suffix}`,
          sku: `${RUN}-${suffix}`.toUpperCase().slice(0, 32),
          brand: "Meemi Art",
          description: "Fixture.",
          priceCents: 900,
          categoryId: category.id,
          isActive,
          difficulty: {
            create: {
              enabled,
              stitches: 2, construction: 2, shaping: 2, colorwork: 1, assembly: 1, patternReading: 2,
              minutesMin: 60, minutesMax: 120, techniques,
            },
          },
        },
        select: { id: true },
      });
      createdProducts.push(product.id);
      return product.id;
    };
    const liveProductId = await makeProduct("live", true, ["magic-ring", "single-crochet"]);
    await makeProduct("draft", false, ["magic-ring"]);
    await makeProduct("disabled", true, ["magic-ring"], false);
    // A real pattern that teaches nothing the page does. It must stay out:
    // a related-products strip that shows everything is an advert, not a link.
    const unrelatedProductId = await makeProduct("unrelated", true, ["tapestry-crochet", "working-in-rows"]);

    const matched = await links.productsForTechniques(["magic-ring"], 10);
    check("a pattern is found by a technique it uses", matched.some((p) => p.id === liveProductId));
    check("an unpublished pattern is never linked", !matched.some((p) => p.name.includes("draft")));
    check("a pattern with difficulty switched off is not linked", !matched.some((p) => p.name.includes("disabled")));
    check("a pattern with no shared technique is not linked", !matched.some((p) => p.id === unrelatedProductId));
    check(
      "every linked pattern really shares a technique",
      matched.every((p) => p.techniques.includes("magic-ring")),
    );
    check(
      "a product without a difficulty profile at all is not linked",
      (await links.productsForTechniques(["multiple-sizes"], 10)).every((p) => p.techniques.length > 0),
    );
    check("no techniques means no links, rather than everything", (await links.productsForTechniques([])).length === 0);
    check("the number of links is bounded", (await links.productsForTechniques(["magic-ring"], 1)).length <= 1);
    check("a page with nothing specific can still show published patterns", (await links.featuredProducts(2)).length <= 2);

    // ------------------------------------------------------------ navigation and indexing
    console.log("\nNavigation, sitemap and robots");
    const navHrefs = mainNav.map((item) => item.href);
    check("the header links to the learning hub exactly once", navHrefs.filter((href) => href === "/learn").length === 1);
    check("the footer links to it too", legalNav.filter((item) => item.href === "/learn").length === 1);
    check(
      "every header link resolves to a route that exists",
      navHrefs.every((href) => {
        const clean = href.split("?")[0];
        if (clean === "/") return true;
        if (clean.startsWith("/shop")) return true;
        return exists(`src/app/(storefront)${clean}/page.tsx`);
      }),
      navHrefs.join(", "),
    );

    // Read as source: importing a Next route module here would pull in the
    // client runtime, which cannot load under the react-server condition.
    // The generated XML itself is verified over HTTP against a built server.
    const sitemapSource = read("src/app/sitemap.ts");
    check("the sitemap builds the hub and every resource from the registry", sitemapSource.includes("/learn") && sitemapSource.includes("RESOURCES.map") && sitemapSource.includes("resourcePath("));
    check("the sitemap still lists the shop, categories and products", sitemapSource.includes("/shop") && sitemapSource.includes("getAllCategorySlugs") && sitemapSource.includes("getAllProductSlugs"));
    const sitemapUrls = sitemapSource.split("`").filter((part) => part.startsWith("${base}/"));
    check("the sitemap names no private or transactional route", !sitemapUrls.some((url) => /(admin|account|cart|checkout|orders|login|register|search)/.test(url)), sitemapUrls.join(" "));

    // Read as source: importing a Next route module here would pull in the
    // client runtime, which cannot load under the react-server condition.
    const robotsSource = read("src/app/robots.ts");
    const disallowed = robotsSource.split('"').filter((part) => part.startsWith("/"));
    check("the learning section is crawlable", !disallowed.some((path) => path.startsWith("/learn") || path.startsWith("/resources")), disallowed.join(" "));
    check("admin and account stay disallowed", disallowed.includes("/admin") && disallowed.includes("/account"));

    // ------------------------------------------------------------ authoring
    console.log("\nAuthoring format");
    const authoredSource = [
      "## A section",
      "",
      "A paragraph with **bold**, `sc` and a [link](/resources/abbreviations).",
      "",
      "- first",
      "- second",
      "",
      "1. step one",
      "2. step two",
      "",
      "> tip: Count every round.",
      "",
      "| Metric | US |",
      "| --- | --- |",
      "| 4 mm | G-6 |",
      "",
      "```",
      "Rnd 1: 6 sc in MR (6)",
      "```",
    ].join("\n");
    const authored = authoring.parseAuthoringText(authoredSource);
    const kinds = authored.map((block) => block.type);
    check("every authoring shape becomes its own block", kinds.join(",") === "heading,paragraph,list,list,callout,table,pattern", kinds.join(","));
    check(
      "a numbered list stays numbered and a bullet list does not",
      authored.filter((b) => b.type === "list").map((b) => (b as { ordered?: boolean }).ordered === true).join() === "false,true",
    );
    check("a table separator row is layout, not content", authored.some((b) => b.type === "table" && b.rows.length === 1));
    check("a pattern excerpt keeps its lines verbatim", authored.some((b) => b.type === "pattern" && b.lines[0] === "Rnd 1: 6 sc in MR (6)"));
    const paragraphBlock = authored.find((b) => b.type === "paragraph");
    check(
      "inline bold, notation and links are parsed",
      paragraphBlock !== undefined &&
        paragraphBlock.type === "paragraph" &&
        paragraphBlock.content.some((n) => typeof n === "object" && n.strong === true) &&
        paragraphBlock.content.some((n) => typeof n === "object" && n.code === true) &&
        paragraphBlock.content.some((n) => typeof n === "object" && n.href === "/resources/abbreviations"),
    );
    const unsafeAuthored = authoring.parseAuthoringText("See [this](javascript:alert(1)) now.");
    check(
      "an unsafe link in authored text loses its href but keeps its words",
      unsafeAuthored.some((b) => b.type === "paragraph" && b.content.some((n) => typeof n === "object" && n.text === "this" && !n.href)),
    );
    check(
      "authoring text round-trips through blocks",
      authoring.parseAuthoringText(authoring.toAuthoringText(authored)).map((b) => b.type).join(",") === kinds.join(","),
    );

    // ------------------------------------------------------------ articles
    console.log("\nArticles: drafts, publishing and relations");
    const topic = await prisma.contentTopic.create({
      data: { slug: RUN + "-topic", name: RUN + " topic", description: "Fixture topic used by the content harness." },
      select: { id: true, slug: true },
    });
    createdTopics.push(topic.id);

    const fixtureBody = authoring.parseAuthoringText("## One\n\nBody text for the harness fixture.\n\n## Two\n\nMore body text here.");
    const makeArticle = async (suffix: string, status: "DRAFT" | "PUBLISHED", publishedAt: Date | null, teaches: string[] = []) => {
      const row = await prisma.article.create({
        data: {
          slug: RUN + "-" + suffix,
          title: RUN + " " + suffix,
          excerpt: "A fixture article used by the content harness to prove the publication rule end to end.",
          body: fixtureBody,
          status,
          publishedAt,
          topicId: topic.id,
          teaches,
          readingMinutes: 1,
        },
        select: { id: true, slug: true },
      });
      createdArticles.push(row.id);
      return row;
    };
    const draftArticle = await makeArticle("draft", "DRAFT", null);
    const liveArticle = await makeArticle("live", "PUBLISHED", new Date(Date.now() - 86_400_000), ["magic-ring"]);
    const scheduledArticle = await makeArticle("scheduled", "PUBLISHED", new Date(Date.now() + 86_400_000));

    check("a published article is readable", (await articles.getPublishedArticle(liveArticle.slug)) !== null);
    check("a draft is not readable by its slug", (await articles.getPublishedArticle(draftArticle.slug)) === null);
    check("an article dated in the future is not readable yet", (await articles.getPublishedArticle(scheduledArticle.slug)) === null);
    const listed = await articles.listPublishedArticles({ page: 1 });
    check(
      "the index lists the published article only",
      listed.articles.some((a) => a.slug === liveArticle.slug) &&
        !listed.articles.some((a) => a.slug === draftArticle.slug || a.slug === scheduledArticle.slug),
    );
    const publishedSlugs = await articles.getPublishedArticleSlugs();
    check(
      "the sitemap source excludes drafts and scheduled articles",
      publishedSlugs.some((a) => a.slug === liveArticle.slug) &&
        !publishedSlugs.some((a) => a.slug === draftArticle.slug || a.slug === scheduledArticle.slug),
    );
    const topicsWithArticles = await articles.listTopicsWithArticles();
    check(
      "a topic appears only once something published sits under it",
      topicsWithArticles.some((t) => t.slug === topic.slug && t.count === 1),
    );

    const fullArticle = await articles.getPublishedArticle(liveArticle.slug);
    const relations = fullArticle ? await articles.getArticleRelations(fullArticle) : null;
    check("an article finds patterns by the techniques it teaches", relations !== null && relations.products.some((p) => p.id === liveProductId));
    check("an article never links to an unpublished pattern", relations !== null && relations.products.every((p) => !p.name.includes("draft")));
    check(
      "an article never links to a pattern it shares nothing with",
      relations !== null && !relations.products.some((p) => p.id === unrelatedProductId),
    );
    check(
      "an article that teaches nothing specific links to no pattern",
      (await articles.getArticleRelations({ ...fullArticle!, teaches: [] })).products.length === 0,
    );

    // A curated link and a technique match on the same pattern must produce one
    // entry, not two: the curated list is merged ahead of the inferred one.
    await prisma.articleProduct.create({ data: { articleId: liveArticle.id, productId: liveProductId } });
    const merged = await articles.getArticleRelations(fullArticle!);
    check(
      "a curated pattern that also matches by technique appears once",
      merged.products.filter((p) => p.id === liveProductId).length === 1,
    );
    check("linked patterns are never duplicated", new Set(merged.products.map((p) => p.id)).size === merged.products.length);
    check(
      "every linked pattern has a slug a product page can be built from",
      merged.products.every((p) => typeof p.slug === "string" && p.slug.length > 0),
    );
    await prisma.articleProduct.deleteMany({ where: { articleId: liveArticle.id } });

    // ------------------------------------------------------------ rules
    console.log("\nArticle rules and authorization");
    const goodInput = {
      title: "A title long enough",
      slug: "a-valid-slug",
      excerpt: "x".repeat(80),
      body: "y".repeat(500),
      topicId: null,
      coverImageUrl: null,
      coverImageAlt: null,
      seoTitle: null,
      seoDescription: null,
      canonicalUrl: null,
      teaches: ["magic-ring"],
      tags: ["beginner"],
      productIds: [],
    };
    check("a complete article passes validation", validations.articleInputSchema.safeParse(goodInput).success);
    check("a body too short to be worth reading is refused", !validations.articleInputSchema.safeParse({ ...goodInput, body: "too short" }).success);
    check("a thin summary is refused", !validations.articleInputSchema.safeParse({ ...goodInput, excerpt: "short" }).success);
    check("a malformed slug is refused", !validations.articleInputSchema.safeParse({ ...goodInput, slug: "Not A Slug" }).success);
    check("a technique outside the vocabulary is refused", !validations.articleInputSchema.safeParse({ ...goodInput, teaches: ["not-a-technique"] }).success);
    check("an unexpected field is refused outright", !validations.articleInputSchema.safeParse({ ...goodInput, status: "PUBLISHED" }).success);

    const actionsSource = read("src/lib/actions/admin/articles.ts");
    const exportedActions = [...actionsSource.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    check(
      "every article action re-checks the admin itself",
      exportedActions.length >= 6 &&
        exportedActions.every((name) => {
          const from = actionsSource.indexOf("export async function " + name);
          const next = actionsSource.indexOf("export async function", from + 10);
          const body = next > 0 ? actionsSource.slice(from, next) : actionsSource.slice(from);
          return body.includes("await adminOrDenied()");
        }),
      exportedActions.join(", "),
    );
    check("creating an article always makes a draft", actionsSource.includes("// New articles are always drafts"));
    check("publishing enforces a length and structure floor", actionsSource.includes("PUBLISH_REQUIREMENTS.minWords") && actionsSource.includes("PUBLISH_REQUIREMENTS.minHeadings"));
    check("the body is parsed on the server, never trusted from the browser", actionsSource.includes("parseAuthoringText(data.body)"));
    check("reading time is derived, not submitted", actionsSource.includes("readingMinutes: readingMinutes(body)"));
    check("every article action records an audit entry", (actionsSource.match(/recordActivity\(/g) || []).length >= 6);
    check(
      "admin article pages live under /admin",
      exists("src/app/admin/content/articles/page.tsx") &&
        exists("src/app/admin/content/articles/new/page.tsx") &&
        exists("src/app/admin/content/articles/[id]/edit/page.tsx") &&
        exists("src/app/admin/content/articles/[id]/preview/page.tsx"),
    );
    check(
      "public blog routes exist",
      exists("src/app/(storefront)/blog/page.tsx") &&
        exists("src/app/(storefront)/blog/[slug]/page.tsx") &&
        exists("src/app/(storefront)/blog/topic/[slug]/page.tsx"),
    );
    const articlePageSource = read("src/app/(storefront)/blog/[slug]/page.tsx");
    check("a missing or draft article is a 404, not an empty page", articlePageSource.includes("notFound()"));
    check("the article page emits Article structured data", articlePageSource.includes("\"@type\": \"Article\""));
    check("structured data names the shop as author, never an invented person", articlePageSource.includes("author: { \"@id\": entityIds.organization }"));
    check("the draft preview is admin-only and not indexable", read("src/app/admin/content/articles/[id]/preview/page.tsx").includes("robots: { index: false"));

    // ------------------------------------------------------------ tutorials
    console.log("\nTutorials");

    const makeTutorial = async (
      suffix: string,
      status: "DRAFT" | "PUBLISHED",
      publishedAt: Date | null,
      teaches: string[] = [],
      topicId: string | null = topic.id,
    ) => {
      const row = await prisma.tutorial.create({
        data: {
          title: `${RUN} tutorial ${suffix}`,
          slug: `${RUN}-tut-${suffix}`,
          excerpt: "A fixture summary long enough to pass the schema's floor for a real description of a tutorial.",
          intro: authoring.parseAuthoringText("An introduction that says what the reader will be able to do."),
          steps: authoring.parseAuthoringSteps("## First\n\nDo this.\n\n## Second\n\nThen this.\n\n## Third\n\nFinally this."),
          outro: authoring.parseAuthoringText("What usually goes wrong."),
          materials: ["A hook", "Some yarn"],
          difficulty: "BEGINNER",
          minutesMin: 10,
          minutesMax: 20,
          topicId,
          teaches,
          tags: ["beginner"],
          status,
          publishedAt,
          readingMinutes: 3,
        },
        select: { id: true, slug: true },
      });
      createdTutorials.push(row.id);
      return row;
    };

    const draftTutorial = await makeTutorial("draft", "DRAFT", null, ["magic-ring"]);
    const liveTutorial = await makeTutorial("live", "PUBLISHED", new Date(Date.now() - 86_400_000), ["magic-ring"]);
    const scheduledTutorial = await makeTutorial("scheduled", "PUBLISHED", new Date(Date.now() + 86_400_000));

    check("a published tutorial is readable", (await tutorials.getPublishedTutorial(liveTutorial.slug)) !== null);
    check("a draft tutorial is not readable by its slug", (await tutorials.getPublishedTutorial(draftTutorial.slug)) === null);
    check(
      "a tutorial dated in the future is not readable yet",
      (await tutorials.getPublishedTutorial(scheduledTutorial.slug)) === null,
    );

    const listedTutorials = await tutorials.listPublishedTutorials({ page: 1 });
    check(
      "the index lists the published tutorial only",
      listedTutorials.tutorials.some((t) => t.slug === liveTutorial.slug) &&
        !listedTutorials.tutorials.some((t) => t.slug === draftTutorial.slug || t.slug === scheduledTutorial.slug),
    );

    const tutorialSlugs = await tutorials.getPublishedTutorialSlugs();
    check(
      "the sitemap source excludes draft and scheduled tutorials",
      tutorialSlugs.some((t) => t.slug === liveTutorial.slug) &&
        !tutorialSlugs.some((t) => t.slug === draftTutorial.slug || t.slug === scheduledTutorial.slug),
    );

    const tutorialTopics = await tutorials.listTopicsWithTutorials();
    check(
      "a topic appears in the tutorial listing only once something published sits under it",
      tutorialTopics.some((t) => t.slug === topic.slug && t.count === 1),
    );
    const draftOnlyTopic = await prisma.contentTopic.create({
      data: {
        slug: `${RUN}-draft-only`,
        name: `${RUN} draft only`,
        description: "A topic whose only tutorial is a draft, which must keep it out of the public listing.",
      },
      select: { id: true, slug: true },
    });
    createdTopics.push(draftOnlyTopic.id);
    await makeTutorial("hidden", "DRAFT", null, ["magic-ring"], draftOnlyTopic.id);
    check(
      "a topic with only draft tutorials stays out of the public topic listing",
      !(await tutorials.listTopicsWithTutorials()).some((t) => t.slug === draftOnlyTopic.slug),
    );
    check(
      "recent tutorials never include a draft",
      !(await tutorials.recentTutorials(20)).some((t) => t.slug === draftTutorial.slug),
    );

    const fullTutorial = await tutorials.getPublishedTutorial(liveTutorial.slug);
    check("a tutorial's steps survive the round trip", (fullTutorial?.steps.length ?? 0) === 3);
    check(
      "each step keeps a title and blocks",
      (fullTutorial?.steps ?? []).every((step) => step.title.length > 0 && step.blocks.length > 0),
    );

    const tutorialRelations = fullTutorial ? await tutorials.getTutorialRelations(fullTutorial) : null;
    check(
      "a tutorial finds patterns by the techniques it teaches",
      tutorialRelations !== null && tutorialRelations.products.some((p) => p.id === liveProductId),
    );
    check(
      "a tutorial never links to an unpublished pattern",
      tutorialRelations !== null && tutorialRelations.products.every((p) => !p.name.includes("draft")),
    );
    check(
      "a tutorial never links to a pattern it shares nothing with",
      tutorialRelations !== null && !tutorialRelations.products.some((p) => p.id === unrelatedProductId),
    );
    check(
      "a tutorial that teaches nothing specific links to no pattern",
      (await tutorials.getTutorialRelations({ ...fullTutorial!, teaches: [] })).products.length === 0,
    );
    check(
      "a tutorial never links to a draft tutorial as a sibling",
      tutorialRelations !== null && !tutorialRelations.tutorials.some((t) => t.slug === draftTutorial.slug),
    );

    // The mirror direction: an article points at the tutorials that teach what
    // it explains, and can never surface a draft one.
    const articleRelationsWithTutorials = await articles.getArticleRelations(fullArticle!);
    check(
      "an article finds the published tutorial teaching what it explains",
      articleRelationsWithTutorials.tutorials.some((t) => t.slug === liveTutorial.slug),
    );
    check(
      "an article never surfaces a draft tutorial",
      !articleRelationsWithTutorials.tutorials.some((t) => t.slug === draftTutorial.slug),
    );
    check(
      "an article never surfaces a tutorial scheduled for later",
      !articleRelationsWithTutorials.tutorials.some((t) => t.slug === scheduledTutorial.slug),
    );
    check(
      "an article that teaches nothing specific surfaces no tutorial",
      (await articles.getArticleRelations({ ...fullArticle!, teaches: [] })).tutorials.length === 0,
    );
    check(
      "the article page renders the tutorials it surfaces",
      read("src/app/(storefront)/blog/[slug]/page.tsx").includes("related.tutorials.length > 0"),
    );

    await prisma.tutorialProduct.create({ data: { tutorialId: liveTutorial.id, productId: liveProductId } });
    const mergedTutorial = await tutorials.getTutorialRelations(fullTutorial!);
    check(
      "a curated pattern that also matches by technique appears once on a tutorial",
      mergedTutorial.products.filter((p) => p.id === liveProductId).length === 1,
    );
    check(
      "a tutorial's linked patterns are never duplicated",
      new Set(mergedTutorial.products.map((p) => p.id)).size === mergedTutorial.products.length,
    );
    check(
      "every pattern linked from a tutorial has a usable slug",
      mergedTutorial.products.every((p) => typeof p.slug === "string" && p.slug.length > 0),
    );
    await prisma.tutorialProduct.deleteMany({ where: { tutorialId: liveTutorial.id } });

    check(
      "a time estimate is only claimed when one is stored",
      tutorials.tutorialTimeLabel(null, null) === null && tutorials.tutorialTimeLabel(20, 30) !== null,
    );
    check(
      "the structured-data duration is ISO 8601, or absent",
      tutorials.tutorialIsoDuration(null) === null && tutorials.tutorialIsoDuration(90) === "PT1H30M",
    );

    // ------------------------------------------------------- tutorial rules
    console.log("\nTutorial rules and authorization");
    const goodTutorial = {
      title: "A tutorial title long enough",
      slug: "a-valid-tutorial-slug",
      excerpt: "x".repeat(80),
      intro: "y".repeat(200),
      steps: "## One\n\n" + "z".repeat(220),
      outro: null,
      materials: ["A hook"],
      difficulty: "BEGINNER" as const,
      minutesMin: 10,
      minutesMax: 20,
      topicId: null,
      coverImageUrl: null,
      coverImageAlt: null,
      seoTitle: null,
      seoDescription: null,
      canonicalUrl: null,
      teaches: ["magic-ring"],
      tags: ["beginner"],
      productIds: [],
    };
    check("a complete tutorial passes validation", validations.tutorialInputSchema.safeParse(goodTutorial).success);
    check("a tutorial with no steps is refused", !validations.tutorialInputSchema.safeParse({ ...goodTutorial, steps: "too short" }).success);
    check("a thin tutorial introduction is refused", !validations.tutorialInputSchema.safeParse({ ...goodTutorial, intro: "short" }).success);
    check("a malformed tutorial slug is refused", !validations.tutorialInputSchema.safeParse({ ...goodTutorial, slug: "Not A Slug" }).success);
    check(
      "a tutorial technique outside the vocabulary is refused",
      !validations.tutorialInputSchema.safeParse({ ...goodTutorial, teaches: ["not-a-technique"] }).success,
    );
    check(
      "an unexpected tutorial field is refused outright",
      !validations.tutorialInputSchema.safeParse({ ...goodTutorial, status: "PUBLISHED" }).success,
    );
    check(
      "an impossible time range is refused",
      !validations.tutorialInputSchema.safeParse({ ...goodTutorial, minutesMin: 60, minutesMax: 10 }).success,
    );

    const tutorialActions = read("src/lib/actions/admin/tutorials.ts");
    const exportedTutorialActions = [...tutorialActions.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    check(
      "every tutorial action re-checks the admin itself",
      exportedTutorialActions.length >= 5 &&
        exportedTutorialActions.every((name) => {
          const from = tutorialActions.indexOf("export async function " + name);
          const next = tutorialActions.indexOf("export async function", from + 10);
          const body = next > 0 ? tutorialActions.slice(from, next) : tutorialActions.slice(from);
          return body.includes("await adminOrDenied()");
        }),
      exportedTutorialActions.join(", "),
    );
    check("creating a tutorial always makes a draft", tutorialActions.includes("// New tutorials are always drafts"));
    check(
      "publishing a tutorial enforces a length and step floor",
      tutorialActions.includes("TUTORIAL_PUBLISH_REQUIREMENTS.minWords") &&
        tutorialActions.includes("TUTORIAL_PUBLISH_REQUIREMENTS.minSteps"),
    );
    check(
      "tutorial content is parsed on the server, never trusted from the browser",
      tutorialActions.includes("parseAuthoringSteps(data.steps)") && tutorialActions.includes("parseAuthoringText(data.intro)"),
    );
    check("every tutorial action records an audit entry", (tutorialActions.match(/recordActivity\(/g) || []).length >= 5);
    check(
      "tutorial audit entries use the tutorial entity type",
      (tutorialActions.match(/entityType: "tutorial"/g) || []).length >= 5,
    );
    check(
      "admin tutorial pages live under /admin",
      exists("src/app/admin/content/tutorials/page.tsx") &&
        exists("src/app/admin/content/tutorials/new/page.tsx") &&
        exists("src/app/admin/content/tutorials/[id]/edit/page.tsx") &&
        exists("src/app/admin/content/tutorials/[id]/preview/page.tsx"),
    );
    check(
      "public tutorial routes exist",
      exists("src/app/(storefront)/tutorials/page.tsx") && exists("src/app/(storefront)/tutorials/[slug]/page.tsx"),
    );
    check(
      "the admin queries for tutorials are not reachable from a public route",
      read("src/lib/queries/admin-tutorials.ts").includes('import "server-only"'),
    );
    const tutorialPageSource = read("src/app/(storefront)/tutorials/[slug]/page.tsx");
    check("a missing or draft tutorial is a 404, not an empty page", tutorialPageSource.includes("notFound()"));
    check("the tutorial page emits HowTo structured data", tutorialPageSource.includes('"@type": "HowTo"'));
    check("its steps are HowToStep entries built from the real steps", tutorialPageSource.includes('"@type": "HowToStep"'));
    check(
      "tutorial structured data names the shop as publisher and invents no author",
      tutorialPageSource.includes('publisher: { "@id": entityIds.organization }') && !tutorialPageSource.includes("author:"),
    );
    check("tutorial structured data claims no rating or review", !/aggregateRating|reviewCount/.test(tutorialPageSource));
    check("the tutorial page uses the shared metadata helper", tutorialPageSource.includes("learnMetadata("));
    check("a missing tutorial is explicitly noindex", tutorialPageSource.includes("robots: { index: false, follow: false }"));
    check("the tutorial page shows breadcrumbs", tutorialPageSource.includes("<Breadcrumbs"));
    check(
      "the tutorial draft preview is admin-only and not indexable",
      read("src/app/admin/content/tutorials/[id]/preview/page.tsx").includes("robots: { index: false"),
    );
    const tutorialMeta = seo.learnMetadata({
      title: "T",
      description: "D",
      path: "/tutorials/how-to-make-a-magic-ring",
      type: "article",
    });
    check("a tutorial's canonical is its own path", tutorialMeta.alternates?.canonical === "/tutorials/how-to-make-a-magic-ring");
    check("a tutorial carries Open Graph and Twitter metadata", Boolean(tutorialMeta.openGraph) && Boolean(tutorialMeta.twitter));

    check("the sitemap lists the tutorial index", sitemapSource.includes("${base}/tutorials"));
    check(
      "the sitemap takes tutorials from the published-only query",
      sitemapSource.includes("getPublishedTutorialSlugs") && sitemapSource.includes("/tutorials/${tutorial.slug}"),
    );

    // ------------------------------------------------------- seeded tutorials
    console.log("\nThe tutorials that ship with it");
    check("five tutorials ship with the platform", tutorialSeeds.SEED_TUTORIALS.length === 5);
    check(
      "seeded tutorial slugs are unique",
      new Set(tutorialSeeds.SEED_TUTORIALS.map((t) => t.slug)).size === tutorialSeeds.SEED_TUTORIALS.length,
    );
    const seedScriptSource = read("scripts/seed-content.ts");
    const tutorialPublishedMentions = seedScriptSource
      .split("\n")
      .filter((line) => line.includes('status: "PUBLISHED"'));
    check(
      "the seed script writes tutorial drafts only",
      seedScriptSource.includes('status: "DRAFT"') && tutorialPublishedMentions.every((line) => line.includes("count(")),
    );
    check(
      "the seed script never overwrites a published tutorial",
      seedScriptSource.includes('existing.status === "PUBLISHED"'),
    );

    for (const seed of tutorialSeeds.SEED_TUTORIALS) {
      const intro = authoring.parseAuthoringText(seed.intro);
      const steps = authoring.parseAuthoringSteps(seed.steps);
      const outro = seed.outro ? authoring.parseAuthoringText(seed.outro) : [];
      const all = blocks.tutorialBlocks(intro, steps, outro);
      const words = blocks.countWords(all);
      const plain = blocks.blocksToPlainText(all);

      check(
        `${seed.slug}: is substantial (${words} words, ${steps.length} steps)`,
        words >= 900 && words <= 1600 && steps.length >= 5,
      );
      check(`${seed.slug}: has a slug a URL can carry`, /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(seed.slug));
      check(`${seed.slug}: has a real summary`, seed.excerpt.length >= 120 && seed.excerpt.length <= 320);
      check(`${seed.slug}: has an SEO description of a usable length`, (seed.seoDescription ?? "").length >= 80);
      check(`${seed.slug}: every step has a title and content`, steps.every((s) => s.title.length > 2 && s.blocks.length > 0));
      check(`${seed.slug}: has an introduction and a closing section`, intro.length > 0 && outro.length > 0);
      check(`${seed.slug}: says what to have to hand`, seed.materials.length > 0);
      check(
        `${seed.slug}: techniques come from the vocabulary`,
        seed.teaches.every((slug) => (TECHNIQUE_SLUGS as readonly string[]).includes(slug)),
      );
      check(`${seed.slug}: belongs to a seeded topic`, seeds.SEED_TOPICS.some((t) => t.slug === seed.topicSlug));
      check(
        `${seed.slug}: links to other pages on this site`,
        /\]\(\/(resources|blog|tutorials|shop|learn)/.test(`${seed.intro}${seed.steps}${seed.outro ?? ""}`),
      );
      check(
        `${seed.slug}: every diagram it names exists`,
        [...`${seed.intro}${seed.steps}${seed.outro ?? ""}`.matchAll(/:: diagram ([a-z0-9-]+)/g)].every((m) =>
          diagrams.hasDiagram(m[1]),
        ),
      );
      check(`${seed.slug}: makes no unsupported claim`, !/(studies show|experts agree|research proves|most crocheters|everyone should|scientifically)/i.test(plain));
      check(`${seed.slug}: opens without filler`, !/(in todays world|in this day and age|without further ado)/i.test(plain.replace(/[^a-zA-Z ]/g, "")));
      check(
        `${seed.slug}: claims a time range only if it is coherent`,
        seed.minutesMin === null || seed.minutesMax === null || seed.minutesMin <= seed.minutesMax,
      );
    }

    // Internal links must point at routes that exist, or the ecosystem is a
    // set of promises rather than a set of pages.
    const tutorialSlugSet = new Set(tutorialSeeds.SEED_TUTORIALS.map((t) => t.slug));
    const articleSlugSet = new Set(seeds.SEED_ARTICLES.map((a) => a.slug));
    const badLinks: string[] = [];
    for (const seed of tutorialSeeds.SEED_TUTORIALS) {
      const body = `${seed.intro}${seed.steps}${seed.outro ?? ""}`;
      for (const match of body.matchAll(/\]\((\/[a-z0-9/-]+)\)/g)) {
        const href = match[1];
        if (href.startsWith("/tutorials/") && !tutorialSlugSet.has(href.slice("/tutorials/".length))) badLinks.push(href);
        else if (href.startsWith("/blog/") && !articleSlugSet.has(href.slice("/blog/".length))) badLinks.push(href);
        else if (href.startsWith("/resources/") && !resources.resourceBySlug(href.slice("/resources/".length))) badLinks.push(href);
      }
    }
    check("every internal link in a tutorial points at something that exists", badLinks.length === 0, badLinks.join(", "));
    check(
      "no tutorial links to itself",
      tutorialSeeds.SEED_TUTORIALS.every((seed) => !`${seed.intro}${seed.steps}${seed.outro ?? ""}`.includes(`(/tutorials/${seed.slug})`)),
    );
    check(
      "featured patterns are named by slug, never by database id",
      tutorialSeeds.SEED_TUTORIALS.every((seed) =>
        (seed.productSlugs ?? []).every((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)),
      ),
    );

    // ------------------------------------------------------------ seed quality
    console.log("\nThe articles that ship with it");
    for (const seed of seeds.SEED_ARTICLES) {
      const body = authoring.parseAuthoringText(seed.body);
      const words = blocks.countWords(body);
      const sections = blocks.outline(body).length;
      const plain = blocks.blocksToPlainText(body);
      check(seed.slug + ": is substantial (" + words + " words, " + sections + " sections)", words >= 800 && sections >= 5);
      check(seed.slug + ": has a real summary", seed.excerpt.length >= 120 && seed.excerpt.length <= 320);
      check(seed.slug + ": links to other pages on this site", /\]\(\/(resources|blog|shop|learn)/.test(seed.body));
      check(seed.slug + ": techniques come from the vocabulary", seed.teaches.every((slug) => (TECHNIQUE_SLUGS as readonly string[]).includes(slug)));
      check(seed.slug + ": belongs to a seeded topic", seeds.SEED_TOPICS.some((t) => t.slug === seed.topicSlug));
      check(seed.slug + ": makes no unsupported claim", !/(studies show|experts agree|research proves|scientifically)/i.test(plain));
      check(seed.slug + ": opens without filler", !/(in todays world|in this day and age|without further ado)/i.test(plain.replace(/[^a-zA-Z ]/g, "")));
      check(seed.slug + ": has a real SEO description", (seed.seoDescription || "").length >= 80);
    }
    check("seed slugs are unique", new Set(seeds.SEED_ARTICLES.map((a) => a.slug)).size === seeds.SEED_ARTICLES.length);
    const seedScript = read("scripts/seed-content.ts");
    const publishedMentions = seedScript.split("\n").filter((line) => line.includes('status: "PUBLISHED"'));
    check("the seed script writes drafts only, never publishes", seedScript.includes('status: "DRAFT"') && publishedMentions.every((line) => line.includes("count(")), publishedMentions.join(" | "));
    check("the seed script never overwrites a published article", seedScript.includes("existing.status === \"PUBLISHED\""));

    // ------------------------------------------------------------ homepage
    console.log("\nThe homepage is untouched");
    const homepage = read("src/app/(storefront)/page.tsx");
    check("the homepage does not import the learning section", !/learn|resources|content\//i.test(homepage));
    check(
      "no home component mentions the blog or resources",
      !/\/learn|\/resources|\/blog/.test(read("src/components/home/figma/hero-band.tsx") + read("src/components/home/brand-story.tsx")),
    );
  } finally {
    if (createdTutorials.length > 0) await prisma.tutorial.deleteMany({ where: { id: { in: createdTutorials } } });
    if (createdArticles.length > 0) await prisma.article.deleteMany({ where: { id: { in: createdArticles } } });
    if (createdTopics.length > 0) await prisma.contentTopic.deleteMany({ where: { id: { in: createdTopics } } });
    if (createdProducts.length > 0) await prisma.product.deleteMany({ where: { id: { in: createdProducts } } });
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
    const leftovers =
      (await prisma.product.count({ where: { slug: { startsWith: RUN } } })) +
      (await prisma.category.count({ where: { slug: { startsWith: RUN } } })) +
      (await prisma.article.count({ where: { slug: { startsWith: RUN } } })) +
      (await prisma.tutorial.count({ where: { slug: { startsWith: RUN } } })) +
      (await prisma.contentTopic.count({ where: { slug: { startsWith: RUN } } }));
    check("fixtures removed", leftovers === 0, String(leftovers));
    check("no outbound network request was attempted", outbound === 0, String(outbound));
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error("\nHarness crashed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  });
