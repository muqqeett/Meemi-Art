import type { Metadata } from "next";
import { Suspense } from "react";

import { RegisterForm } from "@/components/auth/register-form";
import { AuthScreen } from "@/components/auth/auth-visuals";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Meemi Art account.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <AuthScreen
      title="Create your account"
      subtitle="Start your journey with Meemi Art."
      headline="Welcome. Start something handmade."
    >
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <RegisterForm />
      </Suspense>
    </AuthScreen>
  );
}
