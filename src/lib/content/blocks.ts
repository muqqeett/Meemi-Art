/**
 * The content model behind articles and tutorials.
 *
 * Content is an ordered list of typed blocks — never HTML and never markdown.
 * That is a security decision before it is an editorial one: nothing an editor
 * saves can become markup on a public page, so there is no sanitiser to get
 * wrong and no `dangerouslySetInnerHTML` anywhere in the reading experience.
 * It is also what lets the blog use the same typography, links and callouts as
 * the rest of the site instead of a second, parallel set of styles.
 *
 * Pure and dependency-free: the admin editor validates with `parseBlocks`
 * before saving, the public page validates again on the way out, and the test
 * harness checks both against the same definitions.
 */

/** A run of text, optionally a link, optionally emphasised. */
export type Inline =
  | string
  | {
      text: string;
      /** Internal path ("/tutorials/magic-ring") or absolute https URL. */
      href?: string;
      strong?: boolean;
      /** Rendered in the mono face — stitch counts, abbreviations, notation. */
      code?: boolean;
    };

export type CalloutTone = "tip" | "note" | "warning";

export type Block =
  | { type: "paragraph"; content: Inline[] }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; ordered?: boolean; items: Inline[][] }
  | { type: "callout"; tone: CalloutTone; title?: string; content: Inline[] }
  | { type: "table"; caption?: string; columns: string[]; rows: string[][] }
  /** A slot for real instructional photography. Never a decorative stock image. */
  | { type: "image"; url: string; alt: string; caption?: string; width?: number; height?: number }
  /** A hand-authored stitch diagram, by name; see `components/content/diagrams`. */
  | { type: "diagram"; name: string; caption?: string }
  /** An excerpt of a crochet pattern, one instruction per line, set in mono. */
  | { type: "pattern"; lines: string[]; caption?: string };

export type BlockType = Block["type"];

export const BLOCK_TYPES: BlockType[] = ["paragraph", "heading", "list", "callout", "table", "image", "diagram", "pattern"];

const CALLOUT_TONES: CalloutTone[] = ["tip", "note", "warning"];

/**
 * A link a content block may point at.
 *
 * Internal paths keep the reader on the site. An absolute `https` URL is
 * allowed because a genuine reference sometimes lives elsewhere, and the
 * renderer marks those up as external. Everything else — `javascript:`,
 * protocol-relative, anything with whitespace — is dropped rather than
 * rendered as an unlinked surprise.
 */
export function safeContentHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) return null;
  if (/[\s<>"']/.test(value)) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/")) return value;
  if (/^https:\/\/[^/]+\.[^/]+/i.test(value)) return value;
  return null;
}

export function isExternalHref(href: string): boolean {
  return href.startsWith("https://");
}

const text = (value: unknown, max = 2000): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
};

function parseInline(value: unknown): Inline | null {
  if (typeof value === "string") return text(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const node = value as Record<string, unknown>;
  const body = text(node.text);
  if (!body) return null;
  const href = safeContentHref(node.href);
  const out: Exclude<Inline, string> = { text: body };
  if (href) out.href = href;
  if (node.strong === true) out.strong = true;
  if (node.code === true) out.code = true;
  return out;
}

function parseInlines(value: unknown): Inline[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parsed = value.map(parseInline).filter((node): node is Inline => node !== null);
  return parsed.length > 0 ? parsed : null;
}

/**
 * Validate stored or submitted content.
 *
 * Unknown block types and malformed blocks are dropped rather than throwing:
 * one bad block must not take a published page down. What survives is exactly
 * what the renderer knows how to draw.
 */
export function parseBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];
  const blocks: Block[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const node = raw as Record<string, unknown>;

    switch (node.type) {
      case "paragraph": {
        const content = parseInlines(node.content);
        if (content) blocks.push({ type: "paragraph", content });
        break;
      }
      case "heading": {
        const heading = text(node.text, 200);
        const level = node.level === 3 ? 3 : 2;
        if (heading) blocks.push({ type: "heading", level, text: heading });
        break;
      }
      case "list": {
        if (!Array.isArray(node.items)) break;
        const items = node.items.map(parseInlines).filter((item): item is Inline[] => item !== null);
        if (items.length > 0) blocks.push({ type: "list", ordered: node.ordered === true, items });
        break;
      }
      case "callout": {
        const content = parseInlines(node.content);
        const tone = CALLOUT_TONES.includes(node.tone as CalloutTone) ? (node.tone as CalloutTone) : "note";
        if (content) {
          const title = text(node.title, 120);
          blocks.push({ type: "callout", tone, content, ...(title ? { title } : {}) });
        }
        break;
      }
      case "table": {
        if (!Array.isArray(node.columns) || !Array.isArray(node.rows)) break;
        const columns = node.columns
          .map((column) => text(column, 120))
          .filter((column): column is string => column !== null);
        const rows = node.rows
          .filter(Array.isArray)
          .map((row) => (row as unknown[]).map((cell) => text(cell, 300) ?? ""))
          .filter((row) => row.length === columns.length);
        if (columns.length > 0 && rows.length > 0) {
          const caption = text(node.caption, 200);
          blocks.push({ type: "table", columns, rows, ...(caption ? { caption } : {}) });
        }
        break;
      }
      case "image": {
        const url = safeContentHref(node.url);
        const alt = text(node.alt, 300);
        // Alt text is required, not optional: an instructional image nobody can
        // describe is not instructional.
        if (url && alt) {
          const caption = text(node.caption, 300);
          blocks.push({
            type: "image",
            url,
            alt,
            ...(caption ? { caption } : {}),
            ...(typeof node.width === "number" ? { width: node.width } : {}),
            ...(typeof node.height === "number" ? { height: node.height } : {}),
          });
        }
        break;
      }
      case "pattern": {
        if (!Array.isArray(node.lines)) break;
        const lines = node.lines.map((line) => text(line, 300)).filter((line): line is string => line !== null);
        if (lines.length > 0) {
          const caption = text(node.caption, 300);
          blocks.push({ type: "pattern", lines, ...(caption ? { caption } : {}) });
        }
        break;
      }
      case "diagram": {
        const name = text(node.name, 80);
        if (name) {
          const caption = text(node.caption, 300);
          blocks.push({ type: "diagram", name, ...(caption ? { caption } : {}) });
        }
        break;
      }
      default:
        break;
    }
  }

  return blocks;
}

/**
 * A tutorial step: a title and the blocks that explain it.
 *
 * Steps are their own shape rather than a convention inside `Block[]` because
 * their order is the instruction. A reader following step 4 needs to know it is
 * step 4, structured data needs a `HowToStep`, and the publish rule needs to
 * count them — none of which survives if a step is only a heading that happens
 * to come before some paragraphs.
 */
export type TutorialStep = { title: string; blocks: Block[] };

/** Validate stored or submitted steps. Malformed steps are dropped, as blocks are. */
export function parseSteps(value: unknown): TutorialStep[] {
  if (!Array.isArray(value)) return [];
  const steps: TutorialStep[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const node = raw as Record<string, unknown>;
    const title = text(node.title, 200);
    const blocks = parseBlocks(node.blocks);
    // A step with a title and nothing under it is an empty promise, not a step.
    if (title && blocks.length > 0) steps.push({ title, blocks });
  }
  return steps;
}

/** Everything a tutorial is made of, in reading order — for word counts and text. */
export function tutorialBlocks(intro: Block[], steps: TutorialStep[], outro: Block[]): Block[] {
  return [
    ...intro,
    ...steps.flatMap((step): Block[] => [{ type: "heading", level: 2, text: step.title }, ...step.blocks]),
    ...outro,
  ];
}

/** The words a reader actually reads, for reading time and excerpting. */
export function blocksToPlainText(blocks: Block[]): string {
  const inline = (nodes: Inline[]) => nodes.map((node) => (typeof node === "string" ? node : node.text)).join(" ");
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
        case "callout":
          return inline(block.content);
        case "heading":
          return block.text;
        case "list":
          return block.items.map(inline).join(" ");
        case "table":
          return [block.caption ?? "", ...block.columns, ...block.rows.flat()].join(" ");
        case "pattern":
          return [block.caption ?? "", ...block.lines].join(" ");
        case "image":
        case "diagram":
          return block.caption ?? "";
      }
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words per minute for ordinary prose. Deliberately unglamorous. */
export const READING_WORDS_PER_MINUTE = 200;

export function readingMinutes(blocks: Block[]): number {
  return Math.max(1, Math.round(countWords(blocks) / READING_WORDS_PER_MINUTE));
}

export function countWords(blocks: Block[]): number {
  return blocksToPlainText(blocks).split(/\s+/).filter(Boolean).length;
}

/** A stable anchor for a heading, so a section can be linked to directly. */
export function headingId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** The `h2`s of a piece, for a table of contents. */
export function outline(blocks: Block[]): { id: string; text: string }[] {
  return blocks
    .filter((block): block is Extract<Block, { type: "heading" }> => block.type === "heading" && block.level === 2)
    .map((block) => ({ id: headingId(block.text), text: block.text }));
}
