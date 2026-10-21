import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { PlumAuthShell } from "@/components/auth/plum-auth";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Meemi Art account.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <PlumAuthShell
      title="Log in"
      subtitle="Welcome back. Log in to find your downloads, orders and saved patterns."
    >
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-[12px]" />}>
        <LoginForm />
      </Suspense>
    </PlumAuthShell>
  );
}
