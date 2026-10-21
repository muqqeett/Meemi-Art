import type { Metadata } from "next";
import { Suspense } from "react";

import { RegisterForm } from "@/components/auth/register-form";
import { PlumAuthShell } from "@/components/auth/plum-auth";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Meemi Art account.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <PlumAuthShell
      title="Create your free account"
      subtitle="Takes about a minute. Choose a password and you're in."
      sideHeading="What you get with an account"
    >
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-[12px]" />}>
        <RegisterForm />
      </Suspense>
    </PlumAuthShell>
  );
}
