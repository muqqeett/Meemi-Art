import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Download, Heart, Package } from "lucide-react";

import { plumLink } from "@/components/auth/plum-auth-styles";

/**
 * Shell for the log-in and sign-up screens — Figma "Log in · Email" (149:3849)
 * and "Sign up · Details" (159:4861), and their 390px counterparts.
 *
 * Desktop: a 480px card, and beside it the mascot on a plum-100 disc over a
 * short list of what an account gives you. Below `lg` the side panel is not
 * rendered, as in the mobile frames; below `sm` the card's chrome goes too and
 * the form sits flat on the page ground, which is how the 390px frames draw it.
 *
 * It renders the page's one `<h1>`. The site header is supplied by the route
 * group's layout, not here, so it can sit outside `<main>` as a banner should.
 */
export function PlumAuthShell({
  lead,
  title,
  subtitle,
  sideHeading,
  children,
}: {
  /**
   * Sits above the heading inside the card: a back link (the design's "Check
   * your email" frame) or a mascot / icon (its "Done" frame).
   */
  lead?: React.ReactNode;
  title: string;
  /** Inline content only — it is rendered inside a `<p>`. */
  subtitle: React.ReactNode;
  /** Optional line above the benefits list — the sign-up frame has one, log-in does not. */
  sideHeading?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-fill className="font-figtree flex flex-col bg-pl-page text-pl-text">
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 items-center justify-center gap-[88px] px-4 py-8 sm:px-8 sm:py-14">
        <section
          aria-labelledby="auth-title"
          className="w-full sm:max-w-[480px] sm:rounded-[28px] sm:border sm:border-pl-line sm:bg-pl-surface sm:p-10 sm:shadow-[0_6px_16px_-6px_rgba(36,18,64,0.18)]"
        >
          <div className="flex flex-col gap-4">
            {lead}
            {/* `text-wrap` turns off the site-wide balanced headings: the design
                breaks "Create your free / account", and balancing would break it
                "Create your / free account". */}
            <h1
              id="auth-title"
              className="pl-display text-wrap text-[28px] leading-8 sm:text-[34px] sm:leading-[38px]"
            >
              {title}
            </h1>
            <p className="text-base leading-[25px] text-pl-muted">{subtitle}</p>
            {children}
          </div>
        </section>

        <AuthSide heading={sideHeading} />
      </div>
    </div>
  );
}

/**
 * Three things an account does here, each checked against the app:
 * downloads can be fetched again (`/account/downloads`), orders are listed
 * (`/account/orders`), and the wishlist belongs to the account.
 *
 * The design's middle line — "Free lifetime updates land in your library" — is
 * not here: nothing in the app delivers updates, so it would be a promise with
 * nothing behind it.
 */
const BENEFITS = [
  { Icon: Download, text: "Re-download any file, on any device" },
  { Icon: Package, text: "All your orders in one place" },
  { Icon: Heart, text: "Saved items follow you everywhere" },
] as const;

function AuthSide({ heading }: { heading?: string }) {
  return (
    <aside className="hidden flex-col items-center gap-6 lg:flex">
      <div
        aria-hidden
        className="relative size-[260px] shrink-0 overflow-hidden rounded-full bg-plum-100"
      >
        <Image
          src="/auth/meemi-hello.svg"
          alt=""
          width={200}
          height={200}
          unoptimized
          priority
          className="absolute top-[30px] left-[30px] size-[200px] max-w-none"
        />
      </div>

      {heading && <p className="pl-h3">{heading}</p>}

      <ul className="flex flex-col gap-3">
        {BENEFITS.map(({ Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pl-tint-templates text-pl-text"
            >
              <Icon className="size-5" strokeWidth={1.75} />
            </span>
            <span className="text-base font-bold text-pl-text">{text}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/**
 * The rule, the "other screen" link and the fine print under both forms.
 * Shared so the log-in and sign-up screens keep the same rhythm: 16px between
 * each, as the design spaces them.
 */
export function AuthSwitch({
  prompt,
  linkLabel,
  href,
  note,
}: {
  prompt: string;
  linkLabel: string;
  href: string;
  note?: React.ReactNode;
}) {
  return (
    <>
      <AuthDivider />
      <p className="flex flex-wrap items-center gap-x-1.5 text-[15px] leading-[22px]">
        <span className="text-pl-muted">{prompt}</span>
        <Link href={href} className={plumLink}>
          {linkLabel}
        </Link>
      </p>
      {note && <p className="text-[13.5px] leading-[21px] text-pl-muted">{note}</p>}
    </>
  );
}

/** The 1px rule between a form's actions and what follows. */
export function AuthDivider() {
  return <div aria-hidden className="h-px w-full bg-pl-line" />;
}

/**
 * "← Back to log in" — the design's "Use a different email" link: an arrow and
 * an underlined plum label, set above the heading.
 */
export function AuthBackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${plumLink} inline-flex w-fit items-center gap-1.5 text-[15px] leading-[22px]`}>
      <ArrowLeft className="size-[18px]" aria-hidden />
      {children}
    </Link>
  );
}

/**
 * The celebrating Meemi from the design's "Done" frame (110px, once, above the
 * heading). Reuses the project's own `meemi-celebrate.svg`, which is
 * byte-identical to the design's export.
 */
export function AuthCelebrate() {
  return (
    <Image
      src="/home/plum/meemi-celebrate.svg"
      alt=""
      width={110}
      height={110}
      unoptimized
      className="size-[110px] shrink-0"
    />
  );
}

/**
 * A 64px plum-100 disc with an icon — the design's pattern for a status screen
 * that has no mascot ("Add a passkey"). Used for link problems, where a
 * celebrating character would be the wrong tone.
 */
export function AuthIconCircle({
  icon: Icon,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <span
      aria-hidden
      className="flex size-16 shrink-0 items-center justify-center rounded-full bg-plum-100 text-pl-text"
    >
      <Icon className="size-8" strokeWidth={1.75} />
    </span>
  );
}

/**
 * Confirmation that replaces a form once it has done its job (reset link
 * requested, password changed). A live region so a screen reader announces it.
 */
export function AuthStatus({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-[16px] bg-pl-tint-printables px-5 py-4">
      <p className="flex items-center gap-2 text-base leading-[22px] font-bold text-pl-text">
        <Icon className="size-5 shrink-0 text-success" aria-hidden />
        {title}
      </p>
      <div className="flex flex-col gap-1.5 text-[15px] leading-[22px] text-pl-muted">{children}</div>
    </div>
  );
}
