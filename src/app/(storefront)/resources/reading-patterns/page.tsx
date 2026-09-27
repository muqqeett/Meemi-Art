import Link from "next/link";

import { LearnPage, LearnSection, LearnProse } from "@/components/content/learn-page";
import { ReferenceTable } from "@/components/content/reference-table";
import { RelatedPatterns } from "@/components/content/related-patterns";
import { resourceBySlug } from "@/lib/content/resources";
import { learnMetadata } from "@/lib/content/seo";
import { productsForTechniques } from "@/lib/queries/content-links";

const resource = resourceBySlug("reading-patterns")!;

export const metadata = learnMetadata({
  title: "Crochet pattern notation — brackets, repeats and stitch counts",
  description: resource.description,
  path: "/resources/reading-patterns",
});

/** The punctuation of a crochet pattern, as a lookup you can check mid-round. */
const NOTATION = [
  {
    symbol: "( )",
    name: "Parentheses",
    means:
      "A group of stitches worked into the same place, or a sequence to repeat. A number after them says how many times.",
    example: "(sc, inc) x 6",
    reading: "Work one single crochet, then an increase, and repeat that pair six times.",
  },
  {
    symbol: "[ ]",
    name: "Brackets",
    means:
      "Usually the larger grouping when parentheses are already in use, so repeats can nest without ambiguity.",
    example: "[(sc, inc) x 3, sc] x 2",
    reading: "Work the inner pair three times, then one single crochet — and do that whole sequence twice.",
  },
  {
    symbol: "* *",
    name: "Asterisks",
    means:
      "Mark the start, and sometimes the end, of a repeat that runs to the end of the row or round.",
    example: "*sc in next 2 sts, inc; rep from * around",
    reading: "Repeat everything after the asterisk until the round ends.",
  },
  {
    symbol: "( ) at line end",
    name: "Stitch count",
    means:
      "How many stitches you should have when the row or round is finished. The most useful number in any pattern.",
    example: "Rnd 3: (sc, inc) x 6 (18)",
    reading: "At the end of round 3 you should be able to count eighteen stitches.",
  },
  {
    symbol: "x n / n times",
    name: "Repeat count",
    means: "How many times to work the group immediately before it.",
    example: "inc x 6",
    reading: "Six increases, one after another — twelve stitches made.",
  },
];

/**
 * Pattern notation, kept separate from the abbreviation dictionary.
 *
 * The dictionary answers "what does sc mean?"; this answers "what is this line
 * asking me to do?" — brackets, repeats, counts and the difference between
 * rows and rounds. Two different questions, asked at different moments.
 */
export default async function ReadingPatternsPage() {
  const patterns = await productsForTechniques(resource.teaches);

  return (
    <LearnPage
      eyebrow="Reference"
      title="How a crochet pattern is written"
      intro="A pattern is shorthand plus punctuation. The shorthand is the abbreviations; the punctuation is brackets, asterisks and the little number at the end of the line. Once both are familiar, most patterns stop being cryptic — this page is the punctuation half, written to be checked while you have a hook in your hand."
      crumbs={[{ label: "Learn", href: "/learn" }, { label: "Pattern notation" }]}
      contents={[
        "The symbols, and what they ask for",
        "Rows and rounds are written differently",
        "Stitch counts are your error check",
        "Turning chains",
        "Gauge, and when to care",
        "Charts and symbol diagrams",
      ]}
    >
      <LearnSection
        title="The symbols, and what they ask for"
        lead="Designers vary slightly, so a pattern's own notes always win — but these conventions are close to universal."
      >
        <ReferenceTable
          caption="Crochet pattern notation, with an example of each"
          columns={[{ label: "Symbol" }, { label: "What it means" }, { label: "Example" }]}
        >
          {NOTATION.map((entry) => (
            <tr key={entry.symbol}>
              <td className="py-3 pr-4 align-top">
                <span className="font-mono text-sm font-semibold text-foreground">{entry.symbol}</span>
                <span className="text-body mt-0.5 block text-xs">{entry.name}</span>
              </td>
              <td className="text-body py-3 pr-4 align-top">{entry.means}</td>
              <td className="py-3 pr-4 align-top">
                <span className="block font-mono text-xs text-foreground">{entry.example}</span>
                <span className="text-body mt-1 block text-xs">{entry.reading}</span>
              </td>
            </tr>
          ))}
        </ReferenceTable>
      </LearnSection>

      <LearnSection title="Rows and rounds are written differently">
        <LearnProse>
          <p>
            A row is worked flat: you reach the end, turn the work, and come
            back the other way. A round is worked in a circle. Rounds come in
            two kinds, and patterns do not always say which they mean — though
            the instructions give it away.
          </p>
          <p>
            A <span className="font-medium text-foreground">joined round</span>{" "}
            ends with a slip stitch into the first stitch, usually followed by a
            turning chain. A{" "}
            <span className="font-medium text-foreground">spiral</span> has no
            join at all: you simply keep going, and the beginning of each round
            drifts around the piece. Spirals are standard for amigurumi because
            they leave no seam — and they are the reason patterns tell you to
            place a stitch marker, since nothing else shows where the round
            started.
          </p>
        </LearnProse>
      </LearnSection>

      <LearnSection
        title="Stitch counts are your error check"
        lead="The number in brackets at the end of a line is the single most useful thing in a pattern."
      >
        <LearnProse>
          <p>
            Count at the end of every round, not at the end of the piece. If a
            round should give you 24 stitches and you count 23, the mistake is
            in that round and costs a minute to fix. Discovering it six rounds
            later costs an evening.
          </p>
          <p>
            In amigurumi the count also tells you the shape: increases make the
            number grow, plain rounds hold it steady, decreases shrink it. A
            sphere is usually a run of increasing rounds, some straight rounds,
            then the mirror image decreasing. When a piece is not looking
            spherical, the counts usually show why.
          </p>
        </LearnProse>
      </LearnSection>

      <LearnSection title="Turning chains">
        <LearnProse>
          <p>
            When you turn at the end of a row, you need height to reach the top
            of the next stitch, so patterns add chains: roughly one for single
            crochet, two for half double, three for double crochet.
          </p>
          <p>
            The critical question is whether the turning chain{" "}
            <em>counts as a stitch</em>. If it does, you skip the first stitch
            of the row and work into the top of the turning chain at the end. If
            it does not, you work into the very first stitch and ignore the
            chain. Getting this wrong adds or loses one stitch per row, which is
            exactly what makes edges slant. Patterns state their convention
            near the start — it is worth finding before row one.
          </p>
        </LearnProse>
      </LearnSection>

      <LearnSection title="Gauge, and when to care">
        <LearnProse>
          <p>
            Gauge is a measured square: a pattern might say 14 stitches and 16
            rows to 10 cm in single crochet. It exists so that your finished
            piece comes out the size the designer intended, and it depends on
            your yarn, your hook and your personal tension.
          </p>
          <p>
            It matters enormously for anything worn or fitted, and much less for
            toys, blankets and bags — where being 10% larger is simply a larger
            object. If gauge matters, work the swatch in the stitch the pattern
            names, measure it flat, and change hook size until it matches. A
            larger hook gives fewer stitches per square; a smaller hook gives
            more.
          </p>
        </LearnProse>
      </LearnSection>

      <LearnSection title="Charts and symbol diagrams">
        <LearnProse>
          <p>
            Some patterns include a chart: a picture of the fabric where each
            stitch is drawn as a symbol — a cross or T for single crochet, a T
            with a bar for double crochet, an oval for a chain. Charts are read
            in the direction the work is made: outward from the centre for
            rounds, and alternating left-to-right and right-to-left for rows.
          </p>
          <p>
            Charts are most useful for motifs and lace, where the shape of the
            pattern is hard to hold in your head from words alone. They are a
            supplement, not a replacement — most patterns that include a chart
            also write the rounds out.
          </p>
          <p>
            For the abbreviations themselves, see the{" "}
            <Link href="/resources/abbreviations" className="text-brand-700 underline underline-offset-4">
              abbreviation dictionary
            </Link>
            .
          </p>
        </LearnProse>
      </LearnSection>

      <RelatedPatterns
        products={patterns}
        blurb="Each one names the crochet terms it uses and the hook and yarn it was worked in, so the checks above apply from the first line."
      />
    </LearnPage>
  );
}
