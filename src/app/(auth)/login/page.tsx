import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { AuthScreen } from "@/components/auth/auth-visuals";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Meemi Art account.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to continue to Meemi Art."
      headline="Made by hand. Ready the moment you buy."
    >
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <LoginForm />
      </Suspense>
    </AuthScreen>
  );
}
