"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { onAssistantOpenRequest } from "@/lib/product-events";
import { cn } from "@/lib/utils";

/**
 * Where the assistant would get in the way rather than help: the bag and
 * checkout, where the shopper has already chosen, and private account pages.
 */
const HIDDEN_PREFIXES = ["/cart", "/checkout", "/account", "/orders"];

/**
 * The floating entry point to the pattern guide.
 *
 * Quiet by design: a small pill at the bottom-right, never opened on its own,
 * no badge, no pulse. It reads as part of the shop's chrome — brand ink, the
 * shop's radius and type — rather than a chatbot bolted on.
 *
 * On a product page it passes that product's slug to the panel, so "similar to
 * this" can be offered and resolved on the server.
 */
export function AssistantLauncher() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  // "Ask Meemi" on a product page opens this same panel. No markup changes and
  // nothing else listens: pages that never ask are unaffected.
  useEffect(() => {
    if (hidden) return;
    return onAssistantOpenRequest(() => setOpen(true));
  }, [hidden]);

  if (hidden) {
    return null;
  }

  const productSlug = pathname.match(/^\/products\/([a-z0-9-]+)\/?$/)?.[1] ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 sm:right-6 sm:bottom-6",
          "inline-flex h-12 items-center gap-2 rounded-full bg-brand-700 px-4 text-white shadow-pop",
          "transition-[background-color,transform,opacity] duration-200 ease-out hover:bg-royal-600",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600",
          "motion-safe:active:scale-[0.98]",
          open && "pointer-events-none opacity-0",
        )}
      >
        <Sparkles className="size-4.5" aria-hidden />
        <span className="text-sm font-semibold max-sm:sr-only">Pattern guide</span>
      </button>

      <AssistantPanel open={open} onOpenChange={setOpen} productSlug={productSlug} />
    </>
  );
}
