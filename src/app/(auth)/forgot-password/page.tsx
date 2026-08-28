import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { isEmailConfigured } from "@/lib/email";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="heading-sub">
        Reset your password
      </h1>
      <p className="text-body mt-2">
        Enter the email address on your account and we&apos;ll send you a link to set a
        new password.
      </p>

      <div className="mt-8">
        {/* Says so up front rather than letting the success screen imply a
            message that was never sent. Reveals nothing about any account. */}
        <ForgotPasswordForm emailConfigured={isEmailConfigured()} />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
