import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthBackLink, AuthIconCircle, PlumAuthShell } from "@/components/auth/plum-auth";
import { plumPrimary } from "@/components/auth/plum-auth-styles";

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
      <PlumAuthShell
        lead={<AuthIconCircle icon={KeyRound} />}
        title="This link isn't valid"
        subtitle="The reset link is missing its token. It may have been copied incorrectly or already used."
      >
        <Link href="/forgot-password" className={plumPrimary}>
          Request a new link
        </Link>
      </PlumAuthShell>
    );
  }

  return (
    <PlumAuthShell
      lead={<AuthBackLink href="/login">Back to log in</AuthBackLink>}
      title="Set a new password"
      subtitle="Choose a password you don't use anywhere else."
    >
      <ResetPasswordForm token={resetToken} />
    </PlumAuthShell>
  );
}
