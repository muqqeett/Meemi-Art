"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingBag, Trash2, Loader2, AlertCircle, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { plumButtonClass } from "@/components/ui/plum-button";
import { QuantityStepper } from "@/components/cart/quantity-stepper";
import { EmptyState } from "@/components/brand/empty-state";
import { useCartUI } from "@/lib/stores/cart-ui";
import { updateCartItem, removeCartItem } from "@/lib/actions/cart";
import { formatMoney } from "@/lib/money";
import { commerceConfig } from "@/lib/config";
import type { CartView } from "@/lib/cart/cart-service";

/**
 * Slide-over bag. Loads on open rather than with every page render, so the
 * header stays cheap for shoppers who never open it.
 */
export function CartDrawer() {
  const router = useRouter();
  const { isOpen, setOpen, close, setCount } = useCartUI();
  const [cart, setCart] = useState<CartView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // No state is set before the first `await`, so opening the drawer does not
  // trigger a synchronous cascade of renders from inside the effect.
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      if (!response.ok) throw new Error("Request failed");
      const data = (await response.json()) as CartView;
      setCart(data);
      setError(null);
      setCount(data.itemCount);
    } catch {
      setError("We couldn't load your bag. Please try again.");
    }
  }, [setCount]);

  // Subscribing to the store and fetching when it transitions to open — rather
  // than running an effect off the `isOpen` render value — keeps the fetch in a
  // subscription callback, which is what effects are for.
  // The store always initialises closed, so there is nothing to fetch on mount —
  // only the closed-to-open transition needs to trigger a load.
  useEffect(
    () =>
      useCartUI.subscribe((state, previous) => {
        if (state.isOpen && !previous.isOpen) void load();
      }),
    [load],
  );

  // Derived rather than stored: we are loading whenever the drawer is open and
  // we have neither data nor an error yet.
  const loading = isOpen && cart === null && error === null;

  function changeQuantity(itemId: string, quantity: number) {
    startTransition(async () => {
      const result = await updateCartItem({ itemId, quantity });
      if (!result.ok) toast.error(result.error);
      await load();
      router.refresh();
    });
  }

  function remove(itemId: string, name: string) {
    startTransition(async () => {
      const result = await removeCartItem(itemId);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(`${name} removed from your bag`);
      }
      await load();
      router.refresh();
    });
  }

  const isEmpty = !loading && cart !== null && cart.lines.length === 0;

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      {/* Figma "Overlay · Cart drawer" (19:1524): a 440px white panel and a
          plum scrim at 48%. */}
      <SheetContent
        side="right"
        showCloseButton={false}
        overlayClassName="bg-plum-900/48 supports-backdrop-filter:backdrop-blur-none"
        className="font-figtree w-full gap-0 bg-pl-surface p-0 text-pl-text shadow-[0_4px_5px_rgba(36,17,63,0.06),0_24px_24px_rgba(36,17,63,0.35)] sm:max-w-[440px]"
      >
        <SheetHeader className="flex-row items-center gap-2 border-b border-pl-line py-4 pr-3 pl-6">
          <SheetTitle className="pl-display flex-1 text-left text-xl leading-6 font-bold tracking-[-0.01em]">
            Your cart
            {cart && cart.itemCount > 0 && <span> ({cart.itemCount})</span>}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Review the items in your bag, change quantities, or go to checkout.
          </SheetDescription>
          <button
            type="button"
            onClick={close}
            aria-label="Close bag"
            className="pl-focus inline-flex size-11 items-center justify-center rounded-full text-pl-text transition-colors hover:bg-plum-100"
          >
            <X className="size-6" aria-hidden />
          </button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pt-2">
          {loading && !cart ? (
            <ul className="space-y-4 py-3" aria-hidden>
              {Array.from({ length: 3 }, (_, index) => (
                <li key={index} className="flex gap-3">
                  <Skeleton className="size-16 rounded-[12px]" />
                  <div className="flex-1 space-y-2 py-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </li>
              ))}
            </ul>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-2 py-16 text-center">
              <AlertCircle className="size-8 text-destructive" aria-hidden />
              <p className="text-sm leading-[22px] text-pl-muted">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className={plumButtonClass({ style: "secondary", size: "md" })}
              >
                Try again
              </button>
            </div>
          ) : isEmpty ? (
            <EmptyState
              tone="plum"
              variant="inline"
              icon={ShoppingBag}
              title="Your bag is empty"
              description="Once you add something you like, it'll show up here."
              action={
                <Link
                  href="/shop"
                  onClick={close}
                  className={plumButtonClass({ style: "primary", size: "md" })}
                >
                  Start shopping
                </Link>
              }
            />
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {cart?.lines.map((line) => (
                  <motion.li
                    key={line.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="flex gap-3 overflow-hidden border-b border-pl-line py-3"
                  >
                    <Link
                      href={`/products/${line.slug}`}
                      onClick={close}
                      className="pl-focus relative size-16 shrink-0 overflow-hidden rounded-[12px] bg-pl-tint-crochet"
                    >
                      {line.imageUrl && (
                        <Image
                          src={line.imageUrl}
                          alt={line.name}
                          fill
                          sizes="64px"
                          className="object-contain p-1.5"
                        />
                      )}
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link
                        href={`/products/${line.slug}`}
                        onClick={close}
                        className="pl-focus rounded-sm text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text hover:underline"
                      >
                        {line.name}
                      </Link>
                      <p className="text-[13px] leading-[18px] font-medium text-pl-muted">
                        Digital download
                      </p>

                      {!line.isAvailable && (
                        <p className="text-[13px] leading-[18px] font-bold text-destructive">
                          No longer available — remove to continue
                        </p>
                      )}

                      <div className="mt-1 flex items-center gap-3">
                        <QuantityStepper
                          size="sm"
                          value={line.quantity}
                          max={commerceConfig.maxQuantityPerItem}
                          disabled={pending || !line.isAvailable}
                          label={line.name}
                          onChange={(quantity) => changeQuantity(line.id, quantity)}
                        />
                        <button
                          type="button"
                          onClick={() => remove(line.id, line.name)}
                          disabled={pending}
                          aria-label={`Remove ${line.name} from bag`}
                          className="pl-focus inline-flex min-h-11 items-center gap-1 rounded-sm text-[13px] leading-[18px] font-medium text-pl-muted transition-colors hover:text-pl-text disabled:opacity-60"
                        >
                          <Trash2 className="size-4" aria-hidden />
                          Remove
                        </button>
                      </div>
                    </div>

                    <p className="pl-display pl-price shrink-0">
                      {formatMoney(line.lineTotalCents)}
                    </p>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {cart && cart.lines.length > 0 && (
          <SheetFooter className="mt-0 gap-3 border-t border-pl-line bg-plum-100/40 px-6 pt-5 pb-6">
            <div className="flex items-start justify-between text-base leading-[26px]">
              <span className="text-pl-muted">Subtotal</span>
              <span>{formatMoney(cart.totals.subtotalCents)}</span>
            </div>
            {cart.totals.discountCents > 0 && (
              <div className="flex items-start justify-between text-base leading-[26px]">
                <span className="text-pl-muted">Discount</span>
                <span>−{formatMoney(cart.totals.discountCents)}</span>
              </div>
            )}
            <div className="flex items-start justify-between text-base leading-[26px]">
              <span className="text-pl-muted">Tax</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base leading-[22px] font-bold tracking-[-0.005em]">
                Total
              </span>
              <span className="pl-display pl-price">
                {formatMoney(cart.totals.totalCents)}
              </span>
            </div>

            <Link
              href="/checkout"
              onClick={close}
              className={plumButtonClass({ style: "buy", size: "lg", className: "w-full" })}
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              Checkout · {formatMoney(cart.totals.totalCents)}
              <Lock className="size-5" aria-hidden />
            </Link>
            <Link
              href="/cart"
              onClick={close}
              className={plumButtonClass({ style: "secondary", size: "md", className: "w-full" })}
            >
              View bag
            </Link>

            <p className="text-[13px] leading-[18px] font-medium text-pl-muted">
              Instant download after payment. Any local tax is added at checkout.
            </p>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

