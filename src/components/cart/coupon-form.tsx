"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, TicketPercent } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyCoupon, removeCoupon } from "@/lib/actions/cart";

/**
 * Coupon entry. The code is only ever validated on the server — this component
 * never decides whether a discount is legitimate.
 */
export function CouponForm({
  appliedCode,
  variant = "default",
}: {
  appliedCode: string | null;
  /** `plum` is the Plum Studio checkout styling; behaviour is identical. */
  variant?: "default" | "plum";
}) {
  const plum = variant === "plum";
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply() {
    setError(null);

    startTransition(async () => {
      const result = await applyCoupon(code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Coupon ${result.data.code} applied`);
      setCode("");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await removeCoupon();
      toast.success("Coupon removed");
      router.refresh();
    });
  }

  if (appliedCode) {
    return (
      <div
        className={
          plum
            ? "font-figtree flex items-center justify-between gap-3 rounded-[12px] border border-success/30 bg-success/5 px-4 py-3"
            : "flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3"
        }
      >
        <span className="flex items-center gap-2 text-sm">
          <TicketPercent className="size-4 text-success" aria-hidden />
          <span className={plum ? "font-bold text-pl-text" : "font-semibold text-foreground"}>
            {appliedCode}
          </span>
          <span className={plum ? "text-pl-muted" : "text-muted-foreground"}>applied</span>
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className={
            plum
              ? "pl-focus inline-flex size-9 items-center justify-center rounded-full text-pl-muted transition-colors hover:bg-plum-100 hover:text-destructive"
              : "inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          }
          aria-label={`Remove coupon ${appliedCode}`}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <X className="size-4" aria-hidden />
          )}
        </button>
      </div>
    );
  }

  // Deliberately not a <form>: this component is rendered inside the checkout
  // form, and nested forms are invalid HTML — the browser flattens them, which
  // would make "Apply" submit the whole order.
  if (plum) {
    return (
      <div className="font-figtree space-y-2">
        <Label htmlFor="coupon-code" className="text-[15px] leading-[22px] font-bold text-pl-text">
          Have a coupon?
        </Label>
        <div className="flex gap-2">
          <input
            id="coupon-code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (code.trim().length >= 3) apply();
              }
            }}
            placeholder="WELCOME15"
            autoCapitalize="characters"
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "coupon-error" : undefined}
            className="pl-focus h-11 min-w-0 flex-1 rounded-[12px] border-[1.5px] border-pl-line-strong bg-pl-surface px-3.5 text-base text-pl-text uppercase placeholder:text-pl-muted aria-invalid:border-destructive"
          />
          <button
            type="button"
            disabled={pending || code.trim().length < 3}
            onClick={apply}
            className="pl-focus inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border-[1.5px] border-pl-line-strong bg-pl-surface px-5 text-[15px] leading-[18px] font-bold text-pl-text transition-colors hover:bg-plum-100 disabled:pointer-events-none disabled:opacity-45"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Apply
          </button>
        </div>
        {error && (
          <p id="coupon-error" role="alert" className="text-sm leading-[22px] text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="coupon-code" className="text-sm font-medium">
        Have a coupon?
      </Label>
      <div className="flex gap-2">
        <Input
          id="coupon-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (code.trim().length >= 3) apply();
            }
          }}
          placeholder="WELCOME15"
          autoCapitalize="characters"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "coupon-error" : undefined}
          className="h-11 flex-1 uppercase"
        />
        <Button
          type="button"
          variant="outline"
          size="pill"
          className="rounded-full"
          disabled={pending || code.trim().length < 3}
          onClick={apply}
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Apply
        </Button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
