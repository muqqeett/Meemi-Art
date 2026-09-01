"use client";

import { useEffect } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * Admin error boundary.
 *
 * Sits inside the admin layout, so a failed query loses the page's content and
 * not the sidebar — the operator can still navigate away instead of being
 * dropped onto the storefront error screen.
 *
 * The message stays generic on purpose: `error.message` from a server component
 * can carry a connection string or a query fragment, and this boundary renders
 * in the browser. The digest is enough to find the real error in the server
 * logs.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div
        aria-hidden
        className="mb-5 flex size-16 items-center justify-center rounded-full bg-destructive/10"
      >
        <TriangleAlert className="size-7 text-destructive" />
      </div>

      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
        This page could not load
      </h1>

      <p className="text-body mt-3 max-w-md">
        Something failed while fetching data for this screen. Nothing has been
        changed — retrying is safe.
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
        <ButtonLink href="/admin" variant="brandOutline" size="pill">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
