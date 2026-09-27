import Link from "next/link";

import { LearnPage, LearnSection, LearnProse } from "@/components/content/learn-page";
import { ReferenceTable } from "@/components/content/reference-table";
import { RelatedPatterns } from "@/components/content/related-patterns";
import { HOOK_ANATOMY, HOOK_SIZES, HOOK_TABLE_NOTES, formatHookMm } from "@/lib/crochet/hooks";
import { yarnWeightByNumber } from "@/lib/crochet/yarn-weights";
import { resourceBySlug } from "@/lib/content/resources";
import { learnMetadata } from "@/lib/content/seo";
import { featuredProducts } from "@/lib/queries/content-links";

const resource = resourceBySlug("hook-sizes")!;

export const metadata = learnMetadata({
  title: "Crochet hook sizes — mm, US and UK conversion chart",
  description: resource.description,
  path: "/resources/hook-sizes",
});

/**
 * The hook conversion table, plus what the table cannot tell you.
 *
 * Millimetres lead every row because they are the measurement; the letters are
 * a convention that varies by brand. The page says so rather than implying
 * that matching a letter guarantees matching a pattern's gauge.
 */
export default async function HookSizesPage() {
  const patterns = await featuredProducts();

  return (
    <LearnPage
      eyebrow="Reference"
      title="Crochet hook sizes, converted and explained"
      intro="A pattern might call for a 4.0 mm hook, a G-6, or an old UK 8 — and all three can mean the same tool. This is the conversion, the yarn each size usually suits, and why the hook a pattern names is a starting point rather than an instruction."
      crumbs={[{ label: "Learn", href: "/learn" }, { label: "Hook sizes" }]}
      contents={[
        "Conversion chart",
        "Why the same hook has three names",
        "Choosing a hook for your yarn",
        "The parts of a hook",
        "When to change hook size",
      ]}
    >
      <LearnSection
        title="Conversion chart"
        lead="Millimetres are the real measurement — the diameter of the shaft, which is what decides the size of your stitches. Everything else is a naming convention."
      >
        <ReferenceTable
          caption="Crochet hook sizes in millimetres with US and old UK equivalents"
          columns={[
            { label: "Metric", numeric: true },
            { label: "US", numeric: true },
            { label: "Old UK", numeric: true },
            { label: "Usual yarn" },
            { label: "Typically used for" },
          ]}
        >
          {HOOK_SIZES.map((hook) => (
            <tr key={hook.mm}>
              <td className="py-2.5 pr-4 font-medium text-foreground tabular-nums">{formatHookMm(hook.mm)} mm</td>
              <td className="text-body py-2.5 pr-4 tabular-nums">{hook.us ?? "—"}</td>
              <td className="text-body py-2.5 pr-4 tabular-nums">{hook.uk ?? "—"}</td>
              <td className="text-body py-2.5 pr-4">
                {hook.yarnWeights
                  .map((number) => yarnWeightByNumber(number)?.name ?? String(number))
                  .join(", ")}
              </td>
              <td className="text-body py-2.5 pr-4">{hook.typicalUse}</td>
            </tr>
          ))}
        </ReferenceTable>
        <ul className="text-body mt-4 max-w-2xl space-y-2 text-xs leading-relaxed">
          {HOOK_TABLE_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </LearnSection>

      <LearnSection title="Why the same hook has three names">
        <LearnProse>
          <p>
            Metric sizing measures the shaft and is used by most modern patterns
            worldwide. US sizing uses letters and numbers that run upward with
            size, but the mapping has never been perfectly consistent between
            manufacturers — the Craft Yarn Council&rsquo;s own chart lists G
            against both 4.0 mm and 4.25 mm, which is a real difference in a
            garment.
          </p>
          <p>
            The old UK numbers run the opposite way: the larger the number, the
            smaller the hook. You will still meet them in vintage patterns and
            in inherited hook rolls, which is why they are in the table above —
            but they were never standardised alongside the metric sizes, and
            published charts disagree about which modern size inherits which old
            number. Where they disagree, the table leaves the cell blank rather
            than picking one. Steel hooks for thread work have their own
            numbering that also runs backwards, and it is separate again from
            the UK system.
          </p>
          <p>
            When a pattern and a hook disagree, trust the millimetres.
          </p>
        </LearnProse>
      </LearnSection>

      <LearnSection
        title="Choosing a hook for your yarn"
        lead="Yarn labels print a recommended hook size, and it is a reasonable default — but what you are making matters more than the label."
      >
        <LearnProse>
          <p>
            For a blanket or a scarf you usually want the recommended size or a
            little larger, because drape is the point and a loose fabric falls
            better. For amigurumi you almost always want to go smaller — often
            one or two sizes below the label — because stuffing will show
            through any gap between stitches. A 3.5 mm or 3.75 mm hook with DK
            yarn is a common amigurumi pairing for exactly this reason.
          </p>
          <p>
            Full yarn thicknesses, the names they go by and the hook ranges that
            suit them are in the{" "}
            <Link href="/resources/yarn-weights" className="text-brand-700 underline underline-offset-4">
              yarn weight guide
            </Link>
            .
          </p>
        </LearnProse>
      </LearnSection>

      <LearnSection title="The parts of a hook">
        <dl className="divide-y divide-border/70 border-t border-border">
          {HOOK_ANATOMY.map((part) => (
            <div key={part.part} className="grid gap-1 py-3.5 sm:grid-cols-[8rem_1fr] sm:gap-6">
              <dt className="text-sm font-medium text-foreground">{part.part}</dt>
              <dd className="text-body text-sm leading-relaxed">{part.what}</dd>
            </div>
          ))}
        </dl>
        <LearnProse>
          <p>
            Two hooks of the same size can still feel different: an inline head
            sits flush with the shaft and makes tighter, more even stitches,
            while a tapered head slides into stitches more easily. Neither is
            correct — it is worth trying both before buying a set.
          </p>
        </LearnProse>
      </LearnSection>

      <LearnSection title="When to change hook size">
        <LearnProse>
          <p>
            Patterns that matter dimensionally — garments, bags, anything that
            has to fit — give a gauge: a number of stitches and rows over a
            measured square. Work that square first. If you have more stitches
            than the pattern says, your tension is tight and a larger hook will
            fix it; fewer stitches means a smaller hook. Changing hook size is
            the normal remedy, not a sign you are doing something wrong.
          </p>
          <p>
            For toys, gauge matters less in absolute terms — a slightly larger
            reindeer is still a reindeer — but a fabric loose enough to show
            stuffing is worth re-hooking for.
          </p>
        </LearnProse>
      </LearnSection>

      <RelatedPatterns
        products={patterns}
        heading="Patterns from the shop"
        blurb="Each pattern names the hook size it was worked with, and the yarn it was designed for."
      />
    </LearnPage>
  );
}
