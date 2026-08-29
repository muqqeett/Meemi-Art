"use client";

import { useState, useTransition } from "react";
import { Loader2, Search, Check, X, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reconcileTransaction } from "@/lib/actions/admin/reconcile";
import type { ReconcileReport } from "@/lib/payments/reconcile";
import { formatMoney } from "@/lib/money";

/**
 * Recovers an order whose payment succeeded but whose webhook never arrived.
 *
 * Every check shown here was performed server-side against Paddle's API. The
 * form sends a transaction id and receives a verdict; it has no ability to
 * fulfil anything on its own, and there is deliberately no control that marks
 * an order paid without Paddle agreeing.
 */
export function ReconcileForm() {
  const [transactionId, setTransactionId] = useState("");
  const [report, setReport] = useState<ReconcileReport | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!transactionId.trim()) return;
    setReport(null);
    startTransition(async () => {
      setReport(await reconcileTransaction(transactionId));
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-body text-sm">
        This does not charge the customer. It only synchronises an already-completed
        Paddle transaction with Meemi Art — the transaction is read back from Paddle
        and must prove itself completed, captured, unrefunded and matched to this
        order before anything is fulfilled.
      </p>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[18rem] flex-1 space-y-1.5">
          <Label htmlFor="txn">Paddle transaction ID</Label>
          <Input
            id="txn"
            value={transactionId}
            onChange={(event) => setTransactionId(event.target.value)}
            placeholder="txn_01…"
            autoComplete="off"
            spellCheck={false}
            className="h-11 font-mono text-sm"
          />
        </div>
        <Button type="submit" variant="brand" size="pill" disabled={pending}>
          {pending ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Search className="mr-2 size-4" aria-hidden />
          )}
          {pending ? "Verifying…" : "Verify & Reconcile"}
        </Button>
      </form>

      {report && (
        <div
          role="status"
          className={`space-y-4 rounded-xl border p-4 ${
            report.ok
              ? "border-success/30 bg-success/5"
              : "border-warning/40 bg-warning/10"
          }`}
        >
          <p className="text-sm font-semibold text-foreground">{report.message}</p>

          {(report.transaction || report.order) && (
            <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              {report.transaction && (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Paddle status</dt>
                    <dd className="font-medium text-foreground">
                      {report.transaction.status}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Payment</dt>
                    <dd className="font-medium text-foreground">
                      {report.transaction.paymentStatus}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="font-medium text-foreground">
                      {report.transaction.amountCents === null
                        ? "—"
                        : formatMoney(report.transaction.amountCents)}{" "}
                      {report.transaction.currency ?? ""}
                    </dd>
                  </div>
                </>
              )}
              {report.order && (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Order</dt>
                    <dd className="font-mono font-medium text-foreground">
                      {report.order.orderNumber}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Order status</dt>
                    <dd className="font-medium text-foreground">{report.order.status}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Fulfilment</dt>
                    <dd className="font-medium text-foreground">{report.outcome}</dd>
                  </div>
                </>
              )}
            </dl>
          )}

          {report.checks.length > 0 && (
            <ul className="space-y-1 border-t border-border/60 pt-3 text-xs">
              {report.checks.map((check) => (
                <li key={check.label} className="flex items-start gap-2">
                  {check.ok ? (
                    <Check className="text-success mt-0.5 size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <X className="text-destructive mt-0.5 size-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="text-foreground">{check.label}</span>
                  <span className="text-muted-foreground ml-auto text-right">
                    {check.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!report.ok && (
            <p className="text-warning flex items-start gap-2 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Nothing was changed. No order was completed and no access was granted.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
