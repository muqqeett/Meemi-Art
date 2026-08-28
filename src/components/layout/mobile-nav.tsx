"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, User, Heart, Package, LogIn } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ButtonLink } from "@/components/ui/button-link";
import { Logo } from "@/components/brand/logo";
import { mainNav } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { MegaCategory } from "@/components/layout/mega-nav";

type MobileNavProps = {
  isSignedIn: boolean;
  userName: string | null;
  categories: MegaCategory[];
};

/**
 * Mobile navigation drawer. Built for touch rather than as a shrunken desktop
 * menu: category tiles you can actually see, 48px rows, and the account block
 * kept below the shopping links where it belongs.
 */
export function MobileNav({ isSignedIn, userName, categories }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-xs text-brand-700 transition-colors hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
            aria-label="Open menu"
          />
        }
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>

      <SheetContent side="left" className="w-[88vw] max-w-sm gap-0 p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-left">
            <Logo asLink={false} />
          </SheetTitle>
          <SheetDescription className="sr-only">
            Shop categories and account links
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <nav aria-label="Categories" className="p-5">
            <h2 className="label-caps mb-3 text-muted-foreground">Shop</h2>
            <ul className="grid grid-cols-2 gap-3">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/shop/${category.slug}`}
                    onClick={close}
                    className="group/tile block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
                  >
                    <span className="relative block aspect-[4/3] overflow-hidden bg-surface-alt">
                      {category.image && (
                        <Image
                          src={category.image}
                          alt=""
                          fill
                          sizes="45vw"
                          className="object-cover"
                        />
                      )}
                    </span>
                    <span className="mt-2 block text-sm font-medium">{category.name}</span>
                  </Link>
                </li>
              ))}
            </ul>

            <ul className="mt-6 space-y-1 border-t border-border pt-4">
              {mainNav.map((item) => {
                const active = pathname === item.href.split("?")[0];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "label-caps flex min-h-12 items-center rounded-xs px-2 transition-colors",
                        active
                          ? "bg-brand-50 text-brand-700"
                          : "text-ink hover:bg-surface-alt",
                      )}
                    >
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-border p-5">
            <h2 className="label-caps mb-3 text-muted-foreground">Account</h2>
            <ul className="space-y-1">
              {isSignedIn ? (
                <>
                  <li>
                    <Link
                      href="/account"
                      onClick={close}
                      className="flex min-h-12 items-center gap-3 rounded-xs px-2 text-sm font-medium hover:bg-surface-alt"
                    >
                      <User className="size-4 text-muted-foreground" aria-hidden />
                      {userName ? `Hi, ${userName.split(" ")[0]}` : "My account"}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/account/orders"
                      onClick={close}
                      className="flex min-h-12 items-center gap-3 rounded-xs px-2 text-sm font-medium hover:bg-surface-alt"
                    >
                      <Package className="size-4 text-muted-foreground" aria-hidden />
                      Orders
                    </Link>
                  </li>
                </>
              ) : (
                <li>
                  <Link
                    href="/login"
                    onClick={close}
                    className="flex min-h-12 items-center gap-3 rounded-xs px-2 text-sm font-medium hover:bg-surface-alt"
                  >
                    <LogIn className="size-4 text-muted-foreground" aria-hidden />
                    Sign in
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href="/account/wishlist"
                  onClick={close}
                  className="flex min-h-12 items-center gap-3 rounded-xs px-2 text-sm font-medium hover:bg-surface-alt"
                >
                  <Heart className="size-4 text-muted-foreground" aria-hidden />
                  Wishlist
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border p-4">
          <ButtonLink
            href="/shop"
            onClick={close}
            variant="brand"
            size="pill"
            className="w-full"
          >
            Shop all pieces
          </ButtonLink>
        </div>
      </SheetContent>
    </Sheet>
  );
}


