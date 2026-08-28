import type { Metadata } from "next";
import { MailCheck } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { authConfig } from "@/lib/config";
import { isEmailConfigured } from "@/lib/email";

export const metadata: Metadata = {
  title: "Check your email",
  robots: { index: false, follow: false },
};

/** Landing page after registration. */
export default async function VerificationSentPage({
  searchParams,
}: PageProps<"/verify-email/sent">) {
  const { email } = await searchParams;
  const address = typeof email === "string" ? email : "";
  const configured = isEmailConfigured();

  return (
    <div>
      <div className="text-center">
        <MailCheck className="mx-auto size-11 text-brand-700" aria-hidden />
        <h1 className="font-display mt-5 text-3xl leading-tight">Check your email</h1>
        <p className="text-body mt-3">
          {address ? (
            <>
              We&apos;ve sent a verification link to{" "}
              <span className="font-medium text-foreground">{address}</span>. Follow it to
              activate your account.
            </>
          ) : (
            "We've sent you a verification link. Follow it to activate your account."
          )}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          The link expires in {authConfig.verificationTtlMinutes} minutes.
        </p>
      </div>

      {/* Honest about the environment rather than pretending mail went out. */}
      {!configured && (
        <p
          role="status"
          className="mt-6 border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning"
        >
          Email delivery isn&apos;t configured on this environment, so no message was
          actually sent. Set <code className="font-mono">RESEND_API_KEY</code> and{" "}
          <code className="font-mono">EMAIL_FROM</code> to enable it.
        </p>
      )}

      <div className="mt-8">
        <p className="text-body mb-4 text-center text-sm">
          Didn&apos;t get it? Check your spam folder, or request another.
        </p>
        <ResendVerificationForm defaultEmail={address} />
      </div>

      <div className="mt-8 flex justify-center">
        <ButtonLink href="/shop" variant="brandOutline" size="pill">
          Continue shopping
        </ButtonLink>
      </div>
    </div>
  );
}
