import { parseBlocks, parseSteps, type Block, type Inline, type TutorialStep } from "@/lib/content/blocks";

/**
 * The authoring format: readable text in, typed blocks out.
 *
 * Writing an article as raw JSON is miserable, and a rich-text editor would
 * mean storing HTML — the one thing this content model exists to avoid. So the
 * admin writes a small, strict line format instead, and this turns it into the
 * same blocks everything else consumes. Nothing it emits can be markup: the
 * output is data, and the renderer decides what becomes an element.
 *
 * It is deliberately not markdown. There is no raw HTML passthrough, no image
 * syntax that can point at a script, no table of edge cases — only the handful
 * of shapes these articles actually need:
 *
 *     ## Heading                     a section heading
 *     ### Subheading                 a subheading
 *     - item                         a bullet list (consecutive lines)
 *     1. item                        a numbered list (consecutive lines)
 *     > tip: text                    a callout; tone is tip, note or warning
 *     | a | b |                      a table row; the first row is the header
 *     :: diagram magic-ring          a stitch diagram by name
 *     :: image /path.jpg | alt text  an image with required alt text
 *     ```                            a pattern excerpt, one instruction a line
 *     anything else                  a paragraph
 *
 * Inline, within any line: **bold**, `code`, and [label](/internal/path).
 *
 * `toAuthoringText` is the inverse, so the editor can load a stored article
 * back into the same text an author would have written.
 */

const CALLOUT_PREFIX = /^>\s*(tip|note|warning)\s*:\s*(.+)$/i;
const HEADING = /^(#{2,3})\s+(.+)$/;
const BULLET = /^[-*]\s+(.+)$/;
const NUMBERED = /^\d+[.)]\s+(.+)$/;
const TABLE_ROW = /^\|(.+)\|$/;
const DIRECTIVE = /^::\s*(diagram|image)\s+(.+)$/i;

/** `**bold**`, `` `code` `` and `[label](/path)`, in one pass. */
export function parseInlineText(line: string): Inline[] {
  const nodes: Inline[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let index = 0;

  for (let match = pattern.exec(line); match !== null; match = pattern.exec(line)) {
    if (match.index > index) nodes.push(line.slice(index, match.index));
    if (match[1] !== undefined) nodes.push({ text: match[1], strong: true });
    else if (match[2] !== undefined) nodes.push({ text: match[2], code: true });
    else if (match[3] !== undefined && match[4] !== undefined) nodes.push({ text: match[3], href: match[4] });
    index = match.index + match[0].length;
  }

  if (index < line.length) nodes.push(line.slice(index));
  return nodes.length > 0 ? nodes : [line];
}

/** Turn authored text into blocks. Invalid pieces are dropped by `parseBlocks`. */
export function parseAuthoringText(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const draft: unknown[] = [];

  let patternLines: string[] | null = null;
  let listItems: Inline[][] = [];
  let listOrdered = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      draft.push({ type: "list", ordered: listOrdered, items: listItems });
      listItems = [];
    }
  };
  const flushTable = () => {
    if (tableRows.length > 0) {
      const [columns, ...rows] = tableRows;
      if (rows.length > 0) draft.push({ type: "table", columns, rows });
      tableRows = [];
    }
  };
  const flushAll = () => {
    flushList();
    flushTable();
  };

  for (const raw of lines) {
    const line = raw.trim();

    // A fenced block is a pattern excerpt: its lines are kept verbatim.
    if (line.startsWith("```")) {
      if (patternLines === null) {
        flushAll();
        patternLines = [];
      } else {
        if (patternLines.length > 0) draft.push({ type: "pattern", lines: patternLines });
        patternLines = null;
      }
      continue;
    }
    if (patternLines !== null) {
      if (line.length > 0) patternLines.push(line);
      continue;
    }

    if (line.length === 0) {
      flushAll();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      draft.push({ type: "heading", level: heading[1].length === 3 ? 3 : 2, text: heading[2] });
      continue;
    }

    const callout = CALLOUT_PREFIX.exec(line);
    if (callout) {
      flushAll();
      draft.push({ type: "callout", tone: callout[1].toLowerCase(), content: parseInlineText(callout[2]) });
      continue;
    }

    const directive = DIRECTIVE.exec(line);
    if (directive) {
      flushAll();
      const kind = directive[1].toLowerCase();
      if (kind === "diagram") {
        const [name, ...caption] = directive[2].split("|").map((part) => part.trim());
        draft.push({ type: "diagram", name, ...(caption.length > 0 ? { caption: caption.join(" | ") } : {}) });
      } else {
        const [url, alt, caption] = directive[2].split("|").map((part) => part.trim());
        draft.push({ type: "image", url, alt, ...(caption ? { caption } : {}) });
      }
      continue;
    }

    const row = TABLE_ROW.exec(line);
    if (row) {
      flushList();
      const cells = row[1].split("|").map((cell) => cell.trim());
      // A separator row (|---|---|) is layout, not content.
      if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) tableRows.push(cells);
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      flushTable();
      if (listOrdered && listItems.length > 0) flushList();
      listOrdered = false;
      listItems.push(parseInlineText(bullet[1]));
      continue;
    }

    const numbered = NUMBERED.exec(line);
    if (numbered) {
      flushTable();
      if (!listOrdered && listItems.length > 0) flushList();
      listOrdered = true;
      listItems.push(parseInlineText(numbered[1]));
      continue;
    }

    flushAll();
    draft.push({ type: "paragraph", content: parseInlineText(line) });
  }

  if (patternLines !== null && patternLines.length > 0) draft.push({ type: "pattern", lines: patternLines });
  flushAll();
  // Validated on the way out, so the editor can never store a block shape the
  // renderer does not accept.
  return parseBlocks(draft);
}

const inlineToText = (nodes: Inline[]): string =>
  nodes
    .map((node) => {
      if (typeof node === "string") return node;
      if (node.href) return `[${node.text}](${node.href})`;
      if (node.strong) return `**${node.text}**`;
      if (node.code) return `\`${node.text}\``;
      return node.text;
    })
    .join("");

/** Blocks back to authoring text, so the editor round-trips what it saved. */
export function toAuthoringText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `${"#".repeat(block.level)} ${block.text}`;
        case "paragraph":
          return inlineToText(block.content);
        case "list":
          return block.items
            .map((item, index) => (block.ordered ? `${index + 1}. ${inlineToText(item)}` : `- ${inlineToText(item)}`))
            .join("\n");
        case "callout":
          return `> ${block.tone}: ${inlineToText(block.content)}`;
        case "table":
          return [block.columns, ...block.rows].map((row) => `| ${row.join(" | ")} |`).join("\n");
        case "image":
          return `:: image ${block.url} | ${block.alt}${block.caption ? ` | ${block.caption}` : ""}`;
        case "diagram":
          return `:: diagram ${block.name}${block.caption ? ` | ${block.caption}` : ""}`;
        case "pattern":
          return ["```", ...block.lines, "```"].join("\n");
      }
    })
    .join("\n\n");
}

/**
 * Tutorial steps, from the same authoring format.
 *
 * A `## Heading` starts a step and becomes its title; everything until the next
 * one is that step's content. No second syntax to learn, and the steps a
 * `HowTo` emits are the same ones the page numbers.
 *
 * Anything written before the first heading is dropped rather than folded into
 * step one — a step without a title is not a step, and the intro field is where
 * that text belongs.
 */
export function parseAuthoringSteps(source: string): TutorialStep[] {
  const blocks = parseAuthoringText(source);
  const draft: { title: string; blocks: Block[] }[] = [];

  for (const block of blocks) {
    if (block.type === "heading" && block.level === 2) {
      draft.push({ title: block.text, blocks: [] });
      continue;
    }
    draft.at(-1)?.blocks.push(block);
  }

  // Validated on the way out, exactly as blocks are.
  return parseSteps(draft);
}

/** Steps back to authoring text, so the editor round-trips what it saved. */
export function toAuthoringSteps(steps: TutorialStep[]): string {
  return steps.map((step) => `## ${step.title}\n\n${toAuthoringText(step.blocks)}`).join("\n\n");
}

/** The syntax, for the editor's own help text. */
export const AUTHORING_HELP: { syntax: string; makes: string }[] = [
  { syntax: "## Heading", makes: "A section heading (also appears in the article's contents list)" },
  { syntax: "### Subheading", makes: "A subheading inside a section" },
  { syntax: "- item", makes: "A bullet list — one line per item" },
  { syntax: "1. item", makes: "A numbered list" },
  { syntax: "> tip: text", makes: "A callout. Use tip, note or warning" },
  { syntax: "| a | b |", makes: "A table row. The first row is the header" },
  { syntax: ":: diagram magic-ring", makes: "A stitch diagram by name" },
  { syntax: ":: image /path.jpg | alt text", makes: "An image. Alt text is required" },
  { syntax: "``` … ```", makes: "A pattern excerpt — one instruction per line, kept exactly as typed" },
  { syntax: "**bold**, `code`, [label](/path)", makes: "Inline emphasis, notation and links" },
];
