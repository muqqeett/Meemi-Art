"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowUp, Maximize2, Minimize2, RotateCcw, X } from "lucide-react";

import { AskMeemiAvatar } from "@/components/ask-meemi/ask-meemi-avatar";
import { AskMeemiComparison } from "@/components/ask-meemi/ask-meemi-comparison";
import { ChatProductCard } from "@/components/ask-meemi/chat-product-card";
import { ASSISTANT_LIMITS, type AssistantChip, type AssistantMood } from "@/lib/assistant/types";
import { activeChips, currentMood, useAskMeemi, type AskItem } from "@/lib/stores/ask-meemi";
import { cn } from "@/lib/utils";

const PHONE_QUERY = "(max-width: 639px)";

/** True below `sm`, where the panel is a full-screen sheet instead of a side panel. */
function useIsPhone(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(PHONE_QUERY);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

const ICON_BUTTON =
  "pl-focus inline-flex size-11 shrink-0 items-center justify-center rounded-full text-pl-text transition-colors hover:bg-plum-100";

function Chips({ chips, onChoose, className }: { chips: AssistantChip[]; onChoose: (chip: AssistantChip) => void; className?: string }) {
  if (chips.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Suggestions">
      {chips.map((chip) => (
        <li key={chip.label}>
          <button
            type="button"
            onClick={() => onChoose(chip)}
            className="pl-focus inline-flex min-h-9 items-center rounded-full border-[1.5px] border-pl-line bg-pl-surface px-3 text-[14px] leading-[18px] font-bold text-pl-text transition-colors hover:bg-plum-100"
          >
            {chip.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Meemi's answer: her face, then the words, the cards and any links. */
function AnswerRow({
  item,
  wide,
  onNavigate,
  onAdded,
}: {
  item: AskItem;
  wide: boolean;
  onNavigate: () => void;
  onAdded: () => void;
}) {
  const mood: AssistantMood = item.mood ?? "hello";
  const note = mood === "unsure" && (item.recommendations?.length ?? 0) > 0;

  return (
    <div className="flex gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
      <AskMeemiAvatar mood={mood} size={28} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p
          className={cn(
            "text-[15px] leading-[23px] whitespace-pre-wrap text-pl-text",
            note && "rounded-[14px] bg-pl-tint-templates px-3 py-2 text-[13px] leading-[18px]",
          )}
        >
          <span className="sr-only">Meemi: </span>
          {item.text}
        </p>

        {item.comparison && <AskMeemiComparison comparison={item.comparison} />}

        {item.recommendations && item.recommendations.length > 0 && (
          <ul
            aria-label="Recommended patterns"
            className={cn(
              "flex gap-2.5",
              wide ? "flex-wrap" : "-mr-4 snap-x snap-mandatory overflow-x-auto pr-4 pb-1 [scrollbar-width:thin]",
            )}
          >
            {item.recommendations.map((rec) => (
              <li key={rec.product.slug} className="snap-start">
                <ChatProductCard product={rec.product} onNavigate={onNavigate} onAdded={onAdded} />
              </li>
            ))}
          </ul>
        )}

        {item.followUpQuestion && (
          <p className="text-[15px] leading-[23px] text-pl-text">{item.followUpQuestion}</p>
        )}

        {item.links && item.links.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Helpful links">
            {item.links.map((link) => (
              <li key={link.href + link.label}>
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  className="pl-focus rounded-sm text-sm leading-[22px] font-bold text-plum-500 underline underline-offset-2"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Ask Meemi — Figma "Ask Meemi (AI pattern finder)" (188:6767, mobile 189:3199).
 *
 * A 420px panel down the right edge (680px when widened); on a phone, a
 * full-screen sheet. On a desktop it is not modal: the page behind stays
 * usable and the chat stays open as you move from page to page. On a phone it
 * is modal, with focus held inside until it is closed.
 *
 * The header avatar shows Meemi's mood for the current moment and pops when it
 * changes (350ms, skipped under reduced motion); each answer keeps the face it
 * was written with.
 */
export function AskMeemiPanel({ finalFocusRef }: { finalFocusRef: RefObject<HTMLElement | null> }) {
  const open = useAskMeemi((s) => s.open);
  const wide = useAskMeemi((s) => s.wide);
  const items = useAskMeemi((s) => s.items);
  const pending = useAskMeemi((s) => s.pending);
  const guide = useAskMeemi((s) => s.guide);
  const { closePanel, toggleWide, reset, send, choose } = useAskMeemi.getState();

  const isPhone = useIsPhone();
  const [draft, setDraft] = useState("");
  const [happyFlash, setHappyFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const mood: AssistantMood = happyFlash ? "happy" : currentMood({ guide, items, pending });
  const chips = activeChips({ guide, items, pending });
  const lastIsAssistant = items.at(-1)?.role === "assistant";

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTo({ top: log.scrollHeight });
  }, [items, pending, open]);

  // "Add" puts Meemi in a good mood for a moment.
  useEffect(() => {
    if (!happyFlash) return;
    const timer = window.setTimeout(() => setHappyFlash(false), 2400);
    return () => window.clearTimeout(timer);
  }, [happyFlash]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft;
    setDraft("");
    void send(text);
  }

  // On a phone the sheet covers the page, so following a link closes it; the
  // conversation is kept. On a desktop it stays open beside the page.
  const onNavigate = () => {
    if (isPhone) closePanel();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) closePanel();
      }}
      modal={isPhone}
      disablePointerDismissal={!isPhone}
    >
      <Dialog.Portal>
        {isPhone && (
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-[rgba(36,17,63,0.48)] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        )}
        <Dialog.Popup
          initialFocus={isPhone ? true : inputRef}
          finalFocus={finalFocusRef}
          className={cn(
            "font-figtree fixed z-50 flex flex-col bg-pl-surface text-pl-text outline-none",
            "inset-0 sm:inset-y-0 sm:right-0 sm:left-auto",
            wide ? "sm:w-[680px] sm:max-w-[calc(100vw-24px)]" : "sm:w-[420px]",
            "sm:border-l sm:border-pl-line sm:shadow-[-16px_0_40px_-16px_rgba(36,17,63,0.28)]",
            "transition-[transform,width] duration-250 ease-out data-ending-style:translate-x-full data-starting-style:translate-x-full motion-reduce:transition-none",
          )}
        >
          <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-pl-line pr-2 pl-4">
            <AskMeemiAvatar
              key={mood}
              mood={mood}
              className="motion-safe:animate-[ask-meemi-pop_350ms_ease-out]"
            />
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base leading-5 font-bold">Ask Meemi</Dialog.Title>
              <Dialog.Description className="truncate text-[13px] leading-[18px] text-pl-muted">
                Finds crochet patterns in our shop
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={toggleWide}
              aria-pressed={wide}
              aria-label={wide ? "Make the panel narrower" : "Make the panel wider"}
              className={cn(ICON_BUTTON, "max-sm:hidden")}
            >
              {wide ? <Minimize2 className="size-5" aria-hidden /> : <Maximize2 className="size-5" aria-hidden />}
            </button>
            <button type="button" onClick={reset} aria-label="Start a new chat" className={ICON_BUTTON}>
              <RotateCcw className="size-5" aria-hidden />
            </button>
            <Dialog.Close aria-label="Close Ask Meemi" className={ICON_BUTTON}>
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>

          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Conversation"
            className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4"
          >
            {items.map((item) =>
              item.role === "user" ? (
                <div key={item.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-[18px] bg-pl-inverse px-3.5 py-2 text-[15px] leading-[22px] whitespace-pre-wrap text-pl-on-dark">
                    <span className="sr-only">You said: </span>
                    {item.text}
                  </p>
                </div>
              ) : (
                <AnswerRow
                  key={item.id}
                  item={item}
                  wide={wide}
                  onNavigate={onNavigate}
                  onAdded={() => setHappyFlash(true)}
                />
              ),
            )}

            {pending && (
              <div className="flex items-center gap-2" role="status">
                <AskMeemiAvatar mood="looking" size={28} />
                <span className="sr-only">Meemi is looking</span>
                <span aria-hidden className="flex gap-1">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="size-2 rounded-full bg-plum-200 motion-safe:animate-pulse"
                      style={{ animationDelay: `${dot * 150}ms` }}
                    />
                  ))}
                </span>
              </div>
            )}

            {lastIsAssistant && !pending && (
              <Chips chips={chips} onChoose={(chip) => void choose(chip)} className="pl-9" />
            )}
          </div>

          <div className="shrink-0 border-t border-pl-line px-3 pt-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
            <form
              onSubmit={submit}
              className="flex items-center gap-2 rounded-full border-[1.5px] border-pl-line-strong bg-pl-surface py-1 pr-1.5 pl-4 focus-within:border-plum-500"
            >
              <label htmlFor="ask-meemi-input" className="sr-only">
                Ask Meemi about crochet patterns
              </label>
              <input
                id="ask-meemi-input"
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={ASSISTANT_LIMITS.maxMessageChars}
                placeholder="e.g. an easy gift under $5"
                autoComplete="off"
                enterKeyHint="send"
                className="h-10 min-w-0 flex-1 bg-transparent text-base leading-[22px] outline-none placeholder:text-pl-muted sm:text-[15px]"
              />
              <button
                type="submit"
                disabled={pending || !draft.trim()}
                aria-label="Send message"
                className="pl-focus inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-pl-inverse text-pl-on-dark transition-colors hover:bg-plum-800 disabled:pointer-events-none disabled:opacity-40"
              >
                <ArrowUp className="size-5" aria-hidden />
              </button>
            </form>
            <p className="mt-2 text-center text-xs leading-4 text-pl-muted">
              Meemi only suggests patterns from our shop. It can make mistakes.
            </p>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
