/**
 * Yarn weights, in the Craft Yarn Council's numbered system.
 *
 * "Weight" here means thickness, not how much the ball weighs — the most
 * common confusion a beginner meets on a yarn label. The numbers 0 to 7 are
 * the only part of the system that is standard; the names beside them are
 * regional, which is why each entry lists the names you will actually see.
 *
 * Hook ranges are the Council's recommendations for crochet specifically,
 * checked against their published Standard Yarn Weight System, and they are
 * starting points rather than rules: the pattern's gauge decides the hook, and
 * two people using the same hook and yarn can still get different fabric.
 *
 * Two categories do not fit a simple numeric range, and `hookLabel` exists so
 * that the page can quote the Council rather than round them into something
 * tidier than the standard actually says: category 0 names steel hooks and a
 * regular hook separately, and category 7 is open-ended ("15 mm and larger").
 */

export type YarnWeight = {
  /** CYC number, 0–7. The standard part. */
  number: number;
  /** The Council's name for the category. */
  name: string;
  /** What the same thickness is called on labels and in patterns. */
  alsoCalled: string[];
  /** Recommended crochet hook range, in millimetres, for sorting and lookups. */
  hookMm: [number, number];
  /** The Council's own wording, where a plain range would misstate it. */
  hookLabel?: string;
  /** What it is commonly used for. */
  typicalProjects: string;
  /** The practical note that a table alone would leave out. */
  note: string;
};

export const YARN_WEIGHTS: YarnWeight[] = [
  {
    number: 0,
    name: "Lace",
    alsoCalled: ["Fingering (10-count crochet thread)", "Cobweb", "Thread"],
    hookMm: [1.4, 2.25],
    hookLabel: "Steel 1.6–1.4 mm, or a regular 2.25 mm hook",
    typicalProjects: "Doilies, fine shawls, thread lace.",
    note: "The only category the Council splits in two: steel hooks of 1.6–1.4 mm, or an ordinary 2.25 mm hook. Steel numbering runs the opposite way to ordinary hooks — a higher steel number is a finer hook.",
  },
  {
    number: 1,
    name: "Super Fine",
    alsoCalled: ["Sock", "Fingering", "Baby"],
    hookMm: [2.25, 3.5],
    typicalProjects: "Socks, lightweight shawls, fine baby garments.",
    note: "Slow to work up, but it gives the most detail — small amigurumi faces read much more clearly at this thickness.",
  },
  {
    number: 2,
    name: "Fine",
    alsoCalled: ["Sport", "Baby"],
    hookMm: [3.5, 4.5],
    typicalProjects: "Baby clothes, light garments, small toys.",
    note: "A good middle ground when worsted feels bulky and fingering feels endless.",
  },
  {
    number: 3,
    name: "Light",
    alsoCalled: ["DK", "Light worsted"],
    hookMm: [4.5, 5.5],
    typicalProjects: "Garments, blankets, amigurumi with clean stitch definition.",
    note: "DK is the default for much of Europe and a very common amigurumi choice, usually with a hook a size or two smaller than the label suggests.",
  },
  {
    number: 4,
    name: "Medium",
    alsoCalled: ["Worsted", "Afghan", "Aran"],
    hookMm: [5.5, 6.5],
    typicalProjects: "Blankets, hats, bags, most beginner patterns.",
    note: "The most widely available weight, and the easiest to see your stitches in while you are learning.",
  },
  {
    number: 5,
    name: "Bulky",
    alsoCalled: ["Chunky", "Craft", "Rug"],
    hookMm: [6.5, 9.0],
    typicalProjects: "Quick blankets, baskets, winter accessories.",
    note: "Works up fast, which is satisfying — but it hides fine shaping, so it flatters simple stitch patterns most.",
  },
  {
    number: 6,
    name: "Super Bulky",
    alsoCalled: ["Super bulky", "Super chunky", "Roving"],
    hookMm: [9.0, 15.0],
    typicalProjects: "Throws, floor cushions, oversized scarves.",
    note: "Heavy enough that a large piece can sag under its own weight; worth accounting for in anything that hangs.",
  },
  {
    number: 7,
    name: "Jumbo",
    alsoCalled: ["Jumbo", "Roving"],
    hookMm: [15.0, 19.0],
    hookLabel: "15 mm and larger",
    typicalProjects: "Rugs, baskets, statement blankets.",
    note: "The Council sets no upper limit here — the recommendation is simply 15 mm and larger. Often worked with hands or arm-sized hooks. Stitch counts are small, so a miscount changes the shape dramatically.",
  },
];

export function yarnWeightByNumber(value: number): YarnWeight | undefined {
  return YARN_WEIGHTS.find((weight) => weight.number === value);
}

/** "4.5–5.5 mm", or the Council's own wording where a range would misstate it. */
export function hookRangeLabel(weight: YarnWeight): string {
  return weight.hookLabel ?? `${weight.hookMm[0]}–${weight.hookMm[1]} mm`;
}

/**
 * How much yarn a substitution really changes.
 *
 * Yardage, not grams, is what tells you whether a ball will finish a project:
 * two 100 g balls of the same fibre can hold very different lengths.
 */
export const SUBSTITUTION_CHECKS: string[] = [
  "Match the weight number first — a 4 for a 4 — then check the yardage per ball rather than the gram weight.",
  "Crochet a gauge swatch in the stitch the pattern uses; a substitute that matches on the label can still work up at a different size.",
  "Consider fibre, not just thickness: cotton has little give and shows stitch definition, wool blocks and stretches, acrylic keeps its shape and is easy to wash.",
  "For toys, prefer a yarn that holds a tight fabric, so stuffing cannot show through the stitches.",
];
