import Link from "next/link";

import { LearnPage, LearnSection, LearnProse } from "@/components/content/learn-page";
import { ReferenceTable } from "@/components/content/reference-table";
import { RelatedPatterns } from "@/components/content/related-patterns";
import {
  ABBREVIATION_GROUPS,
  US_UK_STITCH_NAMES,
  abbreviationsInGroup,
} from "@/lib/crochet/abbreviations";
import { resourceBySlug } from "@/lib/content/resources";
import { learnMetadata } from "@/lib/content/seo";
import { productsForTechniques } from "@/lib/queries/content-links";

const resource = resourceBySlug("abbreviations")!;

export const metadata = learnMetadata({
  title: "Crochet abbreviations dictionary — US and UK terms",
  description: resource.description,
  path: "/resources/abbreviations",
});

/**
 * The abbreviation dictionary.
 *
 * Grouped by what the abbreviation is *for* rather than alphabetically: a
 * reader stuck on "BLO" is looking at a placement instruction, and seeing FLO
 * beside it answers the next question too. Every entry says what to do, not
 * just what the letters stand for.
 */
export default async function AbbreviationsPage() {
  const patterns = await productsForTechniques(resource.teaches);

  return (
    <LearnPage
      eyebrow="Reference"
      title="Crochet abbreviations, and what they actually ask you to do"
      intro="Patterns are written in shorthand because writing every stitch out in full would make a round of amigurumi three paragraphs long. Here is what each abbreviation means, what the instruction is asking for, and where the same letters mean different stitches in US and UK patterns."
      crumbs={[{ label: "Learn", href: "/learn" }, { label: "Abbreviations" }]}
      contents={[
        "US and UK terms are not the same",
        ...ABBREVIATION_GROUPS.map((group) => group.label),
        "How to use this while you work",
      ]}
    >
      <LearnSection
        title="US and UK terms are not the same"
        lead="This is the one that ruins projects. Both conventions use the same abbreviations for different stitches, so a UK pattern asking for dc wants what a US pattern calls sc — a stitch half the height."
      >
        <ReferenceTable
          caption="Equivalent stitch names in US and UK crochet terms"
          columns={[{ label: "US term" }, { label: "UK term" }]}
        >
          {US_UK_STITCH_NAMES.map((pair) => (
            <tr key={pair.us}>
              <td className="py-2.5 pr-4 text-foreground">{pair.us}</td>
              <td className="text-body py-2.5 pr-4">{pair.uk}</td>
            </tr>
          ))}
        </ReferenceTable>
        <LearnProse>
          <p>
            If a pattern does not say which convention it uses, two things give
            it away: UK patterns rarely mention <em>single crochet</em> at all,
            and a pattern whose tallest stitch is <em>treble</em> is usually UK.
            Meemi Art patterns state their own convention on the product page —
            some are written in US terms, some in UK terms with a conversion
            chart included — so you can check before you buy.
          </p>
        </LearnProse>
      </LearnSection>

      {ABBREVIATION_GROUPS.map((group) => (
        <LearnSection key={group.slug} title={group.label} lead={group.blurb}>
          <dl className="divide-y divide-border/70 border-t border-border">
            {abbreviationsInGroup(group.slug).map((entry) => (
              <div key={entry.abbr} className="grid gap-1 py-4 sm:grid-cols-[8rem_1fr] sm:gap-6">
                <dt>
                  <span className="font-mono text-sm font-semibold text-foreground">{entry.abbr}</span>
                  <span className="text-body mt-0.5 block text-xs">{entry.term}</span>
                  {entry.aliases && (
                    <span className="text-body mt-0.5 block text-xs">also written {entry.aliases.join(", ")}</span>
                  )}
                </dt>
                <dd className="text-body text-sm leading-relaxed">
                  <p>{entry.meaning}</p>
                  {entry.example && (
                    <p className="mt-2 rounded-xs bg-surface-alt px-3 py-2 font-mono text-xs text-foreground">
                      {entry.example}
                    </p>
                  )}
                  {entry.ukNote && (
                    <p className="mt-2 text-xs text-brand-700">
                      <span className="font-medium">UK terms:</span> {entry.ukNote}
                    </p>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </LearnSection>
      ))}

      <LearnSection title="How to use this while you work">
        <LearnProse>
          <p>
            Most patterns put their own abbreviation key on the first page, and
            that key wins: a designer may define a custom stitch or use an
            uncommon short form. Read it before you start, and come back here
            for anything it leaves out.
          </p>
          <p>
            The other half of reading a pattern is the punctuation — the
            brackets, asterisks and stitch counts that say how many times to
            repeat something and how many stitches you should have at the end of
            a round. Those are covered in the{" "}
            <Link href="/resources/reading-patterns" className="text-brand-700 underline underline-offset-4">
              pattern notation reference
            </Link>
            . If you are starting from nothing, the{" "}
            <Link href="/resources/beginner-guide" className="text-brand-700 underline underline-offset-4">
              beginner&rsquo;s guide
            </Link>{" "}
            covers tools and first stitches.
          </p>
        </LearnProse>
      </LearnSection>

      <RelatedPatterns
        products={patterns}
        blurb="Each one names the crochet terms it uses, so you know which column of the table above to read."
      />
    </LearnPage>
  );
}
