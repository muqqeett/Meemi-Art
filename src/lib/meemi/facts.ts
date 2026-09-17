import {
  evaluatePublicDifficulty,
  type DifficultyLevel,
  type StoredDifficulty,
} from "@/lib/difficulty/engine";

/**
 * The facts Meemi — the product page's crochet guide — is allowed to state.
 *
 * Derived on the server from the product record, never from the browser and
 * never from a model. Difficulty, time, techniques and challenges come only
 * from an enabled `ProductDifficulty` row through the Difficulty engine; a
 * product without one simply has none of them, and Meemi says nothing about
 * them. "Digital" means the product has a purchasable file behind it.
 *
 * Plain, serialisable data: it is passed as props to a client component.
 */
export type MeemiFacts = {
  productId: string;
  productName: string;
  difficulty: {
    level: DifficultyLevel;
    levelLabel: string;
    /** "5.4" — out of 10. */
    score: string;
    /** Fixed engine phrases, hardest first. May be empty. */
    challenges: string[];
  } | null;
  /** "About 2–3 hours", only with an enabled assessment. */
  estimatedTime: string | null;
  /** Labels from the technique vocabulary, in vocabulary order. May be empty. */
  techniques: string[];
  /** True only when a downloadable file is attached to the product. */
  isDigital: boolean;
};

export function meemiFactsFor(product: {
  id: string;
  name: string;
  difficulty?: StoredDifficulty | null;
  asset: object | null;
}): MeemiFacts {
  const result = evaluatePublicDifficulty(product.difficulty);
  return {
    productId: product.id,
    productName: product.name,
    difficulty: result
      ? { level: result.level, levelLabel: result.levelLabel, score: result.score, challenges: result.challenges }
      : null,
    estimatedTime: result?.estimatedTime ?? null,
    techniques: result?.techniques.map((technique) => technique.label) ?? [],
    isDigital: product.asset !== null,
  };
}
