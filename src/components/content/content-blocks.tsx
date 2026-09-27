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
 */

const CALLOUT_STYLE: Record<CalloutTone, { icon: typeof Info; className: string; label: string }> = {
  tip: { icon: Lightbulb, className: "border-brand-200 bg-brand-50/60", label: "Tip" },
  note: { icon: Info, className: "border-border bg-surface-alt/70", label: "Note" },
  warning: { icon: TriangleAlert, className: "border-warning/30 bg-warning/8", label: "Watch out" },
};

function InlineText({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (typeof node === "string") return <span key={index}>{node}</span>;

        const content = node.code ? (
          <code className="rounded-xs bg-surface-alt px-1 py-0.5 font-mono text-[0.9em] text-foreground">
            {node.text}
          </code>
        ) : node.strong ? (
          <strong className="font-semibold text-foreground">{node.text}</strong>
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
            className="text-brand-700 underline underline-offset-4 hover:text-brand-800"
          >
            {content}
          </a>
        ) : (
          <Link
            key={index}
            href={node.href}
            className="text-brand-700 underline underline-offset-4 hover:text-brand-800"
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
        <h2 id={id} className="heading-sub scroll-mt-24 pt-4">
          {block.text}
        </h2>
      ) : (
        <h3 id={id} className="scroll-mt-24 pt-2 text-base font-semibold text-foreground">
          {block.text}
        </h3>
      );
    }

    case "paragraph":
      return (
        <p className="text-body leading-relaxed">
          <InlineText nodes={block.content} />
        </p>
      );

    case "list": {
      const className = "text-body space-y-2 pl-5 leading-relaxed";
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
        <aside className={cn("flex gap-3 rounded-sm border px-4 py-3.5", style.className)}>
          <Icon className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
          <div className="text-body min-w-0 text-sm leading-relaxed">
            <p className="font-medium text-foreground">{block.title ?? style.label}</p>
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
                  <td key={cellIndex} className={cn("py-2.5 pr-4", cellIndex === 0 ? "text-foreground" : "text-body")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </ReferenceTable>
          {block.caption && <figcaption className="text-body mt-2 text-xs">{block.caption}</figcaption>}
        </figure>
      );

    case "image":
      return (
        <figure>
          <div className="relative overflow-hidden rounded-sm border border-border bg-surface-alt">
            <Image
              src={block.url}
              alt={block.alt}
              width={block.width ?? 1200}
              height={block.height ?? 800}
              sizes="(min-width: 768px) 42rem, 100vw"
              className="h-auto w-full object-cover"
            />
          </div>
          {block.caption && <figcaption className="text-body mt-2 text-xs">{block.caption}</figcaption>}
        </figure>
      );

    case "pattern":
      // A pattern excerpt: mono, one instruction a line, and not a code
      // element — this is craft notation, not source code.
      return (
        <figure className="overflow-x-auto rounded-sm border border-border bg-surface-alt/70 px-4 py-4">
          <pre className="font-mono text-[0.8125rem] leading-relaxed text-foreground">
            {block.lines.join("\n")}
          </pre>
          {block.caption && <figcaption className="text-body mt-2 text-xs">{block.caption}</figcaption>}
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
