"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { AssistantComparison } from "@/components/assistant/assistant-comparison";
import { AssistantProductCard } from "@/components/assistant/assistant-product-card";
import {
  ASSISTANT_LIMITS,
  type AssistantComparison as Comparison,
  type AssistantRecommendation,
  type AssistantReply,
  type ChatTurn,
} from "@/lib/assistant/types";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  role: "user" | "assistant";
  text: string;
  recommendations?: AssistantRecommendation[];
  comparison?: Comparison | null;
  followUpQuestion?: string | null;
  quickReplies?: string[];
  error?: { href: string };
  /** Local guided-flow messages are UI only and never sent as history. */
  local?: boolean;
};

const STARTERS = [
  "Find a beginner pattern",
  "Show me flower patterns",
  "Something under $5",
  "Good gift ideas",
  "Show me cute patterns",
];

/** "Help me choose" asks two short questions locally, then searches for real. */
const PURPOSES = ["Just for fun", "A gift", "Home decor", "Something seasonal"];
const BUDGETS = ["Under $5", "Under $10", "Any budget"];

let counter = 0;
const nextId = () => `m${++counter}`;

/**
 * The pattern guide panel.
 *
 * Built on the shop's `Sheet` (Base UI dialog): focus is trapped inside while
 * open, Escape and the close button dismiss it, focus returns to the launcher,
 * and it is announced as a dialog with a title and description. The message
 * list is a polite live region, so replies are read out as they arrive without
 * interrupting.
 *
 * The conversation lives in component state only — nothing is stored, and
 * closing the tab ends it.
 */
export function AssistantPanel({
  open,
  onOpenChange,
  productSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productSlug: string | null;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [guided, setGuided] = useState<{ step: "purpose" | "budget"; purpose?: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTo({ top: log.scrollHeight });
  }, [items, pending]);

  // A request still in flight when the panel closes is abandoned.
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  function append(item: Omit<Item, "id">) {
    setItems((current) => [...current, { ...item, id: nextId() }]);
  }

  async function send(text: string) {
    const content = text.trim().slice(0, ASSISTANT_LIMITS.maxMessageChars);
    if (!content || pending) return;

    setGuided(null);
    setDraft("");

    const history: ChatTurn[] = [
      ...items
        .filter((item) => !item.local && !item.error)
        .map((item) => ({
          role: item.role,
          content: [item.text, item.followUpQuestion].filter(Boolean).join(" "),
        })),
      { role: "user" as const, content },
    ].slice(-ASSISTANT_LIMITS.maxTurns);

    append({ role: "user", text: content });
    setPending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, productSlug }),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => null)) as AssistantReply | null;

      if (data?.ok) {
        append({
          role: "assistant",
          text: data.message,
          recommendations: data.recommendations,
          comparison: data.comparison,
          followUpQuestion: data.followUpQuestion,
          quickReplies: data.quickReplies,
        });
      } else {
        append({
          role: "assistant",
          text:
            data?.error ??
            "Sorry, I'm having trouble finding recommendations right now. Try browsing our patterns instead.",
          error: { href: data?.fallbackHref ?? "/shop" },
        });
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      append({
        role: "assistant",
        text: "Sorry, I'm having trouble finding recommendations right now. Try browsing our patterns instead.",
        error: { href: "/shop" },
      });
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function chooseChip(label: string) {
    if (label === "Help me choose") {
      append({ role: "user", text: label, local: true });
      append({ role: "assistant", text: "Happy to help. What are you making this for?", local: true });
      setGuided({ step: "purpose" });
      return;
    }
    if (guided?.step === "purpose") {
      append({ role: "user", text: label, local: true });
      append({ role: "assistant", text: "Lovely. Do you have a budget in mind?", local: true });
      setGuided({ step: "budget", purpose: label });
      return;
    }
    if (guided?.step === "budget") {
      const budget = label === "Any budget" ? "" : ` ${label.toLowerCase()}`;
      void send(`Help me choose a pattern for ${guided.purpose?.toLowerCase()}${budget}`);
      return;
    }
    void send(label);
  }

  const lastItem = items.at(-1);
  const chips = guided
    ? guided.step === "purpose"
      ? PURPOSES
      : BUDGETS
    : !pending && lastItem?.role === "assistant" && lastItem.quickReplies?.length
      ? lastItem.quickReplies
      : [];

  const starters = [
    ...(productSlug ? ["Show me something similar to this"] : []),
    ...STARTERS,
    "Help me choose",
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={inputRef}
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[26rem]"
      >
        <header className="flex items-start gap-3 border-b border-border px-5 py-4 pr-12">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <SheetTitle className="text-base font-semibold">Pattern guide</SheetTitle>
            <SheetDescription className="text-xs">
              Find the right Meemi Art crochet pattern.
            </SheetDescription>
          </div>
        </header>

        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation"
          className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5"
        >
          {items.length === 0 && (
            <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
              <p className="text-sm leading-relaxed text-foreground">
                Hi! I&apos;m here to help you find the right crochet pattern.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                What would you like to make? Pick a suggestion, or ask me anything about our patterns.
              </p>
              <ChipRow chips={starters} onChoose={chooseChip} className="mt-4" />
            </div>
          )}

          {items.map((item) =>
            item.role === "user" ? (
              <div key={item.id} className="flex justify-end motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
                <p className="max-w-[85%] rounded-sm bg-brand-700 px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap text-white">
                  <span className="sr-only">You said: </span>
                  {item.text}
                </p>
              </div>
            ) : (
              <div
                key={item.id}
                className="space-y-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  <span className="sr-only">Assistant: </span>
                  {item.text}
                </p>

                {item.error && (
                  <Link
                    href={item.error.href}
                    onClick={() => onOpenChange(false)}
                    className="label-caps inline-flex items-center text-brand-700 underline-offset-4 hover:underline"
                  >
                    Browse all patterns
                  </Link>
                )}

                {item.comparison && <AssistantComparison comparison={item.comparison} />}

                {item.recommendations && item.recommendations.length > 0 && (
                  <ul className="space-y-2" aria-label="Recommended patterns">
                    {item.recommendations.map((recommendation) => (
                      <li key={recommendation.product.slug}>
                        <AssistantProductCard
                          recommendation={recommendation}
                          onNavigate={() => onOpenChange(false)}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {item.followUpQuestion && (
                  <p className="text-sm leading-relaxed text-foreground">{item.followUpQuestion}</p>
                )}
              </div>
            ),
          )}

          {pending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              Finding patterns for you…
            </p>
          )}
        </div>

        <div className="border-t border-border px-4 pt-3 pb-4">
          {chips.length > 0 && <ChipRow chips={chips} onChoose={chooseChip} className="mb-3" />}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
            className="flex items-end gap-2 rounded-sm border border-border bg-surface px-3 py-2 focus-within:border-brand-700/50"
          >
            <label htmlFor="assistant-input" className="sr-only">
              Ask about crochet patterns
            </label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
              rows={1}
              maxLength={ASSISTANT_LIMITS.maxMessageChars}
              placeholder="Ask me anything…"
              className="max-h-28 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-base leading-snug outline-none placeholder:text-muted-foreground sm:text-sm [field-sizing:content]"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              aria-label="Send message"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition-colors hover:bg-royal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 disabled:pointer-events-none disabled:opacity-40"
            >
              {pending ? (
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="size-4" aria-hidden />
              )}
            </button>
          </form>
          <p className="mt-2 text-center text-[0.6875rem] text-muted-foreground">
            Recommendations come from Meemi Art&apos;s current catalogue.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ChipRow({
  chips,
  onChoose,
  className,
}: {
  chips: string[];
  onChoose: (label: string) => void;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Suggestions">
      {chips.map((chip) => (
        <li key={chip}>
          <button
            type="button"
            onClick={() => onChoose(chip)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:border-brand-700/40 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
          >
            {chip}
          </button>
        </li>
      ))}
    </ul>
  );
}
