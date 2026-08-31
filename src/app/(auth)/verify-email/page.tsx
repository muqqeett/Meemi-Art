import type { Metadata } from "next";
import { CircleCheck, CircleAlert, Clock } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { verifyEmailToken } from "@/lib/actions/verification";
import { siteConfig } from "@/lib/config";
import { AuthScreen } from "@/components/auth/auth-visuals";

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

  if (result.ok) {
    return (
      <div className="text-center">
        <CircleCheck className="mx-auto size-11 text-success" aria-hidden />
        <h1 className="font-display mt-5 text-3xl leading-tight">
          {result.alreadyVerified ? "Already verified" : "Email verified"}
        </h1>
        <p className="text-body mt-3">
          {result.alreadyVerified
            ? `This address was already confirmed. Your ${siteConfig.name} account is active.`
            : `Thank you — your ${siteConfig.name} account is now active.`}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/shop" variant="brand" size="pill">
            Continue shopping
          </ButtonLink>
          <ButtonLink href="/account" variant="brandOutline" size="pill">
            Go to my account
          </ButtonLink>
        </div>
      </div>
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
    <AuthScreen>
      <div>
      <div className="text-center">
        <copy.Icon className="mx-auto size-11 text-warning" aria-hidden />
        <h1 className="font-display mt-5 text-3xl leading-tight">{copy.title}</h1>
        <p className="text-body mt-3">{copy.body}</p>
      </div>

      <div className="mt-8">
        <ResendVerificationForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already verified?{" "}
        <a href="/login" className="link-brand font-semibold">
          Sign in
        </a>
      </p>
    </div>
    </AuthScreen>
  );
}
