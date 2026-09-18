"use client";

import { useEffect } from "react";

/**
 * Reports that a product page was seen.
 *
 * Renders nothing. Once the page is actually visible — not prerendered, not a
 * background tab, not a link prefetch — it sends one small beacon after the
 * browser is idle, so it never competes with the page for the network or the
 * main thread. `sendBeacon` survives the visitor navigating away and cannot
 * block anything; if it is unavailable or fails, nothing happens.
 *
 * No cookie, no storage, no identifier: the server derives a daily-rotating
 * anonymous key from the request itself.
 */
export function ProductViewBeacon({ productId }: { productId: string }) {
  useEffect(() => {
    let sent = false;
    let idle: number | undefined;

    const send = () => {
      if (sent || document.visibilityState !== "visible") return;
      sent = true;
      try {
        const body = JSON.stringify({ productId });
        if (!navigator.sendBeacon?.("/api/analytics/view", new Blob([body], { type: "application/json" }))) {
          void fetch("/api/analytics/view", {
            method: "POST",
            body,
            headers: { "Content-Type": "application/json" },
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Analytics is never allowed to surface an error on the product page.
      }
    };

    const schedule = () => {
      if (sent || idle !== undefined) return;
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback;
      const fire = () => {
        idle = undefined;
        send();
      };
      idle = ric ? ric(fire, { timeout: 3000 }) : window.setTimeout(fire, 1200);
    };

    // A prerendered page becomes a real view only when it is activated, and a
    // background tab only when it is brought forward.
    const isPrerendering = () => (document as Document & { prerendering?: boolean }).prerendering === true;
    const onChange = () => {
      if (!isPrerendering() && document.visibilityState === "visible") schedule();
    };

    onChange();
    document.addEventListener("visibilitychange", onChange);
    document.addEventListener("prerenderingchange", onChange);

    return () => {
      document.removeEventListener("visibilitychange", onChange);
      document.removeEventListener("prerenderingchange", onChange);
      const cic = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idle !== undefined) {
        if (cic) cic(idle);
        window.clearTimeout(idle);
      }
    };
  }, [productId]);

  return null;
}
