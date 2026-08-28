import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const resetToken = typeof token === "string" ? token : "";

  if (!resetToken) {
    return (
      <div className="text-center">
        <KeyRound className="mx-auto size-10 text-brand-600" aria-hidden />
        <h1 className="heading-sub mt-4">
          This link isn&apos;t valid
        </h1>
        <p className="text-body mt-2">
          The reset link is missing its token. It may have been copied incorrectly or
          already used.
        </p>
        <ButtonLink href="/forgot-password" variant="brand" size="pill" className="mt-6">
          Request a new link
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <h1 className="heading-sub">
        Set a new password
      </h1>
      <p className="text-body mt-2">
        Choose a password you don&apos;t use anywhere else. Signing in again on your other
        devices will be required.
      </p>

      <div className="mt-8">
        <ResetPasswordForm token={resetToken} />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
