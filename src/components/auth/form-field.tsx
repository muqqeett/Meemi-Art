"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  plumError,
  plumField,
  plumHint,
  plumLabel,
} from "@/components/auth/plum-auth-styles";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  /**
   * `plum` is the Plum Studio field used by the log-in and sign-up screens.
   * The default is the earlier styling the other auth forms still use, so
   * adopting the new look is a per-form decision and nothing else moves.
   */
  variant?: "default" | "plum";
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "tel";
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  error?: string;
  hint?: string;
  className?: string;
  /** Rendered on the label row, right-aligned — the design's "Forgot？" link. */
  labelAction?: React.ReactNode;
};

/**
 * The design's input — Figma component `Input` (3:3993).
 *
 * 48px tall, 8px radius, 16px horizontal padding, 14px text, a `#d0d5dd`
 * resting border that becomes a 3px `#d1e9ff` ring on focus. Those two colours
 * map onto the project's own `input` and `royal` tokens rather than being
 * pasted as hex, so the field stays on MeemiArt's palette and follows it if the
 * palette moves.
 *
 * Written as a class string applied to the shared `Input` rather than as a
 * change to `Input` itself: that primitive is `h-11 sm:h-8` because admin
 * tables need it dense, and this is the one flow that wants it tall.
 */
const AUTH_INPUT =
  "h-12 rounded-lg border-input bg-transparent px-4 text-sm transition-[border-color,box-shadow] " +
  "focus-visible:border-royal-300 focus-visible:ring-[3px] focus-visible:ring-royal-200 " +
  "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 sm:h-12 sm:text-sm";

/**
 * Labelled input with inline validation messaging wired up via
 * `aria-describedby` / `aria-invalid`, plus a show/hide toggle for passwords.
 */
export function FormField({
  variant = "default",
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  required,
  defaultValue,
  error,
  hint,
  className,
  labelAction,
}: FormFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === "password";
  const resolvedType = isPassword && revealed ? "text" : type;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const plum = variant === "plum";

  return (
    <div className={cn(plum ? "flex flex-col gap-1.5" : "space-y-2", className)}>
      {/* The design puts the label and its action on one row, baseline
          aligned — "Password" left, "Forgot？" right. */}
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor={id}
          className={plum ? plumLabel : "text-sm font-medium text-foreground"}
        >
          {label}
          {/* The Plum design carries no asterisk; `required` still reaches the
              input, so assistive technology is told either way. */}
          {required && !plum && (
            <span className="text-destructive" aria-hidden>
              {" "}
              *
            </span>
          )}
        </Label>
        {labelAction}
      </div>

      <div className="relative">
        <Input
          id={id}
          name={name}
          type={resolvedType}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          defaultValue={defaultValue}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
            undefined
          }
          className={cn(plum ? plumField : AUTH_INPUT, isPassword && "pr-12")}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className={cn(
              "absolute top-1/2 right-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md transition-colors",
              plum
                ? "pl-focus text-pl-muted hover:text-pl-text"
                : "text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-500",
            )}
          >
            {revealed ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className={plum ? plumHint : "text-xs text-muted-foreground"}>
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className={plum ? plumError : "text-sm text-destructive"}
        >
          {error}
        </p>
      )}
    </div>
  );
}
