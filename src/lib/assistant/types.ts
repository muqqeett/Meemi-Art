/**
 * Shapes shared by the crochet assistant's server route and its client UI.
 *
 * Nothing here is secret and nothing here queries anything: this module is
 * imported by client components. Server-only logic lives beside it in
 * `catalog.ts`, `throttle.ts` and `run.ts`.
 */

/**
 * A product as the assistant may show it.
 *
 * Every field is public catalogue data read from the database at request
 * time — never from the model and never from the browser. Deliberately absent:
 * storage keys, file names, SKUs, Paddle ids and anything about orders.
 */
export type AssistantProduct = {
  id: string;
  slug: string;
  name: string;
  categoryName: string;
  priceCents: number;
  compareAtCents: number | null;
  imageUrl: string | null;
  imageAlt: string;
  /** Only when the product has real published reviews; otherwise null. */
  ratingAvg: number | null;
  reviewCount: number;
};

export type AssistantRecommendation = {
  product: AssistantProduct;
  /** The model's one-line reason, length-capped by the server. */
  reason: string;
};

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantReply =
  | {
      ok: true;
      message: string;
      recommendations: AssistantRecommendation[];
      followUpQuestion: string | null;
      quickReplies: string[];
    }
  | {
      ok: false;
      /** Customer-safe wording only — never a provider or stack message. */
      error: string;
      fallbackHref: string;
      retryAfterSeconds?: number;
    };

/**
 * Hard limits, enforced on the server and mirrored in the UI so the input
 * cannot hold more than the route will accept.
 */
export const ASSISTANT_LIMITS = {
  /** One customer message. */
  maxMessageChars: 500,
  /** An earlier assistant turn echoed back as history. */
  maxAssistantChars: 1200,
  /** Turns of history sent per request — the short context window. */
  maxTurns: 12,
  /** Product cards in one reply. */
  maxRecommendations: 4,
} as const;
