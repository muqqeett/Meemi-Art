"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { MeemiAvatar, expressionForTip } from "@/components/product/meemi/meemi-avatar";
import type { MeemiFacts } from "@/lib/meemi/facts";
import {
  EMPTY_MEEMI_SESSION,
  markGreeted,
  markSeen,
  mayInterrupt,
  readMeemiSession,
  setQuiet,
  shouldGreet,
  writeMeemiSession,
  type MeemiSession,
} from "@/lib/meemi/session";
import {
  MEEMI_ACTION_LABELS,
  explainDifficultyTip,
  greetingTip,
  guideTips,
  menuTip,
  reactionTip,
  sectionTip,
  techniquesTip,
  type MeemiAction,
  type MeemiTip,
} from "@/lib/meemi/tips";
import { duration, ease } from "@/lib/motion";
import { onProductEvent, requestAssistantOpen } from "@/lib/product-events";
import { useCartUI } from "@/lib/stores/cart-ui";
import { cn } from "@/lib/utils";

/** Meemi arrives after the page has settled, never with it. */
const ARRIVAL_DELAY_MS = 2200;
/** Unanswered greetings and nudges tuck themselves away. */
const GREETING_HIDE_MS = 15_000;
const NUDGE_HIDE_MS = 9_000;
/** No two unrequested messages closer than this. */
const NUDGE_COOLDOWN_MS = 20_000;
/** Let the existing control's own confirmation land first. */
const REACTION_DELAY_MS = 700;

type Section = "difficulty" | "techniques";

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Rectangles within `margin` px of each other count as overlapping, so Meemi
 * steps aside a scroll-step *before* it would touch the purchase controls, not
 * one frame after.
 */
function overlaps(a: DOMRect, b: DOMRect, margin = 32): boolean {
  return a.left < b.right + margin && a.right > b.left - margin && a.top < b.bottom + margin && a.bottom > b.top - margin;
}

/**
 * Meemi — the product page's small crochet guide.
 *
 * A personality layer, not a second assistant. Everything it states comes from
 * `MeemiFacts`, derived on the server from the product and its enabled
 * difficulty assessment; "Ask Meemi" opens the existing Pattern Concierge,
 * which stays the only thing on the site that talks to a model.
 *
 * ── Staying out of the way ────────────────────────────────────────────────
 *
 *   - It arrives after a short delay, greets once per product per session,
 *     and "Not now" keeps it quiet for the rest of the session.
 *   - Unrequested messages are rare: a nudge when the customer reaches the
 *     difficulty or techniques block, and a word after a successful wishlist
 *     save or add to cart — each at most once per product, never two within
 *     twenty seconds, and never over something the customer opened.
 *   - It sits above the Pattern guide launcher, and hides itself whenever it
 *     would cover the purchase controls (`data-meemi-avoid`); a bubble that
 *     would cover them is tucked away.
 *
 * ── Accessibility ─────────────────────────────────────────────────────────
 *
 * Not a dialog and never modal: nothing is trapped and focus is never moved
 * onto it uninvited. The avatar is a button with `aria-expanded`; the bubble
 * follows it in tab order; Escape tucks it away and returns focus to the
 * avatar. New messages are announced through a polite live region. Motion is
 * transform and opacity only, and `MotionProvider`'s `reducedMotion="user"`
 * drops the transforms for anyone who asks for reduced motion.
 */
export function MeemiGuide({ facts, assistantAvailable }: { facts: MeemiFacts; assistantAvailable: boolean }) {
  const bubbleId = useId();
  const [arrived, setArrived] = useState(false);
  const [tip, setTip] = useState<MeemiTip | null>(null);
  const [guide, setGuide] = useState<{ tips: MeemiTip[]; index: number } | null>(null);
  const [obstructed, setObstructed] = useState(false);
  const [reaction, setReaction] = useState(0);

  const session = useRef<MeemiSession>(EMPTY_MEEMI_SESSION);
  const tipRef = useRef<MeemiTip | null>(null);
  const obstructedRef = useRef(false);
  const lastNudgeAt = useRef(0);
  const hideTimer = useRef<number | undefined>(undefined);
  const interacting = useRef(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const pendingCartReaction = useRef(false);
  const cartOpen = useCartUI((state) => state.isOpen);

  const productId = facts.productId;

  const updateSession = useCallback((change: (current: MeemiSession) => MeemiSession) => {
    session.current = change(session.current);
    writeMeemiSession(sessionStore(), session.current);
  }, []);

  const clearHideTimer = () => window.clearTimeout(hideTimer.current);

  const tuckAway = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    tipRef.current = null;
    setTip(null);
    setGuide(null);
  }, []);

  const show = useCallback(
    (next: MeemiTip, autoHideMs?: number) => {
      window.clearTimeout(hideTimer.current);
      const actions = next.actions.filter((action) => action !== "ask" || assistantAvailable);
      const shown = { ...next, actions };
      tipRef.current = shown;
      setTip(shown);
      if (autoHideMs) {
        hideTimer.current = window.setTimeout(() => {
          if (!interacting.current) tuckAway();
        }, autoHideMs);
      }
    },
    [assistantAvailable, tuckAway],
  );

  /** May an unrequested message of this kind appear right now? */
  const mayNudge = useCallback(
    (kind: string, { cooldown = true } = {}) =>
      tipRef.current === null &&
      !obstructedRef.current &&
      (!cooldown || Date.now() - lastNudgeAt.current > NUDGE_COOLDOWN_MS) &&
      mayInterrupt(session.current, productId, kind),
    [productId],
  );

  // Arrival and the once-per-product greeting.
  useEffect(() => {
    session.current = readMeemiSession(sessionStore());
    const timer = window.setTimeout(() => {
      setArrived(true);
      if (shouldGreet(session.current, productId)) {
        updateSession((current) => markGreeted(current, productId));
        lastNudgeAt.current = Date.now();
        show(greetingTip(), GREETING_HIDE_MS);
      }
    }, ARRIVAL_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(hideTimer.current);
    };
  }, [productId, show, updateSession]);

  // Nudges when the customer reaches the difficulty or techniques block.
  useEffect(() => {
    if (!arrived || typeof IntersectionObserver === "undefined") return;
    const anchors = Array.from(document.querySelectorAll<HTMLElement>("[data-meemi-anchor]"));
    if (anchors.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const section = entry.target.getAttribute("data-meemi-anchor") as Section;
          const next = sectionTip(section, facts);
          const kind = `section-${section}`;
          if (!next) {
            observer.unobserve(entry.target);
            continue;
          }
          if (!mayNudge(kind)) continue;
          updateSession((current) => markSeen(current, productId, kind));
          lastNudgeAt.current = Date.now();
          observer.unobserve(entry.target);
          show(next, NUDGE_HIDE_MS);
          break;
        }
      },
      { threshold: 0.6 },
    );
    anchors.forEach((anchor) => observer.observe(anchor));
    return () => observer.disconnect();
  }, [arrived, facts, mayNudge, productId, show, updateSession]);

  const react = useCallback(
    (kind: "wishlist" | "cart") => {
      if (!mayNudge(kind, { cooldown: false })) return;
      updateSession((current) => markSeen(current, productId, kind));
      lastNudgeAt.current = Date.now();
      setReaction((count) => count + 1);
      show(reactionTip(kind), NUDGE_HIDE_MS);
    },
    [mayNudge, productId, show, updateSession],
  );

  // A word after the existing wishlist and cart actions succeed — for this product only.
  useEffect(() => {
    if (!arrived) return;
    return onProductEvent((event) => {
      if (event.productId !== productId) return;
      if (event.type === "wishlist-added") {
        window.setTimeout(() => react("wishlist"), REACTION_DELAY_MS);
      } else {
        // Adding opens the cart drawer; say it once the drawer is closed, not behind it.
        pendingCartReaction.current = true;
      }
    });
  }, [arrived, productId, react]);

  useEffect(() => {
    if (cartOpen || !pendingCartReaction.current) return;
    pendingCartReaction.current = false;
    const timer = window.setTimeout(() => react("cart"), REACTION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [cartOpen, react]);

  // Never cover the purchase controls.
  useEffect(() => {
    if (!arrived) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-meemi-avoid]")).map((element) =>
        element.getBoundingClientRect(),
      );
      const avatar = avatarRef.current?.getBoundingClientRect();
      const blocked = !!avatar && targets.some((rect) => overlaps(avatar, rect));
      if (blocked !== obstructedRef.current) {
        obstructedRef.current = blocked;
        setObstructed(blocked);
      }
      const bubble = bubbleRef.current?.getBoundingClientRect();
      if (tipRef.current && (blocked || (bubble && targets.some((rect) => overlaps(bubble, rect))))) {
        tuckAway();
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [arrived, tip, tuckAway]);

  function act(action: MeemiAction) {
    clearHideTimer();
    switch (action) {
      case "show-guide": {
        const tips = guideTips(facts);
        if (tips.length === 0) {
          show({
            kind: "guide",
            emoji: "🧶",
            text: "I don't have a verified guide for this pattern yet — but you can ask me anything about it.",
            actions: ["ask", "done"],
          });
          return;
        }
        setGuide({ tips, index: 0 });
        show(tips[0]);
        return;
      }
      case "next": {
        if (!guide) return tuckAway();
        const index = Math.min(guide.index + 1, guide.tips.length - 1);
        setGuide({ ...guide, index });
        show(guide.tips[index]);
        return;
      }
      case "not-now":
        updateSession(setQuiet);
        tuckAway();
        return;
      case "explain-difficulty": {
        const next = explainDifficultyTip(facts);
        setGuide(null);
        return next ? show(next) : tuckAway();
      }
      case "show-techniques": {
        const next = techniquesTip(facts);
        setGuide(null);
        return next ? show(next) : tuckAway();
      }
      case "ask":
        tuckAway();
        requestAssistantOpen();
        return;
      case "done":
        tuckAway();
        return;
    }
  }

  function toggle() {
    if (tipRef.current) {
      tuckAway();
    } else {
      setGuide(null);
      show(menuTip(facts));
    }
  }

  if (!arrived) return null;

  return (
    <div
      data-meemi-guide
      // Hidden, not just transparent, while it would cover the purchase
      // controls: out of the tab order and the accessibility tree too.
      inert={obstructed || undefined}
      aria-hidden={obstructed || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && tipRef.current) {
          event.stopPropagation();
          tuckAway();
          avatarRef.current?.focus();
        }
      }}
      onPointerEnter={() => (interacting.current = true)}
      onPointerLeave={() => (interacting.current = false)}
      onFocus={() => (interacting.current = true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) interacting.current = false;
      }}
      className={cn(
        // Stacked directly above the Pattern guide launcher (48px tall at
        // bottom 1rem, or 1.5rem from `sm`), right-aligned with it.
        "pointer-events-none fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col-reverse items-end gap-2 sm:right-6 sm:bottom-[5.25rem]",
        "transition-opacity duration-200",
        obstructed && "opacity-0",
      )}
    >
      {/* Announces each new message without moving focus. */}
      <p className="sr-only" aria-live="polite">
        {tip ? `Meemi: ${tip.text}` : ""}
      </p>

      <motion.button
        ref={avatarRef}
        type="button"
        onClick={toggle}
        aria-expanded={tip !== null}
        aria-controls={tip ? bubbleId : undefined}
        aria-label={tip ? "Tuck Meemi away" : "Open Meemi, your crochet guide"}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.normal, ease: ease.enter }}
        className="pointer-events-auto relative inline-flex size-12 items-center justify-center rounded-full border border-border bg-surface p-1.5 shadow-pop transition-colors hover:border-brand-700/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 sm:size-14"
      >
        <motion.span
          key={reaction}
          className="inline-flex size-full"
          // A single small lift on a reaction; otherwise a few slow breaths
          // while a message is showing, and stillness the rest of the time.
          animate={tip ? { scale: reaction > 0 ? [1, 1.08, 1] : [1, 1.035, 1] } : { scale: 1 }}
          transition={
            tip
              ? { duration: reaction > 0 ? 0.45 : 3.2, ease: "easeInOut", repeat: reaction > 0 ? 0 : 2 }
              : { duration: duration.fast }
          }
        >
          <MeemiAvatar expression={expressionForTip(tip?.kind ?? null)} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {tip && (
          <motion.div
            ref={bubbleRef}
            id={bubbleId}
            role="group"
            aria-label="Meemi, your crochet guide"
            key="bubble"
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            // A bubble on its way out never catches a tap meant for the page below.
            exit={{ opacity: 0, scale: 0.98, pointerEvents: "none", transition: { duration: duration.fast, ease: ease.exit } }}
            transition={{ duration: duration.fast, ease: ease.enter }}
            style={{ transformOrigin: "bottom right" }}
            className="pointer-events-auto relative w-[min(19rem,calc(100vw-2rem))] rounded-sm border border-border bg-surface px-4 pt-3.5 pb-4 shadow-pop"
          >
            <p className="label-caps pr-8 text-[0.625rem] text-brand-600">Meemi · your crochet guide</p>

            <p className="mt-2 pr-2 text-sm leading-relaxed text-foreground">
              <span aria-hidden className="mr-1.5">
                {tip.emoji}
              </span>
              {tip.text}
            </p>

            {guide && guide.tips.length > 1 && (
              <p className="mt-1.5 text-[0.6875rem] text-muted-foreground tabular-nums">
                Tip {guide.index + 1} of {guide.tips.length}
              </p>
            )}

            {tip.actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tip.actions.map((action, index) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => act(action)}
                    className={cn(
                      "inline-flex h-9 items-center rounded-full px-3.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600",
                      index === 0
                        ? "bg-brand-700 text-white hover:bg-royal-600"
                        : "border border-border bg-surface text-brand-700 hover:border-brand-700/40 hover:bg-brand-50",
                    )}
                  >
                    {MEEMI_ACTION_LABELS[action]}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                tuckAway();
                avatarRef.current?.focus();
              }}
              aria-label="Tuck Meemi away"
              className="absolute top-1.5 right-1.5 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
            >
              <X className="size-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
