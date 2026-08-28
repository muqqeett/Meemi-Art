import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { ProfileForm, PasswordForm } from "@/components/account/settings-forms";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guards";
import { signOutAction } from "@/lib/actions/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await requireUser("/account/settings");

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, phone: true, email: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <ProfileForm
        defaultName={record?.name ?? ""}
        defaultPhone={record?.phone ?? ""}
        email={record?.email ?? user.email}
      />

      <PasswordForm />

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Session</h2>
        <p className="text-body mt-1">
          Member since{" "}
          {record?.createdAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
          })}
          .
        </p>

        <form action={signOutAction} className="mt-4">
          <Button type="submit" variant="brandOutline" size="pill">
            <LogOut aria-hidden />
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}

