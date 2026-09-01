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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FormGrid,
  ToggleRow,
  controlInput,
  controlSelect,
  describedBy,
} from "@/components/admin/admin-form";
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
    <form action={formAction} noValidate>
      {coupon && <input type="hidden" name="couponId" value={coupon.id} />}

      {state && !state.ok && !state.fieldErrors && (
        <p
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/[0.05] px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <FormGrid>
        <Field id="cp-code" label="Code" required error={errors?.code}>
          <Input
            id="cp-code"
            name="code"
            defaultValue={coupon?.code ?? ""}
            placeholder="WELCOME15"
            aria-invalid={Boolean(errors?.code)}
            aria-describedby={describedBy("cp-code", { error: errors?.code })}
            className={cn(controlInput, "font-mono uppercase")}
          />
        </Field>

        <Field id="cp-type" label="Discount type">
          <select
            id="cp-type"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as "PERCENTAGE" | "FIXED")}
            className={controlSelect}
          >
            <option value="PERCENTAGE">Percentage off</option>
            <option value="FIXED">Fixed amount off</option>
          </select>
        </Field>

        <Field
          id="cp-description"
          label="Description"
          hint="Internal only — shoppers never see this."
          className="sm:col-span-2"
        >
          <Input
            id="cp-description"
            name="description"
            defaultValue={coupon?.description ?? ""}
            placeholder="Internal note about this promotion"
            aria-describedby={describedBy("cp-description", { hint: true })}
            className={controlInput}
          />
        </Field>

        <Field
          id="cp-value"
          label={type === "PERCENTAGE" ? "Percentage off" : "Amount off (cents)"}
          required
          hint={type === "PERCENTAGE" ? "1–100" : "e.g. 1000 = $10.00"}
          error={errors?.value}
        >
          <Input
            id="cp-value"
            name="value"
            type="number"
            min={1}
            defaultValue={coupon?.value ?? ""}
            aria-invalid={Boolean(errors?.value)}
            aria-describedby={describedBy("cp-value", { hint: true, error: errors?.value })}
            className={cn(controlInput, "tabular-nums")}
          />
        </Field>

        <Field
          id="cp-min"
          label="Minimum order (cents)"
          hint="0 for no minimum."
        >
          <Input
            id="cp-min"
            name="minOrderCents"
            type="number"
            min={0}
            defaultValue={coupon?.minOrderCents ?? 0}
            aria-describedby={describedBy("cp-min", { hint: true })}
            className={cn(controlInput, "tabular-nums")}
          />
        </Field>

        <Field id="cp-max" label="Maximum uses" hint="Leave blank for unlimited.">
          <Input
            id="cp-max"
            name="maxUses"
            type="number"
            min={1}
            defaultValue={coupon?.maxUses ?? ""}
            placeholder="Unlimited"
            aria-describedby={describedBy("cp-max", { hint: true })}
            className={cn(controlInput, "tabular-nums")}
          />
        </Field>

        <Field id="cp-starts" label="Starts">
          <Input
            id="cp-starts"
            name="startsAt"
            type="date"
            defaultValue={toDateInput(coupon?.startsAt ?? new Date())}
            className={controlInput}
          />
        </Field>

        <Field id="cp-expires" label="Expires" hint="Optional." error={errors?.expiresAt}>
          <Input
            id="cp-expires"
            name="expiresAt"
            type="date"
            defaultValue={toDateInput(coupon?.expiresAt ?? null)}
            aria-invalid={Boolean(errors?.expiresAt)}
            aria-describedby={describedBy("cp-expires", {
              hint: true,
              error: errors?.expiresAt,
            })}
            className={controlInput}
          />
        </Field>
      </FormGrid>

      {/* Ruled off from the fields: this is a state change, not another value
          to fill in, and it was previously bottom-aligned into a grid cell
          with a padding hack that broke whenever a sibling field grew. */}
      <div className="mt-5 border-t border-border pt-5">
        <ToggleRow
          htmlFor="cp-active"
          label="Active"
          description="Inactive coupons are rejected at checkout but keep their usage history."
          control={
            <Checkbox
              id="cp-active"
              name="isActive"
              defaultChecked={coupon?.isActive ?? true}
              value="true"
            />
          }
        />
      </div>

      <div className="mt-6 flex justify-end gap-2.5 border-t border-border pt-4">
        <Button type="button" variant="outline" size="pillSm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" size="pillSm" disabled={pending}>
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
          <table className="admin-table admin-table-stack sm:min-w-[820px]">
            <caption className="sr-only">Discount coupons</caption>
            <thead>
              <tr>
                <th scope="col">
                  Code
                </th>
                <th scope="col">
                  Discount
                </th>
                <th scope="col">
                  Minimum
                </th>
                <th scope="col">
                  Uses
                </th>
                <th scope="col">
                  Expires
                </th>
                <th scope="col">
                  Active
                </th>
                <th scope="col" className="text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {coupons.map((coupon) => {
                const expired = coupon.expiresAt ? coupon.expiresAt < now : false;
                const exhausted =
                  coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses;

                return (
                  <tr key={coupon.id}>
                    <td data-label="Code">
                      <span className="block font-mono font-medium text-foreground">
                        {coupon.code}
                      </span>
                      {coupon.description && (
                        <span className="block max-w-64 truncate text-xs text-muted-foreground">
                          {coupon.description}
                        </span>
                      )}
                    </td>

                    <td data-label="Type" className="font-medium">
                      {coupon.type === "PERCENTAGE"
                        ? `${coupon.value}%`
                        : formatMoney(coupon.value)}
                    </td>

                    <td data-label="Value" className="text-muted-foreground">
                      {coupon.minOrderCents > 0 ? formatMoney(coupon.minOrderCents) : "—"}
                    </td>

                    <td data-label="Used" className="tabular-nums">
                      {coupon.usedCount}
                      {coupon.maxUses !== null && (
                        <span className="text-muted-foreground"> / {coupon.maxUses}</span>
                      )}
                    </td>

                    <td data-label="Window">
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

                    <td data-label="Status">
                      <Switch
                        checked={coupon.isActive}
                        onCheckedChange={(value) => toggle(coupon, value === true)}
                        disabled={pending}
                        aria-label={`${coupon.isActive ? "Deactivate" : "Activate"} ${coupon.code}`}
                      />
                    </td>

                    <td data-label="Actions">
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
