"use client";

import { create } from "zustand";

import {
  ASSISTANT_LIMITS,
  type AssistantChip,
  type AssistantComparison,
  type AssistantLink,
  type AssistantMood,
  type AssistantRecommendation,
  type AssistantReply,
  type ChatTurn,
} from "@/lib/assistant/types";

/**
 * Ask Meemi's conversation.
 *
 * Held in a store, not in the panel, so it survives everything that is not a
 * full page load: closing the panel, switching width, and — because the
 * launcher lives in the storefront layout, which Next keeps mounted — moving
 * from page to page. It is deliberately never written to storage: a reload
 * starts a fresh conversation, and nothing a customer typed outlives the tab.
 */

/** The browser gives up on a turn after this long and shows Meemi napping. */
export const REQUEST_TIMEOUT_MS = 12_000;

export const NAP_MESSAGE = "Oops, I dozed off and couldn't reach the shop. Try again in a moment.";

export const GREETING =
  "Hi, I'm Meemi! I find crochet patterns in our shop. Tell me what you want to make, your skill level or your budget.";

export const STARTER_CHIPS = [
  "Find a beginner pattern",
  "Flower patterns",
  "Something under $5",
  "Gift ideas",
  "Help me choose",
] as const;

/**
 * "Help me choose": the one question Figma defines, asked here with no model
 * involved, then one real search built from the answer. The answer is a phrase
 * the assistant's own parser already understands.
 */
export const GUIDE_QUESTION = {
  question: "What would you like to make?",
  options: [
    { label: "Toy or animal", phrase: "toy" },
    { label: "Something to wear", phrase: "wearable" },
    { label: "For my pet", phrase: "pet" },
    { label: "Flowers", phrase: "flower" },
  ],
} as const;

export type AskItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** What the model is told when the bubble shows a shorter choice, e.g. a Help me choose answer. */
  query?: string;
  /** The face Meemi had when this was written; answers keep it. */
  mood?: AssistantMood;
  recommendations?: AssistantRecommendation[];
  comparison?: AssistantComparison | null;
  followUpQuestion?: string | null;
  chips?: AssistantChip[];
  links?: AssistantLink[];
  /** Local messages (greeting, the guided question) are never sent as history. */
  local?: boolean;
  /** The turn failed or timed out; "Try again" re-asks the same question. */
  napping?: { retry: boolean };
};

type AskMeemiState = {
  open: boolean;
  wide: boolean;
  items: AskItem[];
  pending: boolean;
  /** True while the Help me choose question is waiting for an answer. */
  guide: boolean;
  /** The product page being viewed, so "something similar" can be answered. */
  productSlug: string | null;

  setProductSlug: (slug: string | null) => void;
  openPanel: (options?: { ask?: string }) => void;
  closePanel: () => void;
  toggleWide: () => void;
  reset: () => void;
  /** Send a customer turn; `shown` is what their bubble says when that differs from `text`. */
  send: (text: string, shown?: string) => Promise<void>;
  retry: () => Promise<void>;
  choose: (chip: AssistantChip) => Promise<void>;
};

let counter = 0;
const nextId = () => `a${++counter}`;

let controller: AbortController | null = null;

function greeting(productSlug: string | null): AskItem {
  return {
    id: nextId(),
    role: "assistant",
    text: GREETING,
    mood: "hello",
    local: true,
    chips: [
      ...(productSlug ? [{ label: "Something similar to this", query: "Show me something similar to this" }] : []),
      ...STARTER_CHIPS.map((label) => ({ label, query: label })),
    ],
  };
}

/** What the model is shown: real turns only, newest last, capped. */
export function buildHistory(items: AskItem[]): ChatTurn[] {
  return items
    .filter((item) => !item.local && !item.napping)
    .map((item) => ({
      role: item.role,
      content: [item.query ?? item.text, item.followUpQuestion].filter(Boolean).join(" "),
    }))
    .slice(-ASSISTANT_LIMITS.maxTurns);
}

/** The phrase the Help me choose answer turns into: "Show me flower patterns". */
export function guideQuery(phrase: string): string {
  return `Show me ${phrase} patterns`;
}

export const useAskMeemi = create<AskMeemiState>((set, get) => {
  async function perform() {
    set({ pending: true });
    controller?.abort();
    const mine = new AbortController();
    controller = mine;

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      mine.abort();
    }, REQUEST_TIMEOUT_MS);

    const { items, productSlug } = get();
    const napping = (text: string, retry: boolean, links?: AssistantLink[]): AskItem => ({
      id: nextId(),
      role: "assistant",
      text,
      mood: "napping",
      links,
      chips: retry ? [{ label: "Try again", query: "" }] : [],
      napping: { retry },
    });

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: buildHistory(items), productSlug }),
        signal: mine.signal,
      });
      const data = (await response.json().catch(() => null)) as AssistantReply | null;

      if (data?.ok) {
        set((s) => ({
          items: [
            ...s.items,
            {
              id: nextId(),
              role: "assistant",
              text: data.message,
              mood: data.mood,
              recommendations: data.recommendations,
              comparison: data.comparison,
              followUpQuestion: data.followUpQuestion,
              chips: data.chips,
              links: data.links,
            },
          ],
        }));
      } else {
        // A rate limit is the customer's to wait out; anything else is "I dozed
        // off" — and either way there is a way onward, never a dead end.
        const limited = response.status === 429;
        set((s) => ({
          items: [
            ...s.items,
            napping(limited && data && !data.ok ? data.error : NAP_MESSAGE, !limited, [
              { label: "Browse all patterns", href: data && !data.ok ? data.fallbackHref : "/shop" },
            ]),
          ],
        }));
      }
    } catch (error) {
      if ((error as Error).name === "AbortError" && !timedOut) return; // started over: nothing to show
      set((s) => ({
        items: [...s.items, napping(NAP_MESSAGE, true, [{ label: "Browse all patterns", href: "/shop" }])],
      }));
    } finally {
      clearTimeout(timer);
      if (controller === mine) set({ pending: false });
    }
  }

  return {
    open: false,
    wide: false,
    items: [],
    pending: false,
    guide: false,
    productSlug: null,

    setProductSlug: (productSlug) => set({ productSlug }),

    openPanel: (options) => {
      set((s) => ({ open: true, items: s.items.length > 0 ? s.items : [greeting(s.productSlug)] }));
      if (options?.ask) void get().send(options.ask);
    },

    closePanel: () => set({ open: false }),

    toggleWide: () => set((s) => ({ wide: !s.wide })),

    reset: () => {
      controller?.abort();
      controller = null;
      set((s) => ({ items: [greeting(s.productSlug)], pending: false, guide: false }));
    },

    send: async (text, shown) => {
      const content = text.trim().slice(0, ASSISTANT_LIMITS.maxMessageChars);
      if (!content || get().pending) return;
      set((s) => ({
        guide: false,
        items: [
          ...(s.items.length > 0 ? s.items : [greeting(s.productSlug)]),
          { id: nextId(), role: "user", text: shown ?? content, query: shown ? content : undefined },
        ],
      }));
      await perform();
    },

    retry: async () => {
      if (get().pending) return;
      // Drop the failed answer; the question before it is still in the history.
      set((s) => ({ items: s.items.filter((item) => !item.napping) }));
      await perform();
    },

    choose: async (chip) => {
      const { guide, pending } = get();
      if (pending) return;

      if (chip.label === "Try again") return get().retry();

      // Start Help me choose.
      if (!guide && chip.label === "Help me choose") {
        set((s) => ({
          guide: true,
          items: [
            ...s.items,
            { id: nextId(), role: "user", text: chip.label, local: true },
            { id: nextId(), role: "assistant", text: GUIDE_QUESTION.question, mood: "curious", local: true },
          ],
        }));
        return;
      }

      // Answer the Help me choose question, then search like any other turn.
      if (guide) {
        const option = GUIDE_QUESTION.options.find((o) => o.label === chip.label);
        if (!option) return void get().send(chip.query);
        return void get().send(guideQuery(option.phrase), option.label);
      }

      await get().send(chip.query || chip.label);
    },
  };
});

/** The chips on offer right now: the guided question's options, or the last answer's. */
export function activeChips(state: Pick<AskMeemiState, "guide" | "items" | "pending">): AssistantChip[] {
  if (state.pending) return [];
  if (state.guide) return GUIDE_QUESTION.options.map((o) => ({ label: o.label, query: o.label }));
  const last = state.items.at(-1);
  return last?.role === "assistant" ? (last.chips ?? []) : [];
}

/** The face for the header: waiting, thinking up a question, or however the last answer felt. */
export function currentMood(state: Pick<AskMeemiState, "guide" | "items" | "pending">): AssistantMood {
  if (state.pending) return "looking";
  if (state.guide) return "curious";
  const last = state.items.findLast((item) => item.role === "assistant");
  return last?.mood ?? "hello";
}
