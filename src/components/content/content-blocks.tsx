import Image from "next/image";
import Link from "next/link";
import { Info, Lightbulb, TriangleAlert } from "lucide-react";

import { StitchDiagram, hasDiagram } from "@/components/content/diagrams";
import { ReferenceTable } from "@/components/content/reference-table";
import { headingId, isExternalHref, type Block, type CalloutTone, type Inline } from "@/lib/content/blocks";
import { cn } from "@/lib/utils";

/**
 * Typed content blocks, rendered as the site's own components.
 *
 * Nothing here uses `dangerouslySetInnerHTML`, because nothing stored is
 * markup: a block is data and this decides what element it becomes. That is
 * what makes editor input safe by construction rather than by sanitising.
 *
 * Server components — an article ships no JavaScript to read.
 *
 * Set in the Plum Studio article style (Figma 27:2773): Bricolage 36/40 section
 * headings, Figtree 16/26 body, plum bullets and links, 20px-radius callouts
 * and media.
 */

const CALLOUT_STYLE: Record<CalloutTone, { icon: typeof Info; className: string; label: string }> = {
  tip: { icon: Lightbulb, className: "border-transparent bg-plum-100", label: "Tip" },
  note: { icon: Info, className: "border-pl-line bg-pl-subtle", label: "Note" },
  warning: { icon: TriangleAlert, className: "border-transparent bg-pl-tint-templates", label: "Watch out" },
};

function InlineText({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (typeof node === "string") return <span key={index}>{node}</span>;

        const content = node.code ? (
          <code className="rounded-[6px] bg-pl-sunken px-1 py-0.5 font-mono text-[0.9em] text-pl-text">
            {node.text}
          </code>
        ) : node.strong ? (
          <strong className="font-bold text-pl-text">{node.text}</strong>
        ) : (
          node.text
        );

        if (!node.href) return <span key={index}>{content}</span>;

        // External links are marked as such and cannot hand the new tab a
        // reference back to this one.
        return isExternalHref(node.href) ? (
          <a
            key={index}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="pl-focus rounded-sm text-plum-500 underline underline-offset-4 hover:text-plum-800"
          >
            {content}
          </a>
        ) : (
          <Link
            key={index}
            href={node.href}
            className="pl-focus rounded-sm text-plum-500 underline underline-offset-4 hover:text-plum-800"
          >
            {content}
          </Link>
        );
      })}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const id = headingId(block.text);
      return block.level === 2 ? (
        <h2 id={id} className="pl-display pl-h2 scroll-mt-24 pt-4">
          {block.text}
        </h2>
      ) : (
        <h3 id={id} className="pl-h3 scroll-mt-24 pt-2">
          {block.text}
        </h3>
      );
    }

    case "paragraph":
      return (
        <p className="pl-body text-pl-text">
          <InlineText nodes={block.content} />
        </p>
      );

    case "list": {
      const className = "pl-body space-y-2 pl-5 text-pl-text marker:text-plum-500";
      return block.ordered ? (
        <ol className={cn(className, "list-decimal")}>
          {block.items.map((item, index) => (
            <li key={index}>
              <InlineText nodes={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className={cn(className, "list-disc")}>
          {block.items.map((item, index) => (
            <li key={index}>
              <InlineText nodes={item} />
            </li>
          ))}
        </ul>
      );
    }

    case "callout": {
      const style = CALLOUT_STYLE[block.tone];
      const Icon = style.icon;
      return (
        <aside className={cn("flex gap-3 rounded-[20px] border px-5 py-4", style.className)}>
          <Icon className="mt-0.5 size-5 shrink-0 text-plum-500" aria-hidden />
          <div className="min-w-0 text-sm leading-[22px] text-pl-muted">
            <p className="text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text">
              {block.title ?? style.label}
            </p>
            <p className="mt-1">
              <InlineText nodes={block.content} />
            </p>
          </div>
        </aside>
      );
    }

    case "table":
      return (
        <figure>
          <ReferenceTable
            caption={block.caption ?? "Table"}
            columns={block.columns.map((label) => ({ label }))}
          >
            {block.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={cn("py-3 pr-4", cellIndex === 0 ? "font-bold text-pl-text" : "text-pl-muted")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </ReferenceTable>
          {block.caption && (
            <figcaption className="mt-2 text-[13px] leading-[18px] font-medium text-pl-muted">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );

    case "image":
      return (
        <figure>
          <div className="relative overflow-hidden rounded-[20px] bg-pl-tint-crochet">
            <Image
              src={block.url}
              alt={block.alt}
              width={block.width ?? 1200}
              height={block.height ?? 800}
              sizes="(min-width: 768px) 42rem, 100vw"
              className="h-auto w-full object-cover"
            />
          </div>
          {block.caption && (
            <figcaption className="mt-2 text-[13px] leading-[18px] font-medium text-pl-muted">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );

    case "pattern":
      // A pattern excerpt: mono, one instruction a line, and not a code
      // element — this is craft notation, not source code.
      return (
        <figure className="overflow-x-auto rounded-[12px] bg-pl-sunken px-4 py-4">
          <pre className="font-mono text-[0.8125rem] leading-relaxed text-pl-text">
            {block.lines.join("\n")}
          </pre>
          {block.caption && (
            <figcaption className="mt-2 text-[13px] leading-[18px] font-medium text-pl-muted">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );

    case "diagram":
      // A named diagram that does not exist renders nothing rather than a gap.
      return hasDiagram(block.name) ? <StitchDiagram name={block.name} caption={block.caption} /> : null;
  }
}

export function ContentBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}
