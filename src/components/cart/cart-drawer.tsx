"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingBag, Trash2, Loader2, AlertCircle } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Skeleton } from "@/components/ui/skeleton";
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
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-left text-base">
            <ShoppingBag className="size-4 text-brand-600" aria-hidden />
            Your bag
            {cart && cart.itemCount > 0 && (
              <span className="text-muted-foreground">({cart.itemCount})</span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Review the items in your bag, change quantities, or go to checkout.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {loading && !cart ? (
            <ul className="space-y-4 p-5" aria-hidden>
              {Array.from({ length: 3 }, (_, index) => (
                <li key={index} className="flex gap-3">
                  <Skeleton className="size-20 rounded-lg" />
                  <div className="flex-1 space-y-2 py-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-8 w-28 rounded-full" />
                  </div>
                </li>
              ))}
            </ul>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <AlertCircle className="size-8 text-destructive" aria-hidden />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="pillSm" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : isEmpty ? (
            <EmptyState
              variant="inline"
              icon={ShoppingBag}
              title="Your bag is empty"
              description="Once you add something you like, it'll show up here."
              action={
                <ButtonLink href="/shop" onClick={close} variant="brand" size="pill">
                  Start shopping
                </ButtonLink>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {cart?.lines.map((line) => (
                  <motion.li
                    key={line.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="flex gap-3 overflow-hidden p-5"
                  >
                    <Link
                      href={`/products/${line.slug}`}
                      onClick={close}
                      className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface-alt"
                    >
                      {line.imageUrl && (
                        <Image
                          src={line.imageUrl}
                          alt={line.name}
                          fill
                          sizes="80px"
                          className="object-contain"
                        />
                      )}
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/products/${line.slug}`}
                          onClick={close}
                          className="text-sm font-medium text-foreground hover:text-brand-600"
                        >
                          {line.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove(line.id, line.name)}
                          disabled={pending}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                          aria-label={`Remove ${line.name} from bag`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>

                      {!line.isAvailable && (
                        <p className="text-xs font-medium text-destructive">
                          No longer available — remove to continue
                        </p>
                      )}

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <QuantityStepper
                          size="sm"
                          value={line.quantity}
                          max={commerceConfig.maxQuantityPerItem}
                          disabled={pending || !line.isAvailable}
                          label={line.name}
                          onChange={(quantity) => changeQuantity(line.id, quantity)}
                        />
                        <span className="text-sm font-medium text-foreground">
                          {formatMoney(line.lineTotalCents)}
                        </span>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {cart && cart.lines.length > 0 && (
          <SheetFooter className="gap-3 border-t border-border p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-base font-semibold text-foreground">
                {formatMoney(cart.totals.subtotalCents)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Instant download after payment. Any local tax is added at checkout.
            </p>

            <div className="flex flex-col gap-2">
              <ButtonLink
                href="/checkout"
                onClick={close}
                variant="brand"
                size="pill"
                className="w-full"
              >
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Checkout
              </ButtonLink>
              <ButtonLink
                href="/cart"
                onClick={close}
                variant="brandOutline" size="pill" className="w-full"
              >
                View bag
              </ButtonLink>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

