/**
 * Most crochet pieces come in a single size, where printing "Size One size"
 * beside the colour reads badly. These helpers keep that decision in one place
 * so the bag, the cart, the order and the confirmation email all agree.
 */

const SIZELESS = new Set(["one size", "os", "-", ""]);

export function isSizeless(size: string): boolean {
  return SIZELESS.has(size.trim().toLowerCase());
}

/** "Clay · Medium", or just "Clay" when the piece has one size. */
export function variantLabel(color: string, size: string): string {
  return isSizeless(size) ? color : `${color} · ${size}`;
}
