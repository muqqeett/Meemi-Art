/**
 * The tutorials that ship with the content platform, as source.
 *
 * Kept in the repository for the same reasons the articles are: they are
 * reviewable in a diff before anyone can publish them, and they can be seeded
 * into a fresh database without a person retyping several thousand words.
 *
 * `npm run seed:content` writes them as DRAFTS. Publishing is a decision made
 * in the admin, by a person who has read them.
 *
 * Written for this shop. Nothing here is copied from another site, and nothing
 * claims an authority we do not have: no statistics, no invented author, no
 * "experts say". Where crochet has more than one accepted way of doing
 * something, these say so rather than picking one and calling it the rule.
 *
 * `steps` is authoring text in which each `##` heading starts a numbered step.
 */

export type SeedTutorial = {
  slug: string;
  title: string;
  excerpt: string;
  topicSlug: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  minutesMin: number | null;
  minutesMax: number | null;
  materials: string[];
  teaches: string[];
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  /** Product slugs to feature ahead of the technique matches. Evidence-based only. */
  productSlugs?: string[];
  intro: string;
  steps: string;
  outro?: string;
};

export const SEED_TUTORIALS: SeedTutorial[] = [
  {
    slug: "how-to-make-a-magic-ring",
    title: "How to make a magic ring",
    excerpt:
      "The adjustable loop that starts almost every amigurumi piece, worked step by step — how to form it, how to work the first round over it, how to close it so it stays closed, and when a chain start is the better choice instead.",
    topicSlug: "techniques",
    difficulty: "BEGINNER",
    minutesMin: 10,
    minutesMax: 20,
    materials: [
      "A smooth yarn you can see your stitches in — worsted or DK is easiest to learn on",
      "A hook a size or two below what the yarn label suggests, so the fabric is dense",
      "A stitch marker, or a scrap of contrasting yarn",
      "Scissors and a tapestry needle for the tail",
    ],
    teaches: ["single-crochet", "magic-ring", "working-in-rounds"],
    tags: ["amigurumi", "beginner"],
    seoTitle: "How to make a magic ring — step by step crochet tutorial",
    seoDescription:
      "Make a magic ring step by step: forming the loop, working the first round over it, closing the centre so it stays closed, and when a chain start works better.",
    productSlugs: ["no-sew-succulent-crochet-pattern"],
    intro: `By the end of this you will be able to start a round of crochet with no hole in the middle, and know why the first round of an amigurumi pattern almost always says to do it this way.

A **magic ring** — you will also see it written as a magic circle, an adjustable ring, or \`MR\` in a pattern — is a loop of yarn you crochet the first round into and then pull tight. The alternative, starting with a short chain joined into a circle, leaves a small hole at the centre that does not close. For a coaster or a doily that hole is fine, and sometimes it is the point. For a toy it is where the stuffing shows through, which is why amigurumi patterns tend to open with it.

:: diagram magic-ring

The technique is one movement repeated: the stitches are worked **around the strands that form the ring**, not into a chain. Everything below is that idea, slowed down.

If the abbreviations in a pattern's first round are the part giving you trouble rather than the ring itself, the [abbreviation dictionary](/resources/abbreviations) has them with what each one asks you to do.`,
    steps: `## Leave yourself a tail

Pull about 15 cm of yarn free of the ball before you start. That tail is what closes the ring later, and it is also what you weave in at the end, so it needs to be long enough to thread onto a tapestry needle.

A tail cut too short is the single most annoying thing to discover four rounds in, because the ring can no longer be pulled properly closed and there is nothing to sew in.

## Form the loop

Lay the yarn across your palm and make a loop so that the **working yarn crosses over the tail**. Which way round the crossing sits matters less than that it crosses — you should be holding a ring of yarn with a crossing point at the bottom.

Pinch that crossing point between your finger and thumb and keep it pinched. Everything in the next two steps happens while that pinch holds the ring's size steady.

> tip: If the loop keeps collapsing, wrap the yarn twice around two fingers instead and slide the ring off. It is the same ring, just easier to hold while your hands are learning the shape.

## Anchor the first loop on the hook

Put the hook into the centre of the ring from front to back, catch the working yarn, and draw it back up through the ring. You now have one loop on the hook.

Yarn over and draw through that loop to make one chain. This chain anchors the working yarn so the ring cannot unravel while you work into it.

> warning: That anchoring chain is **not** a stitch. Counting it is the most common reason a first round ends up with one stitch too many, and a round that starts wrong stays wrong.

## Work the first stitch over the ring

Now the stitch itself. For a single crochet:

1. Put the hook into the centre of the ring, passing under both strands of the ring.
2. Yarn over, and draw a loop up through the ring. Two loops on the hook.
3. Yarn over again, and draw through both loops.

That is one single crochet, and its base now sits **around** the ring rather than in a chain. This is the whole trick — nothing about the stitch has changed, only what you worked it into.

## Work the rest of the round

Repeat that stitch until you have the number the pattern asks for. A pattern will write it something like this:

\`\`\`
Rnd 1: 6 sc in MR (6)
\`\`\`

Six single crochet, all worked over the same ring, with the count in brackets at the end.

Do not pull the ring closed yet. Keep the stitches loose enough on the ring to slide, and count them before you go any further — six stitches should be six distinct V shapes sitting side by side along the ring.

## Pull the ring closed

Find the tail and pull it. The ring will draw in, and the stitches will gather into a tight circle with no gap in the middle.

If the ring will not close all the way, the tail may be the wrong strand — in a two-strand ring only one of them tightens the loop. Give each a gentle tug and use whichever moves the circle.

Pull firmly, but stop when the centre is closed rather than trying to cinch it beyond that. Over-tightening distorts the first round and makes the second one harder to work into.

## Place a marker and start round 2

Amigurumi is usually worked in a continuous spiral with no join, so nothing marks where a round begins. Put a stitch marker in the **first** stitch of round 1 before you work into it again, and move it up each round.

Your second round is then worked into the tops of the six stitches you just made — into the stitches, not into the ring. Most patterns increase in every stitch here, taking six to twelve.

## Secure the centre before you stuff

Once the piece is a few rounds along, give the tail one more firm tug. The first round loosens slightly as you work into it, and this is the moment to take that slack out.

Then thread the tail onto a tapestry needle and weave it into the fabric, changing direction at least once so friction holds it. Do not simply trim it flush — a tail cut at the centre of a magic ring is exactly where a closed ring works itself open again.`,
    outro: `## When it does not come out right

**There is still a hole in the middle.** Either the ring was not pulled fully closed, or the stitches were worked into the anchoring chain instead of over the ring. Both are fixable only by pulling the round out and starting again, which takes a minute at this stage.

**I have seven stitches instead of six.** The anchoring chain was counted as one. Undo the last stitch, recount, and carry on.

**The centre came open later.** The tail was trimmed too short or not woven in, or the yarn is slippery. Some yarns — mercerised cotton especially — hold a knot poorly, and it is worth sewing the centre closed with a couple of stitches on those.

**It looks fine but feels loose.** A magic ring on a hook that suits the yarn label will often be too open for a toy. Go down a size or two; the [hook size guide](/resources/hook-sizes) shows what each size is usually paired with.

## When a chain start is the better choice

The magic ring is not the only way to begin a round, and it is not always the right one.

- A **chain joined into a ring** (\`ch 4, sl st to first ch\`) gives a deliberate hole at the centre — which is what you want for a doily, a ring, or anything that hangs on something.
- A **chain-2 start** — two chains, then the round worked into the second chain from the hook — is more secure than a magic ring in slippery yarn, at the cost of a very small opening.
- For any piece that is **not stuffed**, a small centre hole is usually invisible in the finished object, so the more secure start costs nothing.

A pattern that specifies a magic ring is telling you the centre needs to be closed. A pattern that says "ch 2" or "ch 4 and join" is telling you it does not.

## Where to go next

The round you just started keeps going: [how to crochet in continuous rounds](/tutorials/how-to-crochet-in-continuous-rounds) covers keeping your place in a spiral and not losing count. When the piece starts closing again you will meet the decrease — [how to make an invisible decrease](/tutorials/how-to-make-an-invisible-decrease) is the version amigurumi patterns tend to ask for.

For the notation itself, [how to read a crochet pattern, line by line](/blog/how-to-read-a-crochet-pattern) walks through a whole pattern in the language it is written in.`,
  },

  {
    slug: "how-to-crochet-in-continuous-rounds",
    title: "How to crochet in continuous rounds",
    excerpt:
      "Working in a spiral with no join is how most amigurumi is made, and it is also where stitch counts go wrong. This covers finding the start of a round, using a marker properly, keeping the count honest, and how spirals differ from joined rounds.",
    topicSlug: "techniques",
    difficulty: "BEGINNER",
    minutesMin: 15,
    minutesMax: 25,
    materials: [
      "A piece already started in the round — a magic ring with one or two rounds worked is ideal",
      "A stitch marker, a safety pin, or a short length of contrasting yarn",
      "The pattern you are following, so you can check counts against it",
    ],
    teaches: ["single-crochet", "increase", "working-in-rounds"],
    tags: ["amigurumi", "beginner"],
    seoTitle: "How to crochet in continuous rounds — spirals without losing count",
    seoDescription:
      "Crochet in continuous rounds: how to mark the start of a round, keep stitch counts right, avoid accidental increases, and when joined rounds are used instead.",
    intro: `By the end of this you will be able to work round after round in a spiral without losing your place, and you will know how to tell — from the fabric rather than from hope — whether your count is still right.

A **continuous round** means you keep crocheting past the point where the round began instead of closing it. There is no slip stitch, no turning chain, and no seam. The work simply spirals outward or upward, which is why a ball made this way has no line running up it.

:: diagram spiral-vs-joined

The cost of that seamless fabric is that nothing in the work tells you where a round starts. In a joined round the slip stitch marks it for you. In a spiral, the only record is the marker you put there — which makes the marker part of the technique rather than an optional aid.`,
    steps: `## Know which kind of round you are in

Before anything else, read the pattern's rounds and look for a join.

- A round ending \`sl st to first sc to join\` and often followed by a chain is a **joined round**.
- A round ending with nothing but a stitch count — \`sc in each st around (18)\` — is a **continuous round**.

If the pattern's notes mention a stitch marker at all, it is almost certainly a spiral. Patterns for toys usually are; patterns for hats, granny squares and motifs are often joined.

## Place the marker in a stitch, not the gap

Work the first stitch of the round, then put the marker through that stitch. Put it through the stitch itself — under the top V — rather than into the space beside it, or it will drift and record the wrong place.

Two things that work as a marker: a locking stitch marker or safety pin clipped through the stitch, or a short length of contrasting yarn laid across the work and caught between stitches as you pass it. The scrap of yarn is useful on long pieces because it leaves a visible trail of where each round started.

> tip: Decide once whether your marker goes in the **first** stitch of the round or the **last**, and never change. Both work. Mixing them is what produces a round that is one stitch out with no obvious cause.

## Work the round, then move the marker

Crochet all the way around until you reach the marked stitch again. The marked stitch is the next one to work into — you have not finished the round until you are about to work into it.

Take the marker out, work that stitch, and put the marker back into the stitch you just made. That single stitch is now the start of the new round.

Doing it in that order is what keeps the marker meaningful. Moving it before working the stitch, or after working two, shifts your idea of where the round begins by one stitch each time.

## Count at the end of every round

Not at the end of the piece. At the end of every round.

\`\`\`
Rnd 1: 6 sc in MR (6)
Rnd 2: inc in each st around (12)
Rnd 3: (sc, inc) x 6 (18)
Rnd 4: (2 sc, inc) x 6 (24)
\`\`\`

The bracketed number is a check, not decoration. If round 3 should give 18 and you count 17, the mistake is in round 3 — one round to unpick. Finding it at round 9 means unpicking six rounds, because you cannot tell which one lost the stitch.

Count the V shapes along the top edge, using the marker as your starting point and stopping when you come back to it.

## Catch an accidental increase early

The most common error in a spiral is two stitches worked into one, which adds a stitch nobody asked for. It happens for two reasons worth recognising:

1. **Working into the marked stitch twice** — usually from moving the marker at the wrong moment.
2. **Working into the gap beside a stitch** rather than into the stitch, most often in the round straight after a magic ring, where the stitches sit close together.

An accidental increase shows up in the fabric before it shows up in your count: the edge starts to ruffle or wave slightly, because the piece has more stitches than the shape needs.

The mirror-image error — a skipped stitch — is a decrease nobody asked for, and it pulls the piece in and makes it cup.

## Read your own fabric

Once a few rounds are done, the work itself tells you whether the counts are right.

| What you see | What it usually means |
| --- | --- |
| The circle lies flat | The increases are matching the shape |
| The edge ruffles or frills | Too many stitches — check for accidental increases |
| The piece cups into a bowl | Too few stitches, or the shaping has begun |
| A visible spiral line of gaps | Working into the gaps rather than the stitch tops |

This is worth learning because it is faster than counting. A ruffle at round 12 tells you to count; a flat circle tells you not to bother.

## Finish a spiral without a step

A spiral ends slightly higher than it began, so the last round leaves a small step. Two ways patterns handle it:

- Work a **slip stitch** into the next stitch after the final one, then fasten off. That brings the height down and makes the step much less visible.
- **Fasten off** and use the tail to close the piece anyway, which is usual for anything that gets stuffed and closed at the top.

Either is fine, and the pattern will often say which. If it does not, and the edge will be visible, the slip stitch is the tidier finish.`,
    outro: `## When it does not come out right

**I have lost the marker.** Find the beginning of the round from the fabric instead: in a spiral the last stitch of the round sits one step lower than its neighbour, and there is a small visible jog where the rounds overlap. Count back from your hook to that jog, place the marker, and check the total against the pattern before continuing.

**My count is one out and I cannot see where.** Work back to the previous round's count instead of hunting. Unpicking one round and recounting is usually quicker than searching a whole round stitch by stitch, and it leaves you with a count you can trust.

**The count is right but the shape is wrong.** Check *where* the increases fell, not how many there were. Six increases spread evenly make a flat circle; six increases bunched together make a corner. Patterns write them as a repeat — \`(sc, inc) x 6\` — precisely to spread them out.

**The stitches are so tight I cannot get the hook in.** That is usually a hook one size too small for the yarn rather than a technique problem. Going up a size costs you a little density; the [hook size guide](/resources/hook-sizes) covers the trade.

## Spirals and joined rounds, side by side

| | Continuous spiral | Joined rounds |
| --- | --- | --- |
| How a round ends | Carry straight on | Slip stitch into the first stitch |
| Seam | None | A visible vertical line |
| Keeping your place | A stitch marker | The join itself |
| Usually used for | Amigurumi, anything stuffed | Hats, motifs, colour-change rounds |

Neither is better. Joined rounds make colour changes much tidier, because every change happens at the same point rather than drifting around the piece, which is one reason a striped hat is often worked joined even when the toy wearing it was not.

## Where to go next

If you have not made the start yet, [how to make a magic ring](/tutorials/how-to-make-a-magic-ring) covers the round this one continues. When the piece begins to close, [how to make an invisible decrease](/tutorials/how-to-make-an-invisible-decrease) is the shaping most amigurumi patterns ask for, and [how to read crochet stitch counts and repeats](/tutorials/how-to-read-crochet-stitch-counts-and-repeats) goes further into the notation those counts are written in.`,
  },

  {
    slug: "how-to-make-an-invisible-decrease",
    title: "How to make an invisible decrease",
    excerpt:
      "A decrease worked through the front loops only, which closes a stitch without leaving the small hole an ordinary decrease does. This covers how to work it, how it differs from a standard decrease, and when each one is the right choice.",
    topicSlug: "techniques",
    difficulty: "BEGINNER",
    minutesMin: 10,
    minutesMax: 20,
    materials: [
      "A piece worked in the round with at least 12 stitches, so there is room to practise",
      "A smooth, light-coloured yarn — the loops are much easier to see than on dark or fluffy yarn",
      "A stitch marker, if you are working in a spiral",
    ],
    teaches: ["single-crochet", "front-back-loop-only", "invisible-decrease", "working-in-rounds"],
    tags: ["amigurumi", "beginner"],
    seoTitle: "How to make an invisible decrease in crochet — step by step",
    seoDescription:
      "Work an invisible decrease through the front loops only: the steps, how it differs from a standard sc2tog decrease, common mistakes, and when to use each.",
    productSlugs: ["no-sew-succulent-crochet-pattern"],
    intro: `By the end of this you will be able to reduce a round by one stitch with very little visible gap, and know when that is worth doing rather than working an ordinary decrease.

Every crochet stitch has two loops across its top: a **front loop** nearer you and a **back loop** behind it. An ordinary decrease takes both loops of two stitches and works them off together. An **invisible decrease** takes only the front loop of each, which uses less of the stitch top and leaves a noticeably smaller opening.

:: diagram invisible-decrease

It matters most where a hole would show something. On a stuffed piece, decreases are exactly where the fabric is under the most tension, so a decrease that leaves a gap is a gap the stuffing can push through. That is why amigurumi patterns tend to ask for it.

It is worth saying plainly: an invisible decrease is **one option, not a rule**. Plenty of patterns use an ordinary decrease and look entirely right. The pattern's own instruction decides, and where it just says \`dec\` the method is usually left to you.

You will see it written as \`inv dec\`, \`invdec\`, or spelled out. If you are unsure what a pattern is asking for, the [abbreviation dictionary](/resources/abbreviations) lists both decreases with what each one does.`,
    steps: `## Find the front loops

Look at the top of the next stitch. You should see two strands forming a V. The one nearer you — nearer your body, on the side of the fabric facing you — is the front loop. The one behind it is the back loop.

Slide your hook under just the front loop of the next stitch and stop there. Do not pick up the back loop. If you can see the back loop still sitting free behind your hook, you are in the right place.

> tip: On dark or fuzzy yarn this is genuinely hard to see. Practise it once on a light, smooth yarn so your hands know the movement, then the feel carries over to yarns you cannot see into.

## Pick up the second front loop

Without yarning over, move the hook forward and slide it under the front loop of the **next** stitch as well.

You now have two front loops on the hook, plus the working loop that was already there — three loops in total. Nothing has been yarned over yet, and that is the part that feels wrong the first few times.

## Yarn over and draw through both front loops

Yarn over, then draw the working yarn through both front loops at once. Two loops remain on the hook.

This is the step that merges the two stitches. Keep it slightly looser than feels natural; drawing through two loops at once is tighter than an ordinary stitch and over-tightening here is what makes the next round hard to work into.

## Yarn over and close the stitch

Yarn over once more and draw through both remaining loops.

That is the decrease complete. Two stitches of the previous round have become one stitch, and the round's count has gone down by one.

## Check what you made

Look at the stitch you just finished, then at the plain stitches either side of it.

The decrease should look slightly narrower than its neighbours and should not have an obvious opening at its base. You will still be able to find it if you look — "invisible" is relative, not literal — but it should not read as a hole.

Run a fingertip over the outside of the fabric. A decrease that leaves a bump or a visible gap usually means both loops were picked up on one of the stitches rather than just the front.

## Work a full decrease round

Patterns write a decrease round as a repeat, so the decreases are spread evenly rather than bunched:

\`\`\`
Rnd 10: (4 sc, dec) x 6 (30)
Rnd 11: (3 sc, dec) x 6 (24)
Rnd 12: (2 sc, dec) x 6 (18)
\`\`\`

Each round loses six stitches, and the plain run between decreases shrinks by one each time — the mirror image of the increase rounds that opened the piece.

Count at the end of each of these rounds. Decrease rounds are where a miscount changes the shape most, because the piece is closing and there is less fabric to hide an error in.

## Compare it against an ordinary decrease

Worth doing once, on a swatch you are going to throw away.

Work one decrease through the front loops only, then work the next one the ordinary way — hook under both loops of the next stitch, pull up a loop, both loops of the stitch after, pull up a loop, then yarn over and through all three.

Hold the swatch up to the light. The ordinary decrease will show a small opening at its base that the invisible one does not. That difference is the whole reason the technique exists, and seeing it once settles the question of whether it is worth the extra care.`,
    outro: `## When it does not come out right

**There is still a hole.** The most likely cause is that both loops were picked up on the second stitch. It is an easy slip, because the hook naturally wants to go under the whole V.

**The decrease sits proud of the fabric.** Usually the two front loops were drawn through too tightly, which forces the merged stitch to stand up. Working the middle step a little looser generally fixes it.

**It looks fine from the inside and wrong from the outside.** Check which side you are calling the front. Working in the round, the front loop is the loop nearest you as you work, which is the outside of the piece for most amigurumi — the fabric's right side faces out.

**I cannot find the loops at all.** The yarn is probably working against you rather than your hands. Fluffy, boucle and very dark yarns hide stitch tops; so does a hook small enough that the stitches are compressed. Practise on something smooth and light first.

## Choosing between the two decreases

| | Invisible decrease | Ordinary decrease |
| --- | --- | --- |
| Loops used | Front loop of each stitch | Both loops of each stitch |
| Opening left | Very small | Small but usually visible |
| Fabric | Slightly tighter | Slightly more relaxed |
| Often used for | Stuffed pieces, anything where a gap would show | Flat work, garments, open stitch patterns |

A pattern that says \`inv dec\` wants this one. A pattern that says \`sc2tog\` wants the ordinary one. A pattern that says only \`dec\` is usually leaving it to you — and on a stuffed piece the invisible version is generally the safer choice.

Do not go back and change a finished piece's decreases because of this. A toy worked with ordinary decreases and stuffed carefully is a perfectly good toy.

## Where to go next

Decreases are the second half of a shape that increases first: [how to make a magic ring](/tutorials/how-to-make-a-magic-ring) and [how to crochet in continuous rounds](/tutorials/how-to-crochet-in-continuous-rounds) cover the opening rounds these mirror. To read the rounds themselves with more confidence, [how to read crochet stitch counts and repeats](/tutorials/how-to-read-crochet-stitch-counts-and-repeats) takes the notation apart.`,
  },

  {
    slug: "how-to-change-yarn-colors-cleanly",
    title: "How to change yarn colours cleanly",
    excerpt:
      "Where in a stitch to make a colour change so the join does not show, whether to carry the old colour or cut it, how to deal with the tails, and how to keep a stripe from loosening at the point it changes.",
    topicSlug: "techniques",
    difficulty: "INTERMEDIATE",
    minutesMin: 20,
    minutesMax: 30,
    materials: [
      "Two contrasting colours of the same yarn weight, so the tension does not change with the colour",
      "A tapestry needle for the tails",
      "Scissors",
      "A stitch marker, if you are working in a spiral",
    ],
    // Not `working-in-rows`: this explains how a colour change behaves in rows
    // versus rounds, but it does not teach working in rows, and tagging it that
    // way matched a single-colour garment pattern on a technicality.
    teaches: ["single-crochet", "working-in-rounds", "color-changes"],
    tags: ["colorwork", "intermediate"],
    seoTitle: "How to change yarn colours cleanly in crochet — step by step",
    seoDescription:
      "Change crochet colours cleanly: where in the stitch to swap, carrying versus cutting the old colour, managing tails, and keeping stripe joins tight.",
    productSlugs: ["winter-woodland-reindeer-crochet-pattern"],
    intro: `By the end of this you will be able to change colour without a half-and-half stitch at the join, and you will be able to decide — for the piece in front of you — whether to carry the old colour along or cut it.

There is one idea doing most of the work here. **The last yarn over of a stitch makes the top of that stitch**, and the top of a stitch is what the next round sits on. So if you want a clean line between two colours, the swap happens on the final yarn over of the last stitch in the old colour — not after that stitch is finished.

Change after finishing the stitch instead and you get a stitch whose body is one colour and whose top is the other. It is not a mistake exactly; it just reads as a slightly blurred line, and once you can see it you will see it everywhere.

Everything after that first idea is practical: what to do with two working yarns and four tail ends.`,
    steps: `## Work up to the last yarn over

Take the final stitch of the old colour as far as the point where one yarn over would finish it.

For a single crochet that means: hook in, yarn over, pull up a loop — and stop, with two loops on the hook. For a double crochet it means stopping when two loops remain, after you have worked off the first pair.

The rule generalises: stop when the next yarn over would close the stitch.

## Complete the stitch with the new colour

Drop the old colour. Pick up the new one, yarn over with it, and draw it through the loops on the hook to finish the stitch.

The stitch you just completed still has an old-colour body, but its **top** is now the new colour — and that top is what the next stitch works into. The colour boundary now falls between rounds instead of through the middle of a stitch.

Leave a tail of about 12 cm on the new colour. You will need it.

> tip: Hold the new yarn's tail against the work with the finger you already use for tension, rather than trying to hold it separately. The first two stitches in a new colour are the loose ones, and a little grip there is what keeps them even.

## Decide: carry it, or cut it

This is the decision that changes most about how the piece is worked, and it depends on how far apart the changes are.

**Carry the old colour** when you will need it again within a few rounds. You lay the unused strand along the top of the previous round and work over it, so it is enclosed inside the new stitches and ready when you reach it.

- Nothing to weave in.
- No tails at each change.
- The carried strand can show faintly through, especially on a light colour over a dark one.
- The fabric is slightly thicker and firmer where it runs.

**Cut the old colour** when you will not come back to it soon, or at all.

- Cleanest on the right side.
- Each change leaves two tails to weave in.
- Cut too short and the join can work loose.

There is no universally right answer. A striped hat with a change every two rounds is usually carried. A toy that changes from body colour to hat colour once is usually cut.

## If you are carrying: enclose the strand

Lay the old colour along the top of the round you are about to work into, so it lies where your stitches will be made.

Work the new colour's stitches normally, putting the hook into each stitch **above** the carried strand so the strand ends up enclosed in the base of each new stitch. Keep it relaxed — a carried strand pulled tight puckers the fabric, and it is hard to fix later.

When you come back round to the colour you carried, it is waiting at the point you need it, with no tail to join.

## If you are cutting: deal with the tails now

Cut the old colour leaving about 12 cm, and weave both tails in before you carry on. Not at the end of the piece — now, while you can still see exactly where the change was.

Thread the tail onto a tapestry needle and run it through the **inside** of the stitches for four or five stitches, then change direction and go back a couple. That change of direction is what stops it pulling out; a straight run will eventually work its way free.

For a stuffed piece, weaving on the inside also hides the tail completely. Once the piece is closed you cannot get to it, which is the other reason not to save this up.

## Tighten the join

The first stitch of a new colour is almost always looser than its neighbours, because there was nothing anchoring the yarn when it was made.

Give the new colour's tail a gentle pull to snug that stitch up to the size of the ones around it. Compare it with the stitch before and after, not with your idea of what it should look like.

Do not over-pull. A join tightened past its neighbours puckers the row and shows up as a dimple along the colour change.

## Work a stripe and look at the line

Work four rounds in colour A, four in colour B, and four in A again, changing on the last yarn over each time.

Then look at where the colours meet. A clean change gives a boundary that runs along the round. If you can see single stitches of the wrong colour sitting in the line, the change happened one stitch late or one stitch early — worth noting which, because it is a consistent habit rather than a random slip.

In a **continuous spiral** the change point drifts around the piece by one stitch's width each round, so a stripe will always step slightly. That is the geometry of a spiral, not an error. Patterns that want a truly level stripe usually switch to joined rounds for that section.`,
    outro: `## When it does not come out right

**One stitch is half each colour.** The change happened after the stitch was finished rather than on its last yarn over. Work the next change one yarn over earlier.

**The stripe steps up by a stitch.** In a spiral, expected — see the last step. In joined rounds, check that the change is happening at the same point relative to the join each time.

**The first stitch of each colour is loose.** Pull the new colour's tail gently after the change, and hold the tail against the work for the first two stitches.

**The join came undone after a few days.** The tail was too short or woven in a straight line. Weave in at least four or five stitches with one change of direction.

**The carried colour shows through.** A pale yarn carried under a dark one will often shadow. Either cut instead of carrying for that combination, or carry it along the wrong side if the piece has one.

**The fabric puckers where colours meet.** Usually a carried strand held too tight, or a join tightened too far. Both are more comfortable slightly looser than feels right.

## Carrying versus cutting, in short

| | Carry | Cut |
| --- | --- | --- |
| Best when | The colour returns within a few rounds | The colour is done, or returns much later |
| Tails | None at the change | Two per change |
| Right side | Can shadow slightly | Cleanest |
| Fabric | A little thicker and firmer | Unchanged |
| Extra work | Keeping the strand relaxed | Weaving in as you go |

## Where to go next

Colour changes sit on top of the basics: [how to crochet in continuous rounds](/tutorials/how-to-crochet-in-continuous-rounds) covers why a stripe steps in a spiral, and [how to read crochet stitch counts and repeats](/tutorials/how-to-read-crochet-stitch-counts-and-repeats) covers the notation patterns use to tell you when to change.

If you are matching two yarns for a colourwork piece, the [yarn weight guide](/resources/yarn-weights) covers substituting one for another without changing the gauge partway through a project.`,
  },

  {
    slug: "how-to-read-crochet-stitch-counts-and-repeats",
    title: "How to read crochet stitch counts and repeats",
    excerpt:
      "The brackets, asterisks and numbers in a pattern line, taken apart one at a time — what the count at the end of a round is for, where a repeat starts and stops, and what to do when your number and the pattern's number disagree.",
    topicSlug: "reading-patterns",
    difficulty: "BEGINNER",
    minutesMin: 15,
    minutesMax: 25,
    materials: [
      "Any written pattern you are partway through, or the worked example below",
      "Yarn and a hook, if you want to work the example as you read",
      "A stitch marker, for the worked example",
    ],
    teaches: ["single-crochet", "increase", "working-in-rounds"],
    tags: ["beginner", "patterns"],
    seoTitle: "How to read crochet stitch counts and repeats — with a worked example",
    seoDescription:
      "Read crochet repeats and stitch counts: what brackets and asterisks enclose, how counts check your work, and what to do when your count does not match.",
    intro: `By the end of this you will be able to take a line like \`Rnd 5: (3 sc, inc) x 6 (30)\` apart with confidence — knowing what repeats, how many times, and what the last number is there to tell you.

This is the hands-on companion to [how to read a crochet pattern, line by line](/blog/how-to-read-a-crochet-pattern). That article walks through a whole pattern as a document: the materials list, the gauge, the abbreviation key. This one does one thing instead — the arithmetic and punctuation inside a single round — and asks you to work a small example while you read it.

If the abbreviations themselves are the sticking point, the [abbreviation dictionary](/resources/abbreviations) has them; the [pattern notation reference](/resources/reading-patterns) is the same material as this tutorial arranged for looking things up mid-project rather than reading through.`,
    steps: `## Separate the three numbers in a line

A round typically carries three kinds of number, and they mean entirely different things.

\`\`\`
Rnd 5: (3 sc, inc) x 6 (30)
\`\`\`

- **\`Rnd 5\`** — which round this is. A position in the pattern, not a quantity.
- **\`3\` and \`x 6\`** — how much to do. Three plain stitches inside the repeat, and the repeat worked six times.
- **\`(30)\`** — how many stitches you should have when the round is finished.

Mistaking the round number for a stitch count is a common early slip, and reading the final count as an instruction is another. Nothing in \`(30)\` tells you to work thirty of anything; it tells you what to count.

:: diagram repeat-brackets

## Find where the repeat starts and stops

The brackets enclose exactly what repeats — nothing before them, nothing after.

In \`(3 sc, inc) x 6\`, the repeat is "three single crochet, then one increase". That is four stitches made per repeat. The \`x 6\` says work that group six times, and then the round is over.

Patterns write the same idea three ways, and which one a designer uses is habit:

| Notation | Means |
| --- | --- |
| \`(3 sc, inc) x 6\` | Work the bracketed group six times |
| \`*3 sc, inc; rep from * around\` | Work it from the asterisk until the round ends |
| \`[3 sc, inc] 6 times\` | The same as the first |

With an asterisk and "around", the pattern is not telling you how many repeats — it expects the stitch count to come out even and leaves you to work to the end of the round.

## Work out what a repeat does to the count

This is the part worth doing once by hand, because after that you will trust the pattern's numbers instead of checking them.

Each \`3 sc, inc\` repeat **consumes** four stitches of the previous round: three for the plain stitches, one for the increase. It **produces** five: three plain, plus two from the increase.

Six repeats therefore consume 24 stitches and produce 30. Which is why the previous round ended \`(24)\` and this one ends \`(30)\`.

> note: The count going in has to be divisible by what the repeat consumes, or the repeat will not fit. If a round of 24 asks for a repeat consuming four stitches, six repeats fit exactly. If your count going in is 23, nothing after it will work — which is why the previous round's number matters more than the current one.

## Work the example

Six rounds, which make a flat circle — useful on its own as a coaster, and the opening of most amigurumi pieces.

\`\`\`
Rnd 1: 6 sc in MR (6)
Rnd 2: inc in each st around (12)
Rnd 3: (sc, inc) x 6 (18)
Rnd 4: (2 sc, inc) x 6 (24)
Rnd 5: (3 sc, inc) x 6 (30)
Rnd 6: (4 sc, inc) x 6 (36)
\`\`\`

Work it with a marker in the first stitch of each round, and **count at the end of every round** before starting the next.

Read the shape of it as you go: every round adds exactly six stitches, and the plain run between increases grows by one each time. Once you have seen that, round 7 is predictable without being told — \`(5 sc, inc) x 6 (42)\`.

## Count what you have, not what you expect

Counting sounds trivial and is where most of the value is, so it is worth doing deliberately.

1. Start at the marked stitch.
2. Count the V shapes along the top edge, one per stitch.
3. Stop when you come back to the marker.
4. Compare with the number in brackets.

An increase is two stitches and counts as two — the two Vs sitting in the same base. A decrease is one stitch and counts as one, however many stitches went into making it.

## Fix a count that does not match

If your number and the pattern's disagree, the difference tells you what happened.

| Difference | Usually |
| --- | --- |
| One too many | An accidental increase, or a marker moved at the wrong moment |
| One too few | A skipped stitch |
| Several too many | A repeat worked one time too often |
| Several too few | A repeat stopped one time early |
| Wildly out | Counting the anchoring chain, or counting into the previous round |

The repair is the same in every case: **go back to the last round you know was right** and rework from there. Hunting for a single stitch in a round of thirty takes longer than working the round again, and it can leave you with the count right and the increases in the wrong places.

## Read a nested repeat

Occasionally a repeat contains a repeat:

\`\`\`
Rnd 8: [(sc, inc) x 3, 2 sc] x 2 (46)
\`\`\`

Work it from the inside out. \`(sc, inc) x 3\` is "one plain stitch, one increase" three times — six stitches consumed, nine produced. Then \`2 sc\`. That whole group, the inner repeat plus the two plain stitches, is what the outer \`x 2\` repeats.

If a line like this stops making sense, write it out longhand once on paper. It is not a skill you need often, and longhand is faster than staring at it.`,
    outro: `## When it does not come out right

**The repeat does not fit the round.** Check the previous round's count first — a repeat that will not divide into the stitches available almost always means the count going in is wrong, not that the pattern is.

**I cannot tell what the bracket covers.** Look for the comma pattern. \`(3 sc, inc)\` has the whole instruction inside; if a number sits outside the bracket it is a count of repeats, not part of them.

**The last stitch of the round has nowhere to go.** Usually a skipped stitch earlier in the same round. Count back from the marker and find where the run breaks.

**My count is right but the circle is not flat.** The increases are probably bunched rather than spread. A repeat exists to distribute them; working all six increases together gives the right count and the wrong shape.

**The pattern's count is genuinely wrong.** It happens, even in tested patterns. Work out what the round should produce from what it consumes, trust your own arithmetic, and carry on — but check the pattern's own errata or notes first, because a designer will usually have caught it.

## Keep these to hand

Stitch counts are the cheapest error check in crochet, and the habit is the whole technique: count at the end of every round, compare with the bracket, and fix it while it is one round old.

## Where to go next

For the rest of what a pattern contains — materials, gauge, turning chains, charts — [how to read a crochet pattern, line by line](/blog/how-to-read-a-crochet-pattern) covers the document as a whole, and [the crochet abbreviations worth learning first](/blog/crochet-abbreviations-for-beginners) covers the shorthand inside the lines.

To put the counting to work, [how to crochet in continuous rounds](/tutorials/how-to-crochet-in-continuous-rounds) is where keeping the count honest matters most.`,
  },
];
