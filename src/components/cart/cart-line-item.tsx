"use client";

import { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { QuantityStepper } from "@/components/cart/quantity-stepper";
import { updateCartItem, removeCartItem } from "@/lib/actions/cart";
import { formatMoney } from "@/lib/money";
import { commerceConfig } from "@/lib/config";
import type { CartLineView } from "@/lib/cart/cart-service";

export function CartLineItem({ line }: { line: CartLineView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeQuantity(quantity: number) {
    startTransition(async () => {
      const result = await updateCartItem({ itemId: line.id, quantity });
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeCartItem(line.id);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(`${line.name} removed from your bag`);
      }
      router.refresh();
    });
  }

  return (
    <li
      className="flex gap-4 py-5 data-[pending=true]:opacity-60"
      data-pending={pending}
    >
      <Link
        href={`/products/${line.slug}`}
        className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-surface-alt sm:size-28"
      >
        {line.imageUrl && (
          <Image
            src={line.imageUrl}
            alt={line.name}
            fill
            sizes="112px"
            className="object-cover"
          />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              {line.brand}
            </p>
            <h3 className="mt-0.5 font-medium text-foreground">
              <Link href={`/products/${line.slug}`} className="hover:text-brand-600">
                {line.name}
              </Link>
            </h3>
          </div>

          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label={`Remove ${line.name} from bag`}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-alt hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>

        {!line.isAvailable && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4" aria-hidden />
            No longer available — remove this to check out
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
          <QuantityStepper
            value={line.quantity}
            onChange={changeQuantity}
            max={commerceConfig.maxQuantityPerItem}
            disabled={pending || !line.isAvailable}
            label={line.name}
          />

          <div className="text-right">
            <p className="font-semibold text-foreground tabular-nums">
              {formatMoney(line.lineTotalCents)}
            </p>
            {line.quantity > 1 && (
              <p className="text-xs text-muted-foreground">
                {formatMoney(line.unitPriceCents)} each
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
