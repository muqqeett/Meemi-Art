import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Plum Studio buttons — Figma "Button" (5:98).
 *
 * Four styles, three sizes, all pills:
 *   buy        marigold with a 2px plum outline. Purchase actions only: add to
 *              cart, checkout, buy CTAs.
 *   primary    plum fill. The main action that is not a purchase.
 *   secondary  white with a 1.5px outline.
 *   ghost      outlined, light ink. For use on plum backgrounds only.
 *
 * Heights are 36 / 44 / 56 and the design sets a 44px minimum touch target, so
 * `md` is the default. Hover darkens slightly (150ms), pressed scales to 0.98,
 * disabled drops to 45% with no pointer events.
 */
export type PlumButtonStyle = "buy" | "primary" | "secondary" | "ghost";
export type PlumButtonSize = "sm" | "md" | "lg";

const STYLE: Record<PlumButtonStyle, string> = {
  buy: "border-2 border-plum-900 bg-pl-buy text-pl-text hover:brightness-95",
  primary: "bg-plum-900 text-pl-on-dark hover:bg-plum-800",
  secondary: "border-[1.5px] border-pl-line-strong bg-pl-surface text-pl-text hover:bg-plum-100",
  ghost: "border-[1.5px] border-pl-on-dark bg-transparent text-pl-on-dark hover:bg-white/10",
};

const SIZE: Record<PlumButtonSize, string> = {
  sm: "h-9 px-3.5 text-[14px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-[15px]",
};

export function plumButtonClass({
  style = "primary",
  size = "md",
  className,
}: {
  style?: PlumButtonStyle;
  size?: PlumButtonSize;
  className?: string;
} = {}) {
  return cn(
    "pl-focus font-figtree inline-flex items-center justify-center gap-2 rounded-full leading-[18px] font-bold whitespace-nowrap",
    "transition-[background-color,filter,transform] duration-150 active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    STYLE[style],
    SIZE[size],
    className,
  );
}

type PlumButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  style?: PlumButtonStyle;
  size?: PlumButtonSize;
  className?: string;
};

export function PlumButtonLink({
  style,
  size,
  className,
  ...props
}: PlumButtonLinkProps) {
  return <Link className={plumButtonClass({ style, size, className })} {...props} />;
}
