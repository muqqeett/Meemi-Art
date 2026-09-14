import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { normalizeTechniques } from "@/lib/difficulty/techniques";
import type { ProductDifficultyInput } from "@/lib/validations/admin";

/**
 * Reading and writing `ProductDifficulty` rows.
 *
 * Only the inputs are ever written. `difficultyRecordData` picks each column by
 * name rather than spreading the payload, so even a value that slipped past
 * validation — a "score", a "level" — has no path into the database.
 */

/** The columns the product page and admin form need. */
export const productDifficultySelect = {
  enabled: true,
  stitches: true,
  construction: true,
  shaping: true,
  colorwork: true,
  assembly: true,
  patternReading: true,
  minutesMin: true,
  minutesMax: true,
  techniques: true,
} as const satisfies Prisma.ProductDifficultySelect;

export type ProductDifficultyRow = Prisma.ProductDifficultyGetPayload<{ select: typeof productDifficultySelect }>;

export function difficultyRecordData(input: ProductDifficultyInput) {
  return {
    enabled: input.enabled,
    stitches: input.stitches,
    construction: input.construction,
    shaping: input.shaping,
    colorwork: input.colorwork,
    assembly: input.assembly,
    patternReading: input.patternReading,
    minutesMin: input.minutesMin,
    minutesMax: input.minutesMax,
    techniques: normalizeTechniques(input.techniques),
  };
}

/**
 * Create or replace a product's difficulty inputs.
 *
 * There is deliberately no delete here. Hiding a rating is `enabled: false`;
 * the ratings stay, so switching it back on restores them. The row goes only
 * when its product is deleted (cascade).
 */
export async function saveProductDifficulty(
  db: Pick<Prisma.TransactionClient, "productDifficulty">,
  productId: string,
  input: ProductDifficultyInput,
): Promise<{ id: string }> {
  const data = difficultyRecordData(input);
  return db.productDifficulty.upsert({
    where: { productId },
    create: { productId, ...data },
    update: data,
    select: { id: true },
  });
}

/**
 * The nested create for a duplicated product: a new row of its own, with the
 * source's inputs copied value by value. Undefined when the source has none.
 */
export function duplicateDifficultyCreate(source: ProductDifficultyRow | null | undefined) {
  if (!source) return undefined;
  return {
    create: {
      enabled: source.enabled,
      stitches: source.stitches,
      construction: source.construction,
      shaping: source.shaping,
      colorwork: source.colorwork,
      assembly: source.assembly,
      patternReading: source.patternReading,
      minutesMin: source.minutesMin,
      minutesMax: source.minutesMax,
      techniques: [...source.techniques],
    },
  };
}
