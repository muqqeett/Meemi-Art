"use client";

import { useEffect } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * Route-level error boundary.
 *
 * Users are shown a plain explanation and a way forward — never a stack trace.
 * The digest is surfaced only so someone can quote it to support; the real
 * error is logged server-side by Next.js.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[boundary]", error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div
        aria-hidden
        className="mb-5 flex size-16 items-center justify-center rounded-full bg-destructive/10"
      >
        <TriangleAlert className="size-7 text-destructive" />
      </div>

      <h1 className="heading-sub">
        Something went wrong
      </h1>

      <p className="text-body mt-3 max-w-md">
        We hit an unexpected problem loading this page. Nothing you were doing has been
        lost — try again, and if it keeps happening let us know.
      </p>

      {error.digest && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="brand" size="pill" onClick={reset}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
        <ButtonLink href="/" variant="brandOutline" size="pill">
          Back to home
        </ButtonLink>
      </div>
    </div>
  );
}

