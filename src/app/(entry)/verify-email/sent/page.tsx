import type { Metadata } from "next";
import Link from "next/link";

import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { AuthCelebrate, AuthDivider, PlumAuthShell } from "@/components/auth/plum-auth";
import { plumNotice, plumPrimary, plumSecondary } from "@/components/auth/plum-auth-styles";
import { getCurrentUser } from "@/lib/auth-guards";
import { authConfig, siteConfig } from "@/lib/config";
import { isEmailConfigured } from "@/lib/email";

export const metadata: Metadata = {
  title: "Check your email",
  robots: { index: false, follow: false },
};

/**
 * Landing page after registration — the design's "Sign up · Done".
 *
 * Registration signs the shopper in before redirecting here, and an unverified
 * account can browse and buy, so "your account is ready" is true; what is
 * pending is only confirming the address. The page says both, and — unlike a
 * flow where the code comes first — keeps the resend control on the page
 * because the link may not have arrived yet.
 *
 * The name and the address shown both come from the session, never the URL:
 * `?email=` only pre-fills the resend field, so a crafted link cannot pair a
 * signed-in user's name with an address that is not theirs.
 */
export default async function VerificationSentPage({
  searchParams,
}: PageProps<"/verify-email/sent">) {
  const { email } = await searchParams;
  const configured = isEmailConfigured();

  // Present when the shopper arrived straight from registration; absent if the
  // page is opened signed out, in which case the greeting drops the name and
  // the copy does not name an address.
  const user = await getCurrentUser();
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const address = user?.email ?? "";
  // Pre-filling the resend field with a typed-in address is harmless: the
  // resend reply is identical for every address.
  const resendDefault = address || (typeof email === "string" ? email : "");

  return (
    <PlumAuthShell
      lead={<AuthCelebrate />}
      title={
        firstName
          ? `Welcome to ${siteConfig.name}, ${firstName}!`
          : `Welcome to ${siteConfig.name}!`
      }
      subtitle={
        configured ? (
          <>
            Your account is ready. We&apos;ve sent a link to{" "}
            {address ? <strong className="text-pl-text">{address}</strong> : "your email"}{" "}
            to confirm your address. It expires in {authConfig.verificationTtlMinutes}{" "}
            minutes.
          </>
        ) : (
          "Your account is ready."
        )
      }
    >
      {/* Honest about the environment rather than pretending mail went out,
          and without naming any configuration to a visitor. */}
      {!configured && (
        <p role="status" className={plumNotice}>
          Email delivery isn&apos;t available right now, so no confirmation link was
          sent. You can request one later.
        </p>
      )}

      <Link href="/shop" className={plumPrimary}>
        Browse patterns
      </Link>
      {/* The design's second step is "Get a free pattern". There is no free-pattern
          route in this shop, so the learning section — which the homepage already
          calls "free guides" — takes its place. */}
      <Link href="/learn" className={plumSecondary}>
        Explore free guides
      </Link>

      <AuthDivider />
      {configured && (
        <p className="text-[15px] leading-[22px] text-pl-muted">
          Didn&apos;t get the email? Check your spam folder, or request another.
        </p>
      )}
      <ResendVerificationForm defaultEmail={resendDefault} emphasis="secondary" />
    </PlumAuthShell>
  );
}
