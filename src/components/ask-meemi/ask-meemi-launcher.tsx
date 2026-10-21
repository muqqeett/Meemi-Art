"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { AskMeemiAvatar } from "@/components/ask-meemi/ask-meemi-avatar";
import { AskMeemiPanel } from "@/components/ask-meemi/ask-meemi-panel";
import { onAssistantOpenRequest } from "@/lib/product-events";
import { useAskMeemi } from "@/lib/stores/ask-meemi";
import { cn } from "@/lib/utils";

/**
 * Where the button would get in the way rather than help: the bag and
 * checkout, where the shopper has already chosen, and private account pages.
 * An already-open chat is left alone — only the button is hidden.
 */
const HIDDEN_PREFIXES = ["/cart", "/checkout", "/account", "/orders"];

/**
 * Ask Meemi's floating entry — Figma "Ask Meemi button" (186:4035): Meemi's
 * face and the words "Ask Meemi / Find a pattern" in a plum pill at the bottom
 * right, 24px from the edges (16px on a phone). A text label, never an icon
 * alone. Hidden while the panel is open.
 *
 * Mounted in the storefront layout, which Next keeps alive between pages, so
 * the chat is still there — open or closed, with everything said — on the next
 * page. On a product page it tells the panel which product is being viewed, so
 * "something similar to this" can be answered on the server.
 */
export function AskMeemiLauncher() {
  const pathname = usePathname() ?? "/";
  const open = useAskMeemi((s) => s.open);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const productSlug = pathname.match(/^\/products\/([a-z0-9-]+)\/?$/)?.[1] ?? null;
  useEffect(() => {
    useAskMeemi.getState().setProductSlug(productSlug);
  }, [productSlug]);

  // The product page's "Ask Meemi" opens this same panel.
  useEffect(() => onAssistantOpenRequest(() => useAskMeemi.getState().openPanel()), []);

  return (
    <>
      {!hidden && !open && (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => useAskMeemi.getState().openPanel()}
          aria-haspopup="dialog"
          className={cn(
            "pl-focus font-figtree fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 sm:right-6 sm:bottom-6",
            "inline-flex items-center gap-2.5 rounded-full bg-pl-inverse py-2 pr-5 pl-2 text-left",
            "shadow-[0_12px_14px_-4px_rgba(36,18,64,0.35)] transition-[transform,filter] duration-200 ease-out",
            "hover:brightness-110 motion-safe:active:scale-[0.98]",
          )}
        >
          <AskMeemiAvatar mood="hello" />
          <span className="flex flex-col leading-[normal]">
            <span className="text-[15px] font-bold text-pl-on-dark">Ask Meemi</span>
            <span className="text-xs text-plum-200">Find a pattern</span>
          </span>
        </button>
      )}

      <AskMeemiPanel finalFocusRef={buttonRef} />
    </>
  );
}
