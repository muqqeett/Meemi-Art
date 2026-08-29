"use client";

import { useId, useState, useTransition } from "react";
import { Star, Loader2, Check, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitReview } from "@/lib/actions/reviews";
import { cn } from "@/lib/utils";

const MAX_TITLE = 100;
const MAX_BODY = 2000;

type Existing = { rating: number; title: string; body: string } | null;

/**
 * Write or update a review for a product the customer has bought.
 *
 * The form carries a `productId`, and that is the only thing it can influence:
 * the server takes the user from the session, re-checks that they have a
 * COMPLETED, PAID order containing this product, and upserts on
 * (product, user). Passing someone else's product id gets a refusal; there is
 * no field here that could address another customer's review.
 *
 * Stars are real radio inputs rather than buttons. That gets keyboard support,
 * arrow-key selection and screen-reader semantics from the platform instead of
 * from hand-written key handlers — the label is the 44px target, and the input
 * itself is visually hidden but focusable, so the focus ring lands on the star.
 */
export function ReviewForm({
  productId,
  productName,
  existing,
  onDone,
}: {
  productId: string;
  productName: string;
  existing?: Existing;
  /** Called after a successful write, so a parent can close a panel. */
  onDone?: () => void;
}) {
  const groupId = useId();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { ok: true; message: string } | { ok: false; error: string } | null
  >(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    setFieldErrors({});

    startTransition(async () => {
      const response = await submitReview({ productId, rating, title, body });
      if (!response.ok) {
        setResult({ ok: false, error: response.error });
        setFieldErrors(response.fieldErrors ?? {});
        return;
      }
      setResult({ ok: true, message: response.message });
      onDone?.();
    });
  }

  if (result?.ok) {
    return (
      <div
        role="status"
        className="border-success/30 bg-success/5 rounded-xl border p-5 text-center"
      >
        <Check className="text-success mx-auto size-7" aria-hidden />
        <p className="mt-2 font-semibold text-foreground">{result.message}</p>
        <p className="text-body mt-1 text-sm">
          It appears on the {productName} page with your name and a verified-purchase
          badge.
        </p>
      </div>
    );
  }

  // The star currently painted: what the pointer is over, else what is chosen.
  const shown = hovered || rating;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <fieldset>
        <legend className="text-sm font-medium text-foreground">
          Your rating <span className="text-destructive">*</span>
        </legend>

        <div
          className="mt-2 flex flex-wrap items-center gap-1"
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              onMouseEnter={() => setHovered(value)}
              className={cn(
                "inline-flex size-11 cursor-pointer items-center justify-center rounded-md transition-colors",
                "hover:bg-surface-alt has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600",
              )}
            >
              <input
                type="radio"
                name={groupId}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only"
              />
              <Star
                className={cn(
                  "size-7 transition-colors",
                  value <= shown
                    ? "fill-warning text-warning"
                    : "fill-transparent text-muted-foreground",
                )}
                aria-hidden
              />
              <span className="sr-only">
                {value} {value === 1 ? "star" : "stars"}
              </span>
            </label>
          ))}

          <span aria-live="polite" className="text-body ml-2 text-sm">
            {rating > 0 ? `${rating} of 5` : "Not rated yet"}
          </span>
        </div>

        {fieldErrors.rating && (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {fieldErrors.rating}
          </p>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor={`${groupId}-title`}>
          Headline <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`${groupId}-title`}
          value={title}
          maxLength={MAX_TITLE}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Clear instructions, lovely finish"
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={`${groupId}-title-count`}
        />
        <div className="flex justify-between gap-3">
          {fieldErrors.title ? (
            <p role="alert" className="text-xs text-destructive">
              {fieldErrors.title}
            </p>
          ) : (
            <span />
          )}
          <span id={`${groupId}-title-count`} className="text-xs text-muted-foreground">
            {title.length}/{MAX_TITLE}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${groupId}-body`}>
          Your review <span className="text-destructive">*</span>
        </Label>
        <textarea
          id={`${groupId}-body`}
          value={body}
          maxLength={MAX_BODY}
          rows={5}
          onChange={(event) => setBody(event.target.value)}
          placeholder="How did you find the pattern? Anything another maker should know?"
          aria-invalid={Boolean(fieldErrors.body)}
          aria-describedby={`${groupId}-body-count`}
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
        />
        <div className="flex justify-between gap-3">
          {fieldErrors.body ? (
            <p role="alert" className="text-xs text-destructive">
              {fieldErrors.body}
            </p>
          ) : (
            <span />
          )}
          <span id={`${groupId}-body-count`} className="text-xs text-muted-foreground">
            {body.length}/{MAX_BODY}
          </span>
        </div>
      </div>

      {result && !result.ok && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {result.error}
        </p>
      )}

      <Button type="submit" variant="brand" size="pill" disabled={pending} className="w-full sm:w-auto">
        {pending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
        {existing ? "Update review" : "Submit review"}
      </Button>
    </form>
  );
}
