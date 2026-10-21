import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthBackLink, PlumAuthShell } from "@/components/auth/plum-auth";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <PlumAuthShell
      lead={<AuthBackLink href="/login">Back to log in</AuthBackLink>}
      title="Reset your password"
      subtitle="Enter the email address on your account and we'll send you a link to set a new password."
    >
      <ForgotPasswordForm />
    </PlumAuthShell>
  );
}
