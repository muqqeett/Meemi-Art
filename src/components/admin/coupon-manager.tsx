"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Ticket } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/brand/empty-state";
import { AdminTableCard } from "@/components/admin/admin-page-header";
import { saveCoupon, deleteCoupon, toggleCoupon } from "@/lib/actions/admin/catalog";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type AdminCoupon = {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  minOrderCents: number;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
  _count: { orders: number };
};

function toDateInput(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function CouponForm({ coupon, onDone }: { coupon: AdminCoupon | null; onDone: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveCoupon, null);
  const [type, setType] = useState(coupon?.type ?? "PERCENTAGE");

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Saved.");
    router.refresh();
    onDone();
  }, [state, router, onDone]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {coupon && <input type="hidden" name="couponId" value={coupon.id} />}

      {state && !state.ok && !state.fieldErrors && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cp-code">Code</Label>
          <Input
            id="cp-code"
            name="code"
            defaultValue={coupon?.code ?? ""}
            placeholder="WELCOME15"
            className="h-11 font-mono uppercase"
            aria-invalid={Boolean(errors?.code)}
          />
          {errors?.code && (
            <p role="alert" className="text-sm text-destructive">
              {errors.code}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cp-type">Discount type</Label>
          <select
            id="cp-type"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as "PERCENTAGE" | "FIXED")}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <option value="PERCENTAGE">Percentage off</option>
            <option value="FIXED">Fixed amount off</option>
          </select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cp-description">Description</Label>
          <Input
            id="cp-description"
            name="description"
            defaultValue={coupon?.description ?? ""}
            placeholder="Internal note about this promotion"
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cp-value">
            {type === "PERCENTAGE" ? "Percentage off" : "Amount off (cents)"}
          </Label>
          <Input
            id="cp-value"
            name="value"
            type="number"
            min={1}
            defaultValue={coupon?.value ?? ""}
            className="h-11"
            aria-invalid={Boolean(errors?.value)}
          />
          <p className="text-xs text-muted-foreground">
            {type === "PERCENTAGE" ? "1–100" : "e.g. 1000 = $10.00"}
          </p>
          {errors?.value && (
            <p role="alert" className="text-sm text-destructive">
              {errors.value}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cp-min">Minimum order (cents)</Label>
          <Input
            id="cp-min"
            name="minOrderCents"
            type="number"
            min={0}
            defaultValue={coupon?.minOrderCents ?? 0}
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cp-max">Maximum uses</Label>
          <Input
            id="cp-max"
            name="maxUses"
            type="number"
            min={1}
            defaultValue={coupon?.maxUses ?? ""}
            placeholder="Unlimited"
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cp-starts">Starts</Label>
          <Input
            id="cp-starts"
            name="startsAt"
            type="date"
            defaultValue={toDateInput(coupon?.startsAt ?? new Date())}
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cp-expires">Expires (optional)</Label>
          <Input
            id="cp-expires"
            name="expiresAt"
            type="date"
            defaultValue={toDateInput(coupon?.expiresAt ?? null)}
            className="h-11"
            aria-invalid={Boolean(errors?.expiresAt)}
          />
          {errors?.expiresAt && (
            <p role="alert" className="text-sm text-destructive">
              {errors.expiresAt}
            </p>
          )}
        </div>

        <div className="flex items-end gap-2.5 pb-2">
          <Checkbox
            id="cp-active"
            name="isActive"
            defaultChecked={coupon?.isActive ?? true}
            value="true"
          />
          <Label htmlFor="cp-active" className="cursor-pointer font-normal">
            Active
          </Label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="pill" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" size="pill" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {coupon ? "Save changes" : "Create coupon"}
        </Button>
      </div>
    </form>
  );
}

export function CouponManager({ coupons }: { coupons: AdminCoupon[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [pending, startTransition] = useTransition();

  const closeDialog = useCallback(() => setOpen(false), []);
  const now = new Date();

  function remove(coupon: AdminCoupon) {
    startTransition(async () => {
      const result = await deleteCoupon(coupon.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Coupon deleted.");
      router.refresh();
    });
  }

  function toggle(coupon: AdminCoupon, value: boolean) {
    startTransition(async () => {
      const result = await toggleCoupon(coupon.id, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(value ? "Coupon activated." : "Coupon deactivated.");
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="brand"
          size="pill"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus aria-hidden />
          New coupon
        </Button>
      </div>

      {coupons.length === 0 ? (
        <AdminTableCard>
          <EmptyState
            icon={Ticket}
            title="No coupons yet"
            description="Create a discount code shoppers can apply in the bag or at checkout."
            action={
              <Button
                variant="brand"
                size="pill"
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus aria-hidden />
                Create a coupon
              </Button>
            }
          />
        </AdminTableCard>
      ) : (
        <AdminTableCard>
          <table className="w-full min-w-[820px] text-sm">
            <caption className="sr-only">Discount coupons</caption>
            <thead className="bg-surface-alt text-left">
              <tr className="text-xs tracking-wide text-muted-foreground uppercase">
                <th scope="col" className="px-4 py-3 font-medium">
                  Code
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Discount
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Minimum
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Uses
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Expires
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Active
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {coupons.map((coupon) => {
                const expired = coupon.expiresAt ? coupon.expiresAt < now : false;
                const exhausted =
                  coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses;

                return (
                  <tr key={coupon.id} className="hover:bg-surface-alt/60">
                    <td className="px-4 py-3">
                      <span className="block font-mono font-medium text-foreground">
                        {coupon.code}
                      </span>
                      {coupon.description && (
                        <span className="block max-w-64 truncate text-xs text-muted-foreground">
                          {coupon.description}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-medium">
                      {coupon.type === "PERCENTAGE"
                        ? `${coupon.value}%`
                        : formatMoney(coupon.value)}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {coupon.minOrderCents > 0 ? formatMoney(coupon.minOrderCents) : "—"}
                    </td>

                    <td className="px-4 py-3 tabular-nums">
                      {coupon.usedCount}
                      {coupon.maxUses !== null && (
                        <span className="text-muted-foreground"> / {coupon.maxUses}</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {coupon.expiresAt ? (
                        <span className={cn(expired && "text-destructive")}>
                          {coupon.expiresAt.toLocaleDateString("en-US", {
                            dateStyle: "medium",
                          })}
                          {expired && " (expired)"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                      {exhausted && !expired && (
                        <span className="block text-xs text-warning">Limit reached</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <Switch
                        checked={coupon.isActive}
                        onCheckedChange={(value) => toggle(coupon, value === true)}
                        disabled={pending}
                        aria-label={`${coupon.isActive ? "Deactivate" : "Activate"} ${coupon.code}`}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          onClick={() => {
                            setEditing(coupon);
                            setOpen(true);
                          }}
                          aria-label={`Edit ${coupon.code}`}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => remove(coupon)}
                          disabled={pending}
                          aria-label={`Delete ${coupon.code}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTableCard>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.code}` : "New coupon"}</DialogTitle>
            <DialogDescription>
              Coupons are validated server-side against every rule set here.
            </DialogDescription>
          </DialogHeader>

          <CouponForm key={editing?.id ?? "new"} coupon={editing} onDone={closeDialog} />
        </DialogContent>
      </Dialog>
    </>
  );
}
