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
export function CouponForm({ appliedCode }: { appliedCode: string | null }) {
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
      <div className="flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
        <span className="flex items-center gap-2 text-sm">
          <TicketPercent className="size-4 text-success" aria-hidden />
          <span className="font-semibold text-foreground">{appliedCode}</span>
          <span className="text-muted-foreground">applied</span>
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
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
