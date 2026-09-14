import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * The Anthropic client, and the one switch that says whether AI is available.
 *
 * Server-only: the key is read from `ANTHROPIC_API_KEY` by the SDK itself and
 * never passes through application code, never reaches a Client Component, and
 * is never logged. Nothing else in the codebase constructs a client — every
 * model call goes through `lib/ai/assistant-llm.ts`.
 */

/** Models, in one place. Intent extraction is the cheap, fast step. */
export const AI_MODELS = {
  intent: "claude-haiku-4-5",
  reply: "claude-opus-5",
} as const;

/**
 * Whether the storefront should offer the assistant at all.
 *
 * Checked on the server when the layout renders and again on every request, so
 * a deployment without a key shows no launcher and the route refuses cleanly.
 */
export function isAssistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

/**
 * Lazily constructed so importing this module never throws on a deployment
 * without a key.
 *
 * The timeout and retry budget are sized for a customer waiting in a chat
 * panel: one retry on transient failures, and a bounded wait rather than the
 * SDK's ten-minute default.
 */
export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
  }
  return client;
}
