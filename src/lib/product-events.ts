/**
 * Small browser events announcing things that already happened on a page.
 *
 * Emitted by the existing controls *after* their own action has succeeded, and
 * only listened to by optional UI (the product page's Meemi guide). Emitting
 * changes nothing about the control that emits: no state is shared, nothing
 * waits for a listener, and with no listener the event is simply dropped.
 */

export type ProductEvent =
  | { type: "wishlist-added"; productId: string }
  | { type: "cart-added"; productId: string };

const PRODUCT_EVENT = "meemiart:product-event";
const OPEN_ASSISTANT = "meemiart:open-assistant";

export function emitProductEvent(event: ProductEvent): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ProductEvent>(PRODUCT_EVENT, { detail: event }));
}

export function onProductEvent(handler: (event: ProductEvent) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ProductEvent>).detail;
    if (detail && typeof detail.productId === "string") handler(detail);
  };
  window.addEventListener(PRODUCT_EVENT, listener);
  return () => window.removeEventListener(PRODUCT_EVENT, listener);
}

/** Ask the existing Pattern Concierge to open. Only the assistant launcher listens. */
export function requestAssistantOpen(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_ASSISTANT));
}

export function onAssistantOpenRequest(handler: () => void): () => void {
  window.addEventListener(OPEN_ASSISTANT, handler);
  return () => window.removeEventListener(OPEN_ASSISTANT, handler);
}
