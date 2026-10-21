import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DIFFICULTY_LEVELS,
  difficultyLevelFor,
  difficultyScoreTenths,
  type DifficultyLevel,
} from "@/lib/difficulty/engine";

export type SkillFacet = {
  /** Lower-case level, as it appears in the URL: `?skill=beginner,easy`. */
  value: string;
  label: string;
  count: number;
};

export type SkillIndex = {
  /** Levels at least one listed product has, easiest first. */
  facets: SkillFacet[];
  /** Product ids per level (lower-case), for the `skill` filter. */
  idsByLevel: Record<string, string[]>;
};

/** The values the `skill` parameter accepts. */
export const SKILL_VALUES: readonly string[] = DIFFICULTY_LEVELS.map(({ level }) =>
  level.toLowerCase(),
);

/**
 * Skill levels across the listed products in the given categories.
 *
 * The level is never stored — it is derived from the six stored ratings by the
 * difficulty engine, the same function the product page uses — so it is worked
 * out here, in code, rather than in SQL. A category's catalogue is small enough
 * for that, and it keeps one definition of "Beginner". Products with no
 * (enabled) rating are simply not part of this facet.
 */
export async function getSkillIndex(categorySlugs: string[]): Promise<SkillIndex> {
  const rows = await prisma.productDifficulty.findMany({
    where: {
      enabled: true,
      product: {
        isActive: true,
        asset: { isNot: null },
        category: { slug: { in: categorySlugs } },
      },
    },
    select: {
      productId: true,
      stitches: true,
      construction: true,
      shaping: true,
      colorwork: true,
      assembly: true,
      patternReading: true,
    },
  });

  const idsByLevel: Record<string, string[]> = {};
  for (const row of rows) {
    let level: DifficultyLevel;
    try {
      level = difficultyLevelFor(difficultyScoreTenths(row)).level;
    } catch {
      continue; // Out-of-range stored ratings: leave the product out of the facet.
    }
    (idsByLevel[level.toLowerCase()] ??= []).push(row.productId);
  }

  const facets = DIFFICULTY_LEVELS.flatMap(({ level, label }: { level: DifficultyLevel; label: string }) => {
    const value = level.toLowerCase();
    const count = idsByLevel[value]?.length ?? 0;
    return count > 0 ? [{ value, label, count }] : [];
  });

  return { facets, idsByLevel };
}

/**
 * The `skill` URL parameter — a comma-separated list — reduced to known
 * levels, in the engine's order and without repeats. Anything else is dropped.
 */
export function parseSkill(raw: string | string[] | undefined): string[] {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (!text) return [];
  const wanted = new Set(text.toLowerCase().split(",").map((part) => part.trim()));
  return SKILL_VALUES.filter((value) => wanted.has(value));
}
