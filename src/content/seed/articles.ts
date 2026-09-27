/**
 * The articles that ship with the content platform, as source.
 *
 * Kept in the repository rather than typed into the admin for two reasons:
 * they are reviewable in a diff before anyone can publish them, and they can
 * be seeded into a fresh database without a person retyping 4,000 words.
 *
 * `npm run seed:content` writes them as DRAFTS. Publishing is a decision made
 * in the admin, by a person who has read them.
 *
 * Written for this shop. Nothing here is copied or paraphrased from another
 * site, and nothing claims an authority we do not have: no statistics, no
 * invented author, no "experts say". Where crochet genuinely has more than one
 * convention, the articles say so instead of picking one and pretending.
 */

export type SeedTopic = { slug: string; name: string; description: string; sortOrder: number };

export const SEED_TOPICS: SeedTopic[] = [
  {
    // Added for the tutorials. A step-by-step skill is neither "reading
    // patterns" nor "tools and materials", and filing it under either would
    // make the topic listing say something untrue about what is in it.
    slug: "techniques",
    name: "Techniques",
    description: "Single skills worked step by step: starting a round, shaping, colour changes and finishing.",
    sortOrder: 5,
  },
  {
    slug: "reading-patterns",
    name: "Reading patterns",
    description: "Making sense of written patterns: abbreviations, repeats, stitch counts and charts.",
    sortOrder: 10,
  },
  {
    slug: "tools-and-materials",
    name: "Tools and materials",
    description: "Hooks, yarn and the small pieces of equipment that make a project easier.",
    sortOrder: 20,
  },
];

export type SeedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  topicSlug: string;
  teaches: string[];
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  body: string;
};

export const SEED_ARTICLES: SeedArticle[] = [
  {
    slug: "how-to-read-a-crochet-pattern",
    title: "How to read a crochet pattern, line by line",
    excerpt:
      "A written pattern looks like code until someone reads one out loud with you. This walks through a short pattern from the first line to the last, explaining what each part is asking for and why the numbers matter more than the words.",
    topicSlug: "reading-patterns",
    teaches: ["working-in-rounds", "reading-charts", "increase"],
    tags: ["beginner", "patterns"],
    seoTitle: "How to read a crochet pattern — a line-by-line walkthrough",
    seoDescription:
      "Read a crochet pattern line by line: the materials list, gauge, abbreviations, repeats and stitch counts, with a worked example you can follow.",
    body: `The first crochet pattern most people open looks like this:

\`Rnd 3: (sc, inc) x 6 (18)\`

A short line like this can look intimidating, but every part of it has a job. That line is a complete instruction — what to make, how many times, and how to check you got it right. This article reads a whole pattern in that language, in the order you meet it, so the next one you open is just a set of instructions rather than a wall of letters.

If you want the abbreviations themselves, the [abbreviation dictionary](/resources/abbreviations) lists them with what each asks you to do. This is about the shape of a pattern as a document.

## Read the top of the pattern before the first stitch

Everything above Row 1 exists to stop you discovering a problem forty rounds in. It usually holds five things.

- **Which terms it uses.** US or UK. This is the single most important line on the page, because \`dc\` means a different stitch in each, and nothing later will warn you.
- **Materials.** The yarn weight and the hook size the designer used, plus anything else — stuffing, safety eyes, a stitch marker.
- **Gauge.** A measured square, given only when finished size matters.
- **Finished size.** What the designer ended up with, using their yarn and their tension.
- **An abbreviation key.** The pattern's own list, which always wins over any general reference.

> tip: If a pattern names no convention anywhere, look at the stitches it uses. A pattern whose tallest stitch is \`tr\` with no \`sc\` in sight is almost certainly UK.

## Materials are a starting point, not a shopping list

A materials list describes what the designer used. It is not a requirement, and swapping is normal — but two swaps behave differently.

Changing **colour** changes nothing. Changing **yarn weight** changes everything downstream: size, how much yarn you need, how tight the fabric is, and whether stuffing shows through. If you substitute, match the weight number first and treat the hook size as a suggestion to test. The [yarn weight guide](/resources/yarn-weights) covers what each number means and how to substitute without guessing.

## Gauge: when to swatch, and when not to bother

Gauge is a small square worked in the pattern's stitch, measured flat: "14 sts and 16 rows to 10 cm in single crochet."

It matters when size matters — garments, anything worn, anything that has to fit an object. It matters much less for toys, blankets, bags and coasters, where a piece 10% larger is simply a slightly larger object.

If gauge matters and yours does not match, change hook size rather than your tension. More stitches than the pattern says means your work is tight: go up a hook size. Fewer means loose: go down. Tension is a habit and is very hard to change deliberately; hook size is a decision you make once.

## Rows and rounds are different animals

A **row** is worked flat, and you turn at the end of each one. A **round** goes in a circle.

Rounds come in two kinds, and patterns often assume you can tell which you are in:

- A **joined round** ends by slip stitching into the first stitch of the round, usually followed by a chain to reach the height of the next one.
- A **spiral** never joins. You keep working past the start, and the beginning of each round drifts around the piece. Amigurumi almost always uses spirals, because a join leaves a visible seam.

Spirals are the reason patterns tell you to place a stitch marker. Without a join, nothing shows where the round began, and a stitch marker moved up each round is the only thing standing between you and a miscount.

## Now the line itself

Here is a short pattern for a flat circle — the beginning of almost every amigurumi piece, and a useful thing to be able to make on its own as a coaster.

\`\`\`
Rnd 1: 6 sc in magic ring (6)
Rnd 2: inc in each st around (12)
Rnd 3: (sc, inc) x 6 (18)
Rnd 4: (2 sc, inc) x 6 (24)
Rnd 5: (3 sc, inc) x 6 (30)
\`\`\`

Read across one line at a time.

**\`Rnd 1: 6 sc in magic ring (6)\`** — work six single crochet into an adjustable loop, then pull the loop closed. You should be able to count six stitches. The number in brackets at the end is the stitch count, and it is the most useful thing in the pattern.

**\`Rnd 2: inc in each st around (12)\`** — an increase is two stitches worked into one stitch. Six stitches, each getting two, gives twelve.

**\`Rnd 3: (sc, inc) x 6 (18)\`** — the parentheses hold a sequence, and \`x 6\` says do it six times. So: one single crochet, then an increase, repeated six times. Each repeat consumes two stitches of the previous round and produces three, so twelve becomes eighteen.

**\`Rnd 4: (2 sc, inc) x 6 (24)\`** — the same idea with one more plain stitch in each repeat. The pattern is now visible: each round adds six stitches, and the plain run between increases grows by one each time.

That is what a flat circle is. If you kept going — \`(4 sc, inc) x 6\`, \`(5 sc, inc) x 6\` — it would keep lying flat and keep growing by six.

> note: Six is not magic. For single crochet, six increases per round is a common starting convention for keeping a circle reasonably flat, and it comes from the proportions of the stitch. Too few and it tends to cup into a bowl; too many and the edge ruffles — though yarn, tension and the stitch itself all affect where that line falls. If your circle is curling or waving, count your increases before you blame your tension.

## Brackets, asterisks and the shape of a repeat

Patterns use three notations for the same idea, and which one a designer picks is habit rather than meaning.

| Notation | Example | What it asks for |
| --- | --- | --- |
| Parentheses with a count | (sc, inc) x 6 | Work the group six times |
| Asterisk to end of round | *sc, inc; rep from * around | Work the group until the round ends |
| Brackets around a larger group | [(sc, inc) x 3, sc] x 2 | Nest one repeat inside another |

The nested case is worth reading twice. \`[(sc, inc) x 3, sc] x 2\` means: work \`sc, inc\` three times, then one more \`sc\` — and then do all of that again.

## Stitch counts are an error check, not decoration

Count at the end of every round. Not at the end of the piece — at the end of every round.

If a round should give 24 and you count 23, the mistake is in that round, and fixing it costs a minute. Finding out six rounds later costs an evening, because you cannot tell which round lost the stitch.

In shaped work, the counts also describe the object. A ball is a run of increasing rounds, some straight rounds, then decreasing rounds that mirror the increases. When something is not coming out the shape you expected, the counts usually show exactly where it went wrong.

## Turning chains, and the question to ask

In flat work, the chain at the start of a row gives you the height to reach the top of the next stitch. Roughly: one chain for single crochet, two for half double, three for double crochet. These are common starting-chain conventions, but the pattern's instructions take precedence.

The critical question is whether the pattern counts that chain as a stitch. If it does, you skip the first stitch of the row and work your last stitch into the top of the turning chain. If it does not, you work into the very first stitch and ignore the chain at the end.

Getting this wrong adds or loses one stitch per row, and it is a common cause of edges that gradually slant instead of staying straight.

## Reading a chart, if the pattern has one

Some patterns include a chart: a picture of the fabric where every stitch is a symbol.

:: diagram chart-symbols

Charts are read in the direction the work is made — outward from the centre for rounds, and alternating direction for rows. They are most useful for motifs and lace, where the written version is hard to hold in your head. Nearly every pattern with a chart also writes the rounds out, so a chart is a second view rather than a requirement.

## What to do when a line stops making sense

1. **Check the stitch count of the previous round first.** Most confusing lines are confusing because the count going in is wrong.
2. **Re-read the abbreviation key.** A designer may define a custom stitch.
3. **Work the line out loud, one instruction at a time.** "One single crochet. One increase. That is one repeat. Five more."
4. **Check whether you are in rows or rounds**, and whether the round joins.
5. **Count what you have, not what you should have.** The difference tells you which round to unpick to.

None of these require skill you do not already have. Reading a pattern is a habit, and the habit is built by counting.

## Where to go next

Keep the [pattern notation reference](/resources/reading-patterns) open while you work — it is the same material as this article, arranged for looking things up rather than reading through. The [abbreviation dictionary](/resources/abbreviations) covers the shorthand itself, including the US and UK stitches that share names.

Our own [crochet patterns](/shop) each say on the product page which terms they use — some are US, some are UK with a conversion chart included — along with the hook and yarn they were worked in. That is the first check in this article, answered before you buy.`,
  },
  {
    slug: "choosing-a-crochet-hook",
    title: "Crochet hook sizes explained: choosing one, not just converting one",
    excerpt:
      "Hook size is the one decision that changes every stitch you make. This explains what the number really controls, how the same hook ends up with three different names, and how to choose between materials and head shapes without buying a full set.",
    topicSlug: "tools-and-materials",
    teaches: [],
    tags: ["tools", "beginner"],
    seoTitle: "Crochet hook sizes explained — how to choose the right hook",
    seoDescription:
      "What crochet hook size actually controls, how mm, US and UK sizes relate, and how to choose a hook by material, head shape and project rather than by the label.",
    body: `A crochet hook has one job: to make loops of a particular size. Everything else about it — the material, the grip, the brand — is about your hand. The size is about the fabric.

That distinction is worth holding onto, because it explains most of the advice in this article. If you want the conversion table itself, the [hook size guide](/resources/hook-sizes) has millimetres, US and old UK sizes side by side. This is about what to do with that information.

## What the number actually measures

The size printed on a hook is the diameter of its **shaft** — the straight section behind the head, not the pointy part. That is what the loop wraps around, and it is therefore what sets the size of every stitch you make.

This is why hook size and fabric are so tightly linked. A larger shaft makes larger loops, which makes a looser, drapier, more open fabric from exactly the same yarn. A smaller shaft makes smaller loops, which makes a denser, stiffer fabric that holds its shape.

Neither is better. They are different fabrics, and the project decides which you want:

- **Blankets, shawls, scarves** — drape is the point. The label's recommended size, or a little larger.
- **Amigurumi and toys** — density is the point, because stuffing must not show through the gaps. One or two sizes smaller than the label suggests is normal.
- **Bags and baskets** — structure is the point. Smaller again, sometimes noticeably.
- **Garments** — whatever matches the pattern's gauge, which is the only thing that will make it fit.

## Why the same hook has three names

A 4 mm hook may be stamped 4 mm, or G-6, or — in an inherited hook roll — 8.

Millimetres are a measurement: they mean the same thing in every country and on every brand. US letter/number sizes are a naming convention layered on top, and the mapping has never been perfectly consistent between manufacturers. A hook marked G has been sold at 4.0 mm and at 4.25 mm. That quarter of a millimetre is invisible in a coaster and quite visible across a sweater.

The old UK numbers run in the opposite direction — a larger number is a smaller hook — and steel hooks for thread work use yet another scale that also runs backwards.

The practical rule is simple: **when a pattern and a hook disagree, trust the millimetres.**

## Going up or down a size, and what it does

Changing hook size is the standard fix for gauge, and it is worth knowing what it changes and what it does not.

| Change | Fabric | Typical effect on size |
| --- | --- | --- |
| Up a size | Looser, softer, more drape | Larger |
| Down a size | Tighter, firmer, holds shape | Smaller |

Two things it does **not** change: the stitch count in the pattern, and your tension. If your gauge is off, change the hook — do not try to crochet more tightly or loosely on purpose. Deliberate tension is exhausting to maintain and it drifts as soon as you stop thinking about it.

> tip: When a pattern's gauge asks for more stitches per 10 cm than you are getting, your stitches are too big — go down a size. Fewer stitches than the pattern, go up. It is the opposite of what it sounds like, which is why it is worth writing on the pattern.

## Head shape: inline or tapered

Look at the head of a hook next to its shaft. On an **inline** hook the head is the same width as the shaft and the throat is cut straight in. On a **tapered** hook the head is slightly narrower and rounder, and the throat curves.

- **Inline** hooks tend to produce very even stitches, because the loop sits at shaft width from the moment it is formed. They can feel like they catch more.
- **Tapered** hooks tend to slide into stitches more easily and feel faster, at the cost of a little consistency until you are used to them.

Neither is correct and this is not a beginner-versus-expert distinction. Most people simply prefer one. If you can, hold both before buying a set — it is the difference you are most likely to notice after size itself.

## Material, and what it is really for

- **Aluminium** — smooth, fast, inexpensive, and what most sets are made of. Yarn slides easily, which is good until it slides too easily for a slippery yarn.
- **Bamboo and wood** — slightly more friction, which some people find gives them more control, and warmer in the hand. Thinner sizes can flex.
- **Plastic** — usually the very large sizes, where metal would be heavy.
- **Steel** — the fine thread hooks, which have their own numbering.
- **Ergonomic handles** — a rubber or moulded grip on a metal hook. Worth considering if your hand aches, which for most people is about grip pressure rather than the hook.

Material changes how the hook feels, not the size of your stitches. A 4 mm bamboo hook and a 4 mm aluminium hook make the same size loop.

## Buying: three hooks, not a set of twenty

A full set gives you many sizes, but a beginner may only use a few of them regularly.

A more useful first purchase:

1. One hook that matches the yarn you already own — for example, a 4 mm or 5 mm if you have DK or worsted in the cupboard.
2. One size smaller, for amigurumi and anything that needs a firmer fabric.
3. One size larger, for when your gauge runs tight or you want more drape.

Add sizes when a pattern asks for one. By the time you genuinely need a set, you will know which handle you want it to have.

## Looking after your hands

Crochet is a repetitive motion with a small tool, and hand strain can be a reason to take a break from crochet.

- Hold the hook as loosely as the work allows. Most grip pressure is habit, not necessity.
- Take a break roughly every half hour, even a short one.
- If a hook's thumb rest sits somewhere awkward for your grip, that is the hook's fault, not yours — the position varies between brands.
- Larger-diameter handles reduce the pinch grip some hands find tiring.

If something hurts, stop. A project is never urgent enough to be worth an injury that keeps you from the next one.

## Where to go next

The [hook size guide](/resources/hook-sizes) has the full conversion table and what each size is typically used for, and the [yarn weight guide](/resources/yarn-weights) covers the other half of the decision. If you are starting from scratch, the [beginner's guide](/resources/beginner-guide) covers what else is worth buying.

Every [pattern in our shop](/shop) names the hook size it was worked with and the yarn it was designed for, so you can see what a project expects before you start it.`,
  },
  {
    slug: "crochet-abbreviations-for-beginners",
    title: "The crochet abbreviations worth learning first",
    excerpt:
      "There are dozens of crochet abbreviations and you do not need most of them to start. These are the twelve that turn up in most beginner patterns, shown in the lines you will actually meet them in.",
    topicSlug: "reading-patterns",
    teaches: ["chain", "single-crochet", "half-double-crochet", "double-crochet", "magic-ring", "increase", "invisible-decrease"],
    tags: ["beginner", "patterns"],
    seoTitle: "Crochet abbreviations for beginners — the 12 that matter",
    seoDescription:
      "The crochet abbreviations that appear in most beginner patterns, what each asks you to do, and the US and UK terms that share names but mean different stitches.",
    body: `A full crochet abbreviation list can look surprisingly long when you are trying to start a project. The good news is that many beginner patterns rely on a relatively small core of abbreviations, and once those are automatic, the rest can be looked up as you meet them.

This is that core, in roughly the order you are likely to encounter it, with the pattern lines each one turns up in. The full list lives in the [abbreviation dictionary](/resources/abbreviations) for when you need it.

## First, the one that causes real damage

Before any list: **US and UK patterns use the same abbreviations for different stitches.**

| US term | UK term |
| --- | --- |
| single crochet (sc) | double crochet (dc) |
| half double crochet (hdc) | half treble (htr) |
| double crochet (dc) | treble (tr) |

So \`dc\` in a US pattern is a tall stitch, and \`dc\` in a UK pattern is the shortest common one. A pattern worked in the wrong convention will not fail immediately — it will simply come out the wrong size and the wrong density, which is more annoying than an outright error.

Patterns nearly always say which they use, usually right at the top. Everything below is in US terms. Each pattern in our shop states its own convention on the product page, so check there before you start.

## The four you cannot avoid

**\`ch\` — chain.** Yarn over, pull through the loop on your hook. Chains make foundations and gaps.

\`ch 12\` — twelve chains, which become the base for row 1.

**\`sc\` — single crochet.** The short, dense workhorse. Hook in, yarn over, pull up a loop, yarn over, through both.

\`sc in each st around\` — one single crochet into every stitch of the previous round.

**\`st\` / \`sts\` — stitch / stitches.** A stitch already in the work — what your hook goes *into*, as distinct from what you are making.

\`sc in next 5 sts\` — five stitches, one single crochet each.

**\`sl st\` — slip stitch.** Almost no height. It joins rounds, travels across stitches, and finishes edges.

\`sl st to first sc to join\` — close this round into a ring.

## The two that make things taller

**\`hdc\` — half double crochet.** Yarn over *before* going into the stitch, pull up a loop, then pull through all three loops at once.

**\`dc\` — double crochet.** Yarn over, into the stitch, pull up a loop, then work off two loops at a time. Taller and more open than single crochet, which is why blankets use it — the same area takes far less time.

> note: There is a pattern in the stitch family. Each extra yarn over before you enter the stitch adds one more "step" to work off, and one more unit of height: sc, hdc, dc, tr. Once you see that, new stitch names stop being separate things to memorise.

## The three that make shape

**\`inc\` — increase.** Two stitches into the same stitch. One more stitch than you started with.

\`(sc, inc) x 6\` — one plain stitch, then an increase, six times.

**\`dec\` — decrease.** Two stitches combined into one. One fewer stitch. The exact method depends on the pattern; in amigurumi, a designer may specify an invisible decrease (\`inv dec\`) instead.

**\`MR\` — magic ring.** An adjustable loop you work the first round into, then pull tight. It is how amigurumi starts without a hole in the middle. Some patterns write \`MC\` for magic circle, but \`MC\` can also mean main colour, so check the pattern's key.

\`6 sc in MR (6)\` — six single crochet into the ring, then close it.

> tip: In amigurumi you will often meet \`inv dec\` — an invisible decrease, worked through the front loops only of the next two stitches. It exists because an ordinary decrease leaves a small hole, and a hole is exactly where the stuffing shows.

## The three that tell you where and when

**\`rnd\` — round.** A circuit, rather than a row you turn at the end of.

**\`rep\` — repeat.** Do the marked sequence again — usually with parentheses or an asterisk marking what to repeat.

\`*sc, inc; rep from * around\` — that pair, all the way round.

**\`PM\` — place marker.** Put a stitch marker here. In a spiral there is no join, so the marker is the only thing that tells you where the round started.

## Reading them together

Every abbreviation above appears in these four lines:

\`\`\`
Rnd 1: 6 sc in MR (6)
Rnd 2: inc in each st around (12)
Rnd 3: (sc, inc) x 6 (18)
Rnd 4: sc in each st around (18)
\`\`\`

Read aloud: six single crochet into a magic ring, giving six stitches. An increase in every stitch, giving twelve. Then one plain stitch and one increase repeated six times, giving eighteen. Then a plain round that keeps eighteen.

Four lines, and you have a flat circle with a straight side starting — the beginning of most amigurumi pieces.

## Decoding one you have never seen

Unfamiliar abbreviations follow patterns of their own, and you can usually work out a new one before looking it up.

1. **A number inside it is a count.** \`sc2tog\` — single crochet two together, which is a decrease.
2. **Capitals are often a place.** \`BLO\` and \`FLO\` — back loop only, front loop only.
3. **A word plus "st"** names a stitch to work into rather than a stitch to make.
4. **The pattern's own key wins.** Designers do define custom abbreviations, and the key at the top is the authority.

## What not to memorise yet

Skip, until a pattern makes you care: cable and post stitches (\`FPdc\`, \`BPdc\`), the tall ones (\`dtr\`, \`trtr\`), and the garment-shaping vocabulary. They are not harder, they are just not on the path from here to your first finished piece.

## Where to go next

The [abbreviation dictionary](/resources/abbreviations) has the full list with US and UK differences marked, and the [pattern notation reference](/resources/reading-patterns) covers the punctuation — brackets, asterisks, stitch counts — that sits around the abbreviations. If you want to see all of it working together on a real pattern, [how to read a crochet pattern](/blog/how-to-read-a-crochet-pattern) reads one line by line.`,
  },
];
