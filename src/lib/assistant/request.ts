import { z } from "zod";

import { ASSISTANT_LIMITS, type ChatTurn } from "@/lib/assistant/types";

/**
 * The only shape `POST /api/assistant` accepts.
 *
 * The browser sends conversation text and, on a product page, that product's
 * slug. Nothing else: no filters, no product ids, no prices. Assistant turns in
 * the history are treated as untrusted too — they are text the client claims
 * the assistant said, used only as conversational context, never as a source
 * of product facts.
 */
const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const RequestSchema = z.object({
  messages: z.array(TurnSchema).min(1).max(ASSISTANT_LIMITS.maxTurns * 2),
  productSlug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(160)
    .nullable()
    .optional(),
});

export type AssistantRequest = {
  history: ChatTurn[];
  productSlug: string | null;
};

/**
 * Validate and normalise a request body.
 *
 * Returns null for anything unusable. The history is trimmed to the last
 * `maxTurns` turns, begins with a customer message, and ends with the new
 * customer message, which must be non-empty and within the length limit. Older
 * turns that exceed their limit are cut rather than rejected, so a long
 * earlier answer does not break the conversation.
 */
export function parseAssistantRequest(body: unknown): AssistantRequest | null {
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return null;

  const turns = parsed.data.messages
    .map((turn) => ({
      role: turn.role,
      content: turn.content
        .trim()
        .slice(
          0,
          turn.role === "user" ? ASSISTANT_LIMITS.maxMessageChars : ASSISTANT_LIMITS.maxAssistantChars,
        ),
    }))
    .filter((turn) => turn.content.length > 0);

  const last = parsed.data.messages.at(-1);
  if (!last || last.role !== "user") return null;
  const lastText = last.content.trim();
  if (!lastText || lastText.length > ASSISTANT_LIMITS.maxMessageChars) return null;

  let history = turns.slice(-ASSISTANT_LIMITS.maxTurns);
  // The model conversation must open with the customer.
  while (history.length > 0 && history[0].role !== "user") history = history.slice(1);
  if (history.length === 0 || history.at(-1)?.role !== "user") return null;

  return { history, productSlug: parsed.data.productSlug ?? null };
}
