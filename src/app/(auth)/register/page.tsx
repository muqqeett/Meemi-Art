import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { RegisterForm } from "@/components/auth/register-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Meemi Art account.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <div>
      <h1 className="heading-sub">
        Create your account
      </h1>
      <p className="text-body mt-2">
        Save your details, follow your orders, and keep a wishlist that follows you
        between devices.
      </p>

      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
          <RegisterForm />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
