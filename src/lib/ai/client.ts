import "server-only";

import { GoogleGenAI } from "@google/genai";

/**
 * The Gemini client, and the one switch that says whether AI is available.
 *
 * Server-only: `GEMINI_API_KEY` is read here and handed to the SDK, and never
 * passes to a Client Component, a response or a log. Nothing else in the
 * codebase constructs a client — every model call goes through
 * `lib/ai/assistant-llm.ts`.
 */

/**
 * Models, in one place. Intent extraction is the lighter step.
 *
 * Gemini 3.5 generation: the 2.5 models are still listed for this key but
 * return 404 on generation, so they are not used.
 */
export const AI_MODELS = {
  intent: "gemini-3.5-flash-lite",
  reply: "gemini-3.5-flash-lite",
} as const;

/**
 * Whether the storefront should offer the assistant at all.
 *
 * Checked on the server when the layout renders and again on every request, so
 * a deployment without a key shows no launcher and the route refuses cleanly.
 */
export function isAssistantConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

let client: GoogleGenAI | null = null;

/**
 * Lazily constructed so importing this module never throws on a deployment
 * without a key.
 *
 * One attempt per call, no automatic retries: on a free tier a retry spends
 * quota twice, and a failed turn already degrades to the friendly message. The
 * timeout bounds how long a customer waits in the chat panel.
 */
export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout: 30_000, retryOptions: { attempts: 1 } },
    });
  }
  return client;
}
