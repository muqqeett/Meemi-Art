import Link from "next/link";

import { LearnPage, LearnSection, LearnProse } from "@/components/content/learn-page";
import { RelatedPatterns } from "@/components/content/related-patterns";
import { resourceBySlug } from "@/lib/content/resources";
import { learnMetadata } from "@/lib/content/seo";
import { productsForTechniques } from "@/lib/queries/content-links";

const resource = resourceBySlug("beginner-guide")!;

export const metadata = learnMetadata({
  title: "Beginner's guide to crochet — tools, yarn and first stitches",
  description: resource.description,
  path: "/resources/beginner-guide",
});

/**
 * The start-here page.
 *
 * Ordered the way a beginner actually meets the problems — what to buy, what
 * to make first, what goes wrong in week one — rather than as a taxonomy of
 * stitches. It is honest about what it cannot do: written instructions cannot
 * replace watching a hand move, so it says where video helps.
 */
export default async function BeginnerGuidePage() {
  const patterns = await productsForTechniques(resource.teaches);

  return (
    <LearnPage
      eyebrow="Guide"
      title="Starting crochet: what to buy, what to learn first"
      intro="Crochet needs less equipment than almost any other craft — a hook, a ball of yarn and a blunt needle will take you a long way. This is what is worth buying at the start, the order the first skills are easiest to learn in, and the handful of problems that stop most beginners in the first week."
      crumbs={[{ label: "Learn", href: "/learn" }, { label: "Beginner's guide" }]}
      contents={[
        "What you actually need",
        "Choosing your first yarn and hook",
        "The first four skills, in order",
        "Your first project",
        "What usually goes wrong first",
        "Where to go next",
      ]}
    >
      <LearnSection title="What you actually need">
        <LearnProse>
          <p>
            Three things: a hook, yarn, and a pair of scissors. A blunt
            tapestry needle for sewing ends in is a fourth that you will want
            within an hour. Stitch markers are useful but a scrap of contrasting
            yarn does the same job.
          </p>
          <p>
            You do not need a hook set, a yarn winder, blocking mats or a
            project bag to begin. Buy a single hook in a size that matches a
            yarn you like, and add tools when a project asks for them — that
            way you learn what each one is for rather than owning a drawer of
            unexplained equipment.
          </p>
        </LearnProse>
      </LearnSection>

      <LearnSection
        title="Choosing your first yarn and hook"
        lead="The easiest yarn to learn on is a smooth, light-coloured, medium-weight yarn — and the reason is purely practical: you have to be able to see your stitches."
      >
        <LearnProse>
          <p>
            Dark yarn hides the loops you are trying to count. Fluffy or
            textured yarn hides them too, and splitting yarn punishes a beginner
            who has not yet worked out where the hook should enter. A smooth
            worsted-weight acrylic or cotton in a mid tone is unglamorous and
            genuinely easier.
          </p>
          <p>
            Pair it with a 5.0 mm or 5.5 mm hook to start. That is slightly
            larger than some labels suggest, which keeps your stitches loose
            enough to get the hook back into them — beginners almost always work
            too tightly at first, and a bigger hook removes one source of
            frustration while you learn the movement.
          </p>
          <p>
            The full conversions are in the{" "}
            <Link href="/resources/hook-sizes" className="text-brand-700 underline underline-offset-4">
              hook size guide
            </Link>
            , and the thicknesses and what they suit are in the{" "}
            <Link href="/resources/yarn-weights" className="text-brand-700 underline underline-offset-4">
              yarn weight guide
            </Link>
            .
          </p>
        </LearnProse>
      </LearnSection>

      <LearnSection
        title="The first four skills, in order"
        lead="Each one depends on the one before it, and each is worth practising until it stops needing your full attention."
      >
        <ol className="text-body max-w-2xl list-decimal space-y-4 pl-5 leading-relaxed">
          <li>
            <span className="font-medium text-foreground">Holding the hook and tensioning the yarn.</span>{" "}
            There are two common hook grips — like a pencil, and like a knife —
            and neither is more correct. Tension comes from the yarn running
            over the fingers of your other hand; it is the part that feels
            impossible for about two days and then becomes invisible.
          </li>
          <li>
            <span className="font-medium text-foreground">The slip knot and the chain.</span>{" "}
            A chain is the foundation most projects start from. Practise
            until your chains are even in size, because uneven chains make
            every row above them uneven too.
          </li>
          <li>
            <span className="font-medium text-foreground">Single crochet.</span>{" "}
            The shortest common stitch and the one most beginner projects use.
            Work rows of it until you can tell, by looking, where each stitch
            begins and ends.
          </li>
          <li>
            <span className="font-medium text-foreground">Counting and fastening off.</span>{" "}
            Count your stitches at the end of every row. Finishing means cutting
            the yarn, pulling the tail through the last loop and sewing the end
            back into the fabric so it cannot unravel.
          </li>
        </ol>
        <LearnProse>
          <p>
            Written instructions can tell you the sequence, but a hand movement
            is genuinely easier to copy than to read. It is worth watching
            someone make a single crochet once, then coming back to the written
            steps to practise — the two together work better than either alone.
          </p>
        </LearnProse>
      </LearnSection>

      <LearnSection title="Your first project">
        <LearnProse>
          <p>
            Make something flat, small and forgiving: a dishcloth, a coaster, a
            small square. Flat work in rows lets you see every stitch, and a
            piece you can finish in an evening teaches you more than an ambitious
            project you abandon.
          </p>
          <p>
            Resist starting with a garment. Anything that has to fit depends on
            gauge — matching the pattern&rsquo;s stitch size exactly — and gauge
            is much easier to care about once the stitches themselves are
            automatic. Amigurumi is a reasonable second project, because size
            matters less and it is worked in a spiral without turning.
          </p>
        </LearnProse>
      </LearnSection>

      <LearnSection title="What usually goes wrong first">
        <dl className="divide-y divide-border/70 border-t border-border">
          {[
            {
              problem: "The edges creep inward or outward",
              cause:
                "Almost always a stitch count problem: a stitch was added or missed at the end of a row. Count after every row for the first few projects — it is faster than unpicking six rows later.",
            },
            {
              problem: "The hook will not fit back into the stitch",
              cause:
                "Tension is too tight. Try a larger hook, and let the yarn run more loosely over your fingers. Tension loosens naturally with practice.",
            },
            {
              problem: "The fabric curls at the corners",
              cause:
                "Common in tight single crochet, and often fixed by a larger hook or by blocking. In a flat circle, curling usually means too few increases.",
            },
            {
              problem: "The stitch count is right but the piece looks wrong",
              cause:
                "Check whether you are working into the turning chain when the pattern does not intend you to. Whether the turning chain counts as a stitch changes every row.",
            },
            {
              problem: "The pattern stops making sense",
              cause:
                "Usually a notation problem rather than a skill one — brackets and repeats are their own small language.",
            },
          ].map((entry) => (
            <div key={entry.problem} className="py-4">
              <dt className="text-sm font-medium text-foreground">{entry.problem}</dt>
              <dd className="text-body mt-1 text-sm leading-relaxed">{entry.cause}</dd>
            </div>
          ))}
        </dl>
      </LearnSection>

      <LearnSection title="Where to go next">
        <LearnProse>
          <p>
            Once single crochet in rows feels automatic, the two directions worth
            taking are height — half double and double crochet, which build the
            same fabric faster — and shape, by working in rounds instead of rows.
          </p>
          <p>
            Before your first written pattern, read the{" "}
            <Link href="/resources/abbreviations" className="text-brand-700 underline underline-offset-4">
              abbreviation dictionary
            </Link>{" "}
            and the{" "}
            <Link href="/resources/reading-patterns" className="text-brand-700 underline underline-offset-4">
              pattern notation reference
            </Link>
            . Between them they cover nearly everything that makes a pattern look
            impenetrable the first time you open one.
          </p>
        </LearnProse>
      </LearnSection>

      <RelatedPatterns
        products={patterns}
        heading="Patterns to grow into"
        blurb="Each lists the techniques it uses, so you can see what a project will ask of you before you buy it."
      />
    </LearnPage>
  );
}
