import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, Clock } from "lucide-react";

import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import {
  AuthCelebrate,
  AuthIconCircle,
  AuthSwitch,
  PlumAuthShell,
} from "@/components/auth/plum-auth";
import { plumPrimary, plumSecondary } from "@/components/auth/plum-auth-styles";
import { verifyEmailToken } from "@/lib/actions/verification";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

/**
 * Consumes a verification token.
 *
 * Every failure mode gets its own message and its own next step, because
 * "invalid or expired" leaves the reader with nothing to do. None of these
 * states discloses whether a particular address is registered — the visitor
 * only ever holds a token.
 */
export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  const raw = typeof token === "string" ? token : "";

  const result = await verifyEmailToken(raw);

  // Success is the design's "Done" moment: Meemi celebrates once, and there are
  // two next steps.
  if (result.ok) {
    return (
      <PlumAuthShell
        lead={<AuthCelebrate />}
        title={result.alreadyVerified ? "Already verified" : "Email verified"}
        subtitle={
          result.alreadyVerified
            ? `This address was already confirmed. Your ${siteConfig.name} account is active.`
            : `Thank you — your ${siteConfig.name} account is now active.`
        }
      >
        <Link href="/shop" className={plumPrimary}>
          Browse patterns
        </Link>
        <Link href="/account" className={plumSecondary}>
          Go to my account
        </Link>
      </PlumAuthShell>
    );
  }

  const copy = {
    invalid: {
      Icon: CircleAlert,
      title: "This link isn't valid",
      body: "The link may have been copied incorrectly. Request a new one below and we'll send a fresh link.",
    },
    expired: {
      Icon: Clock,
      title: "This link has expired",
      body: "Verification links are short-lived for security. Request a new one below.",
    },
    used: {
      Icon: CircleAlert,
      title: "This link has already been used",
      body: "Each link works once. If your account still isn't verified, request a new link below.",
    },
  }[result.reason];

  return (
    <PlumAuthShell
      lead={<AuthIconCircle icon={copy.Icon} />}
      title={copy.title}
      subtitle={copy.body}
    >
      <ResendVerificationForm />
      <AuthSwitch prompt="Already verified?" linkLabel="Log in" href="/login" />
    </PlumAuthShell>
  );
}
