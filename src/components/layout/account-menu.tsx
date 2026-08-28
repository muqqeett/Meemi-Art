"use client";

import Link from "next/link";
import { User, Package, Download, Heart, Settings, LogOut, LayoutDashboard } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/actions/auth";
import type { Role } from "@/generated/prisma/enums";

type AccountMenuProps = {
  user: { name: string | null; email: string; role: Role } | null;
};

const LINKS = [
  { href: "/account", label: "Overview", Icon: User },
  { href: "/account/orders", label: "Orders", Icon: Package },
  { href: "/account/downloads", label: "Downloads", Icon: Download },
  { href: "/account/wishlist", label: "Wishlist", Icon: Heart },
  { href: "/account/settings", label: "Settings", Icon: Settings },
] as const;

export function AccountMenu({ user }: AccountMenuProps) {
  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex size-11 items-center justify-center rounded-full text-brand-700 transition-colors hover:bg-surface-alt hover:text-royal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
        aria-label="Sign in"
      >
        <User className="size-5" aria-hidden />
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-brand-700 transition-colors hover:bg-surface-alt hover:text-royal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
            aria-label="Account menu"
          />
        }
      >
        <User className="size-5" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {/* The account links live in a group labelled by the signed-in identity.
            `DropdownMenuLabel` is Base UI's `Menu.GroupLabel`, which labels its
            group via aria-labelledby — it throws if used without a `Menu.Group`
            ancestor. Sign out sits outside the group as a separate action. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {user.name ?? "Your account"}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {user.role === "ADMIN" && (
            <>
              <DropdownMenuItem render={<Link href="/admin" />}>
                <LayoutDashboard aria-hidden />
                Admin dashboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {LINKS.map(({ href, label, Icon }) => (
            <DropdownMenuItem key={href} render={<Link href={href} />}>
              <Icon aria-hidden />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <form action={signOutAction}>
          {/* Sign out must be a real submit button for the server action to
              fire, so Base UI is told to keep native button behaviour rather
              than layering its own role and handlers onto one. */}
          <DropdownMenuItem
            nativeButton
            render={<button type="submit" className="w-full" />}
          >
            <LogOut aria-hidden />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


