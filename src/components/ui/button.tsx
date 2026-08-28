import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Shared press feel for the storefront variants. Kept to 1% either way: enough
 * that the control answers the pointer, not so much that the layout twitches.
 */
const press = "duration-200 ease-out hover:scale-[1.01] active:scale-[0.99]";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",

        // ---- Meemi Art brand variants ----
        // Corners stay tight and labels are tracked-out caps: the buttons read
        // as editorial commerce rather than as soft consumer pills.
        //
        // Each storefront variant carries `press`, a 1% lift on hover and a 1%
        // give on press. It is CSS rather than Framer Motion — a two-property
        // transition does not justify a JS animation on every button — and it
        // is scoped to these variants so admin controls stay flat and quick.
        /** Primary action: brand purple. Cards, section CTAs, forms, checkout. */
        brand: `label-caps rounded-xs bg-brand-700 text-white hover:bg-brand-600 active:bg-brand-800 ${press}`,
        /** Primary on a light campaign surface — same purple, same weight. */
        hero: `label-caps rounded-xs bg-brand-700 text-white hover:bg-brand-600 ${press}`,
        /** Secondary action: sapphire. Never competes with the purple primary. */
        royal: `label-caps rounded-xs bg-royal-600 text-white hover:bg-royal-500 active:bg-royal-700 ${press}`,
        /** Secondary action: hairline purple outline that fills on hover. */
        brandOutline: `label-caps rounded-xs border border-brand-700/35 bg-transparent text-brand-700 hover:border-brand-700 hover:bg-brand-700 hover:text-white ${press}`,
        /** For use on dark panels — inverted outline. */
        onDark: `label-caps rounded-xs border border-white/35 bg-transparent text-white hover:bg-white hover:text-brand-700 ${press}`,
        /** High-contrast dark action, e.g. the newsletter submit. */
        ink: `label-caps rounded-xs bg-brand-700 text-white hover:bg-brand-600 ${press}`,
        /** Quiet chip used for filter pills and toolbar toggles. */
        chip: "rounded-xs border-border bg-background text-muted-foreground hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 data-[active=true]:border-brand-700 data-[active=true]:bg-brand-700 data-[active=true]:text-white",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",

        // ---- Touch-friendly sizes. Names kept from the original scale so
        // every call site stays valid; the shapes are now squared. ----
        /** Product-card actions. */
        pillSm: "h-9 gap-1.5 px-4 text-[0.6875rem]",
        /** Default storefront action — forms, drawers, section CTAs. */
        pill: "h-12 gap-2 px-7",
        /** Hero and full-width form submits. */
        pillLg: "h-14 gap-2 px-9 text-xs",
        /** Icon buttons in the header, sized for a 44px touch target. */
        iconPill: "size-11 rounded-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
