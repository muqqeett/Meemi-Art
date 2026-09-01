import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Form furniture shared by every admin form.
 *
 * These exist because the product form and the coupon form had independently
 * grown the same field markup — label, control, hint, error — fourteen and nine
 * times over, and had drifted: one textarea had no radius at all and focused
 * `royal-600` while every sibling control focused `brand-600`. One definition
 * removes the drift and makes a new field two lines instead of eight.
 *
 * Nothing here owns state. Controls are passed in as children and keep their
 * own `register()`/`name`/`defaultValue` wiring exactly as before.
 */

/* ---- control surfaces ---------------------------------------------------
   One height (40px), one radius, one focus ring, for every control type. The
   `Input` component brings its own base styles, so `controlInput` only carries
   the admin's height and focus; `controlSelect` and `controlTextarea` are bare
   elements and need the full surface. */

/** Applied to `<Input>`, which already supplies border, background and radius. */
export const controlInput =
  "h-10 rounded-md border-border text-sm transition-colors duration-150 placeholder:text-muted-foreground/60 hover:border-brand-200";

/** Bare `<select>` — needs the whole surface. */
export const controlSelect =
  "h-10 w-full rounded-md border border-border bg-card px-2.5 text-sm text-foreground transition-colors duration-150 hover:border-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

/** Bare `<textarea>` — same surface, free height. */
export const controlTextarea =
  "w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground transition-colors duration-150 placeholder:text-muted-foreground/60 hover:border-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

/**
 * The `aria-describedby` value for a field, so a screen reader reads the hint
 * and the validation message that belong to the control it is on.
 *
 * Returns `undefined` when there is nothing to point at, because an empty
 * `aria-describedby` is worse than none.
 */
export function describedBy(
  id: string,
  parts: { hint?: unknown; error?: unknown },
): string | undefined {
  const ids = [
    parts.hint ? `${id}-hint` : null,
    parts.error ? `${id}-error` : null,
  ].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/**
 * One labelled control.
 *
 * `hint` sits under the control and explains; `error` replaces nothing and adds
 * below it, so the layout does not jump when validation fires — the hint stays
 * visible because it usually explains how to fix the error.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Marks the label only; validation stays with the schema. */
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-[0.8125rem] font-medium text-foreground">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </Label>

      {children}

      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * A titled group of fields.
 *
 * Two columns from `lg`: the title and its explanation on the left, the
 * controls on the right — the arrangement Stripe and Linear settle on, because
 * it lets someone scan what a long form contains without reading the fields.
 * Below `lg` it stacks.
 *
 * Sections are separated by a hairline inside one surface rather than each
 * being its own card. Nine stacked cards read as nine unrelated things; one
 * ruled surface reads as one form.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid gap-x-10 gap-y-5 border-b border-border px-5 py-6 last:border-b-0 sm:px-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="lg:sticky lg:top-20 lg:self-start">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Responsive field grid. One column on a phone, two from `sm`. */
export function FormGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

/**
 * The action bar at the foot of a page-length form.
 *
 * Sticks to the bottom of the viewport so Save is reachable from any scroll
 * position in a nine-section form. The top hairline and the blur are what
 * separate it from the content passing underneath — without them it reads as
 * part of whatever section happens to be behind it.
 */
export function FormActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2.5 border-t border-border bg-[var(--admin-canvas)]/92 px-4 py-3.5 backdrop-blur-md sm:-mx-6 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A checkbox or switch with its explanation, as a row.
 *
 * The control keeps its own label association; this only supplies the layout
 * and the secondary line, which a bare `<Label>` has nowhere to put.
 */
export function ToggleRow({
  control,
  htmlFor,
  label,
  description,
  className,
}: {
  control: ReactNode;
  htmlFor: string;
  label: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="mt-0.5 flex shrink-0 items-center">{control}</span>
      <span className="min-w-0">
        <Label
          htmlFor={htmlFor}
          className="cursor-pointer text-[0.8125rem] font-medium text-foreground"
        >
          {label}
        </Label>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </div>
  );
}
