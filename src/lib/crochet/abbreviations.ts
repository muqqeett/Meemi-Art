/**
 * The abbreviations a crochet pattern actually uses.
 *
 * Written in US terms, with the UK equivalent named wherever the same word
 * means a different stitch on the other side of the Atlantic — which is the
 * single most expensive misunderstanding in crochet. Patterns in this shop use
 * both conventions and each one states its own on the product page, so nothing
 * here assumes a reader is holding a US pattern.
 *
 * The US/UK stitch pairs are checked against published conversion charts and
 * agree across them. The grouping below is editorial — a way to arrange the
 * list for reading, not an official taxonomy.
 *
 * Each entry says what the abbreviation stands for *and* what the instruction
 * asks you to do. A list that only expands "sc" to "single crochet" helps
 * nobody who did not already know.
 *
 * Data, not prose, so the page, the search and the tests all read one source.
 */

export type AbbreviationGroup = "stitches" | "shaping" | "placement" | "structure" | "instructions";

export const ABBREVIATION_GROUPS: { slug: AbbreviationGroup; label: string; blurb: string }[] = [
  { slug: "stitches", label: "Stitches", blurb: "The stitches themselves, shortest to tallest." },
  { slug: "shaping", label: "Shaping", blurb: "Adding and removing stitches to make a flat piece curve." },
  { slug: "placement", label: "Where to work", blurb: "Which loop, which stitch, which space the hook goes into." },
  { slug: "structure", label: "Rows, rounds and sides", blurb: "How a pattern describes the shape of the work." },
  { slug: "instructions", label: "Instruction shorthand", blurb: "Words that appear in the instructions rather than in the stitching." },
];

export type Abbreviation = {
  abbr: string;
  /** Other spellings you will meet for the same thing. */
  aliases?: string[];
  term: string;
  group: AbbreviationGroup;
  /** What the instruction is asking you to do. */
  meaning: string;
  /** A real fragment of pattern language using it. */
  example?: string;
  /** Set only where the same abbreviation means something else in UK terms. */
  ukNote?: string;
};

export const ABBREVIATIONS: Abbreviation[] = [
  {
    abbr: "ch",
    term: "chain",
    group: "stitches",
    meaning:
      "Yarn over and pull through the loop on your hook. Chains make the starting length for rows, and they make the gaps and bridges inside a pattern.",
    example: "ch 12 — make twelve chains, which become the foundation for row 1.",
  },
  {
    abbr: "sl st",
    aliases: ["ss"],
    term: "slip stitch",
    group: "stitches",
    meaning:
      "Put the hook through the stitch, yarn over, and pull the yarn through both the stitch and the loop on your hook in one movement. It adds almost no height, so it is used to join rounds, travel across stitches and finish edges.",
    example: "sl st to first sc to join — closes the round into a ring.",
  },
  {
    abbr: "sc",
    term: "single crochet",
    group: "stitches",
    meaning:
      "Hook through the stitch, yarn over, pull up a loop (two loops on the hook), yarn over, pull through both. Short and dense, which is why amigurumi is almost entirely single crochet.",
    example: "sc in each st around — one single crochet into every stitch of the previous round.",
    ukNote: "A UK pattern calls this stitch double crochet (dc). Same stitch, different name.",
  },
  {
    abbr: "hdc",
    term: "half double crochet",
    group: "stitches",
    meaning:
      "Yarn over before you go into the stitch, pull up a loop (three loops on the hook), then yarn over and pull through all three at once. Taller than single crochet, denser than double.",
    ukNote: "Called half treble (htr) in UK terms.",
  },
  {
    abbr: "dc",
    term: "double crochet",
    group: "stitches",
    meaning:
      "Yarn over, into the stitch, pull up a loop (three loops), yarn over and through two, yarn over and through the last two. Tall and open — the everyday stitch of blankets and garments.",
    ukNote: "Called treble (tr) in UK terms. In a UK pattern, dc means single crochet.",
  },
  {
    abbr: "tr",
    aliases: ["trc"],
    term: "treble crochet",
    group: "stitches",
    meaning:
      "Yarn over twice before entering the stitch, then work off two loops at a time, three times. Taller again, and noticeably lacier.",
    ukNote: "Called double treble (dtr) in UK terms.",
  },
  {
    abbr: "st / sts",
    term: "stitch / stitches",
    group: "structure",
    meaning: "A stitch already in the work — the thing your hook goes into, rather than the thing you are making.",
    example: "sc in next 5 sts — one single crochet into each of the next five existing stitches.",
  },
  {
    abbr: "inc",
    term: "increase",
    group: "shaping",
    meaning:
      "Work two stitches into the same stitch, which adds one to the count. In amigurumi this is what turns a flat disc into something that grows outward.",
    example: "(sc, inc) x 6 — alternate a plain stitch and an increase six times, adding six stitches to the round.",
  },
  {
    abbr: "dec",
    term: "decrease",
    group: "shaping",
    meaning:
      "Combine two stitches into one, which removes one from the count. How a piece narrows, closes, or shapes a shoulder. The exact method depends on the pattern; in amigurumi, a designer may specify an invisible decrease (inv dec) instead, so read the key rather than assuming.",
  },
  {
    abbr: "inv dec",
    aliases: ["invdec"],
    term: "invisible decrease",
    group: "shaping",
    meaning:
      "One specific decrease method, worked through the front loops only of the next two stitches. It leaves a much smaller hole than an ordinary decrease, which matters when stuffing would show through — but it is not what every pattern means by dec, so only work it where the pattern asks for it.",
  },
  {
    abbr: "sc2tog",
    aliases: ["dc2tog", "hdc2tog"],
    term: "work two together",
    group: "shaping",
    meaning:
      "The long form of a decrease: work the named stitch across two stitches and finish them as one. The number tells you how many stitches are being merged.",
  },
  {
    abbr: "MR",
    aliases: ["magic ring", "magic circle"],
    term: "magic ring",
    group: "shaping",
    meaning:
      "An adjustable loop you crochet the first round into, then pull tight. It starts a round with no hole in the middle, which is why amigurumi patterns begin with it. Some patterns write MC for magic circle, but MC also means main colour in colourwork, so always check the pattern's own key before assuming which it is.",
    example: "6 sc in MR — six single crochet into the ring, then pull the tail to close it.",
  },
  {
    abbr: "BLO",
    term: "back loop only",
    group: "placement",
    meaning:
      "Work into the back loop of the stitch instead of both loops. The unused front loops leave a visible ridge — used to make a fold, a sole, or a deliberate line.",
  },
  {
    abbr: "FLO",
    term: "front loop only",
    group: "placement",
    meaning: "The same idea as BLO, in the other loop. Often used to add a surface round of petals, frills or texture.",
  },
  {
    abbr: "sp",
    term: "space",
    group: "placement",
    meaning: "The gap between stitches — usually made by a chain — that you work into rather than into a stitch itself.",
    example: "3 dc in ch-2 sp — three double crochet worked into the hole made by a two-chain.",
  },
  {
    abbr: "sk",
    term: "skip",
    group: "placement",
    meaning: "Pass over a stitch without working into it. Nearly always paired with a chain that replaces its width.",
  },
  {
    abbr: "yo",
    term: "yarn over",
    group: "instructions",
    meaning: "Wrap the yarn over the hook from back to front. The building block every stitch is described in terms of.",
  },
  {
    abbr: "rnd",
    term: "round",
    group: "structure",
    meaning:
      "A circuit worked in a spiral or joined circle, rather than turning at the end. Amigurumi is worked in rounds.",
  },
  {
    abbr: "RS / WS",
    term: "right side / wrong side",
    group: "structure",
    meaning:
      "The face of the fabric meant to be seen, and the one that faces inward. Patterns say which side you should be looking at when a row begins.",
  },
  {
    abbr: "tch",
    aliases: ["t-ch"],
    term: "turning chain",
    group: "structure",
    meaning:
      "The chains worked at the start of a row to reach the height of the stitch that follows. Whether the turning chain counts as a stitch is decided by the pattern, and it must be read carefully — it changes every stitch count in the row.",
  },
  {
    abbr: "rep",
    term: "repeat",
    group: "instructions",
    meaning:
      "Do the marked sequence again. What to repeat is usually held inside brackets or between asterisks, with a count after it.",
    example: "*sc, inc; rep from * around — repeat that pair for the whole round.",
  },
  {
    abbr: "beg",
    term: "beginning",
    group: "instructions",
    meaning: "The start of the row or round being described, usually pointing at the first stitch or the turning chain.",
  },
  {
    abbr: "rem",
    term: "remaining",
    group: "instructions",
    meaning: "Whatever is left after the instruction just given — often the last few stitches of a row.",
  },
  {
    abbr: "PM",
    term: "place marker",
    group: "instructions",
    meaning:
      "Put a stitch marker here. In spiral rounds it marks where the round began, because there is no join to show you.",
  },
  {
    abbr: "FO",
    term: "fasten off",
    group: "instructions",
    meaning:
      "Cut the yarn, pull the tail through the last loop and tighten. Usually followed by weaving the end in so it cannot work loose.",
  },
];

/** Every abbreviation, indexed by its primary short form. */
export const ABBREVIATION_BY_ABBR = new Map(ABBREVIATIONS.map((entry) => [entry.abbr.toLowerCase(), entry]));

export function abbreviationsInGroup(group: AbbreviationGroup): Abbreviation[] {
  return ABBREVIATIONS.filter((entry) => entry.group === group);
}

/**
 * The US/UK pairs, as a table.
 *
 * Kept separate from the list above because this is the fact that causes real
 * damage: the same two letters name a different stitch in each convention.
 */
export const US_UK_STITCH_NAMES: { us: string; uk: string }[] = [
  { us: "slip stitch (sl st)", uk: "slip stitch (ss or sl st)" },
  { us: "single crochet (sc)", uk: "double crochet (dc)" },
  { us: "half double crochet (hdc)", uk: "half treble (htr)" },
  { us: "double crochet (dc)", uk: "treble (tr)" },
  { us: "treble (tr)", uk: "double treble (dtr)" },
];
