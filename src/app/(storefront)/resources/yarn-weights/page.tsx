import Link from "next/link";

import { LearnPage, LearnSection, LearnProse } from "@/components/content/learn-page";
import { ReferenceTable } from "@/components/content/reference-table";
import { RelatedPatterns } from "@/components/content/related-patterns";
import { SUBSTITUTION_CHECKS, YARN_WEIGHTS, hookRangeLabel } from "@/lib/crochet/yarn-weights";
import { resourceBySlug } from "@/lib/content/resources";
import { learnMetadata } from "@/lib/content/seo";
import { featuredProducts } from "@/lib/queries/content-links";

const resource = resourceBySlug("yarn-weights")!;

export const metadata = learnMetadata({
  title: "Yarn weight guide for crochet — lace to jumbo",
  description: resource.description,
  path: "/resources/yarn-weights",
});

/**
 * The yarn weight guide.
 *
 * The numbered categories are the only standard part, so they lead. The names
 * beside them are regional and are listed as alternatives rather than as
 * authorities, because "aran" and "worsted" are the same shelf in different
 * shops.
 */
export default async function YarnWeightsPage() {
  const patterns = await featuredProducts();

  return (
    <LearnPage
      eyebrow="Reference"
      title="Yarn weights, from lace to jumbo"
      intro="Yarn weight means thickness, not how much the ball weighs — which is the first thing worth clearing up on a yarn aisle. These are the eight standard categories, the names each one goes by, the hooks they suit, and how to swap one yarn for another without ruining a project."
      crumbs={[{ label: "Learn", href: "/learn" }, { label: "Yarn weights" }]}
      contents={[
        "The eight standard weights",
        "What each weight is like to work with",
        "Substituting one yarn for another",
        "Fibre matters as much as thickness",
      ]}
    >
      <LearnSection
        title="The eight standard weights"
        lead="The numbers come from the Craft Yarn Council and appear on many yarn labels inside a small skein symbol. The hook ranges are their crochet recommendations — a starting point, not a rule."
      >
        <ReferenceTable
          caption="Standard yarn weight categories with names and recommended crochet hook ranges"
          columns={[
            { label: "No.", numeric: true },
            { label: "Category" },
            { label: "Also called" },
            { label: "Hook range", numeric: true },
            { label: "Typical projects" },
          ]}
        >
          {YARN_WEIGHTS.map((weight) => (
            <tr key={weight.number}>
              <td className="py-2.5 pr-4 font-medium text-foreground tabular-nums">{weight.number}</td>
              <td className="py-2.5 pr-4 text-foreground">{weight.name}</td>
              <td className="text-body py-2.5 pr-4">{weight.alsoCalled.join(", ")}</td>
              <td className="text-body py-2.5 pr-4 tabular-nums">{hookRangeLabel(weight)}</td>
              <td className="text-body py-2.5 pr-4">{weight.typicalProjects}</td>
            </tr>
          ))}
        </ReferenceTable>
      </LearnSection>

      <LearnSection title="What each weight is like to work with">
        <dl className="divide-y divide-border/70 border-t border-border">
          {YARN_WEIGHTS.map((weight) => (
            <div key={weight.number} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
              <dt>
                <span className="text-sm font-medium text-foreground">
                  {weight.number} · {weight.name}
                </span>
                <span className="text-body mt-0.5 block text-xs tabular-nums">{hookRangeLabel(weight)}</span>
              </dt>
              <dd className="text-body text-sm leading-relaxed">{weight.note}</dd>
            </div>
          ))}
        </dl>
      </LearnSection>

      <LearnSection
        title="Substituting one yarn for another"
        lead="Most patterns can be worked in a different yarn than the one they name. These are the checks worth doing before you start rather than halfway through."
      >
        <ol className="text-body max-w-2xl list-decimal space-y-3 pl-5 text-sm leading-relaxed">
          {SUBSTITUTION_CHECKS.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ol>
        <LearnProse>
          <p>
            Hook sizes for each weight are in the{" "}
            <Link href="/resources/hook-sizes" className="text-brand-700 underline underline-offset-4">
              hook size guide
            </Link>
            , including why the same hook carries three different names.
          </p>
        </LearnProse>
      </LearnSection>

      <LearnSection title="Fibre matters as much as thickness">
        <LearnProse>
          <p>
            Two yarns can share a weight number and behave nothing alike. Cotton
            has almost no stretch, holds its shape and shows stitch definition
            crisply — good for baskets, bags and amigurumi, less forgiving of
            uneven tension. Wool has memory and bounce, blocks into shape, and
            hides small inconsistencies. Acrylic is hard-wearing and machine
            washable, which is often the deciding factor for anything a child
            will handle.
          </p>
          <p>
            For toys, fibre choice is also a safety consideration: a fabric
            tight enough that stuffing cannot escape matters more than the exact
            yarn, and a washable fibre is worth choosing for anything that will
            be slept with.
          </p>
        </LearnProse>
      </LearnSection>

      <RelatedPatterns
        products={patterns}
        heading="Patterns from the shop"
        blurb="Each pattern lists the yarn it was designed for, so you can match it to what you have."
      />
    </LearnPage>
  );
}
