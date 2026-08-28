import Link from "next/link";
import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";

import { Button, buttonVariants } from "@/components/ui/button";

type ButtonLinkProps = ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants>;

/**
 * A link styled as a button.
 *
 * Base UI's `Button` assumes it renders a native `<button>` and warns when it
 * does not, because swapping the element silently drops button semantics. When
 * the control genuinely is navigation it should be an `<a>` — so this sets
 * `nativeButton={false}` in one place rather than at every call site.
 */
export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...linkProps
}: ButtonLinkProps) {
  return (
    <Button
      nativeButton={false}
      variant={variant}
      size={size}
      className={className}
      render={<Link {...linkProps} />}
    >
      {children}
    </Button>
  );
}
