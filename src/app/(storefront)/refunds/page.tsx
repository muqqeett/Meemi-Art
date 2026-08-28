import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import { ContentPage, ContentSection } from "@/components/layout/content-page";
import { LegalReviewNotice, LAST_UPDATED } from "@/components/layout/legal-review-notice";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: `How refunds and cancellations work for digital products bought from ${siteConfig.name}.`,
  alternates: { canonical: "/refunds" },
  openGraph: {
    title: `Refund & Cancellation Policy | ${siteConfig.name}`,
    description: `How refunds and cancellations work for digital products bought from ${siteConfig.name}.`,
    url: `${siteConfig.url}/refunds`,
  },
};

/**
 * Refund & Cancellation Policy.
 *
 * Replaces the old /shipping page, which promised a 30-day return of "unused"
 * goods with a prepaid label — a physical-goods policy that was never true of
 * this shop and directly contradicted the product pages.
 *
 * Everything stated here matches behaviour that exists in the code: a refund
 * issued in Paddle reaches the webhook, revokes DigitalAccess, and stops the
 * download working. Nothing promises a timescale the application cannot keep.
 */
export default function RefundsPage() {
  return (
    <>
      <div className="container-page max-w-3xl pt-8">
        <Breadcrumbs items={[{ label: "Refunds & Cancellations" }]} />
      </div>

      <ContentPage
        title="Refund & Cancellation Policy"
        intro={`Meemi Art sells digital products that are delivered immediately. That changes how refunds work, so this page sets out exactly where you stand. Last updated ${LAST_UPDATED}.`}
      >
        <LegalReviewNotice />

        <ContentSection title="Digital products, delivered immediately">
          <p>
            Everything sold here is a file. Nothing is manufactured, packed, posted or
            couriered, and there is no physical item to send back. As soon as your payment
            is confirmed, the file is available in your account and the purchase is
            complete.
          </p>
          <p>
            Because a downloaded file cannot be returned or un-received, digital purchases
            are <strong>not automatically refundable</strong> once the download has been
            made available to you.
          </p>
        </ContentSection>

        <ContentSection title="When we will refund">
          <p>We will refund in full where:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>the file is faulty, corrupted, or will not open in the format stated;</li>
            <li>
              the product is materially different from what its page described;
            </li>
            <li>
              you were charged more than once for the same order, or charged for an order
              you did not place;
            </li>
            <li>
              a technical fault on our side prevented you from downloading what you paid
              for and we cannot put it right.
            </li>
          </ul>
          <p>
            Tell us within <strong>14 days</strong> of your purchase and include your
            order number. Where the problem is something we can fix — a re-upload, a
            different format, a working link — we would rather fix it, and we will offer
            that first.
          </p>
        </ContentSection>

        <ContentSection title="When we usually will not refund">
          <p>We would normally decline a refund where:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>you have downloaded the file and simply changed your mind;</li>
            <li>
              you bought the wrong item by mistake, though it is still worth asking;
            </li>
            <li>
              your device or software cannot open a format that was clearly stated on the
              product page;
            </li>
            <li>the request is a duplicate of one already decided.</li>
          </ul>
          <p>
            None of this removes rights you have under the consumer law of your own
            country.
          </p>
        </ContentSection>

        <ContentSection title="Cancelling an order">
          <p>
            You can abandon a checkout at any point before you pay, and nothing is
            charged. An unpaid order simply stays unpaid, and your basket is left as it
            was so you can come back to it.
          </p>
          <p>
            Once payment is confirmed and the download is available, the order can no
            longer be cancelled — only refunded under the terms above.
          </p>
        </ContentSection>

        <ContentSection title="How to request a refund">
          <p>
            Email{" "}
            <a
              href={`mailto:${siteConfig.email}`}
              className="underline underline-offset-2"
            >
              {siteConfig.email}
            </a>{" "}
            from the address on the order, with:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>your order number, which is on your confirmation email;</li>
            <li>the product concerned;</li>
            <li>what went wrong.</li>
          </ul>
          <p>
            We aim to respond within a few working days. One person reads that mailbox, so
            a clear description gets you a faster answer.
          </p>
        </ContentSection>

        <ContentSection title="What happens when a refund is approved">
          <p>
            Refunds are issued through <strong>Paddle</strong>, the merchant of record for
            your purchase, back to the payment method you used. The time it takes to
            appear on your statement is set by your bank or card issuer, not by us.
          </p>
          <p>
            When a refund is processed, <strong>access to the file is withdrawn</strong>.
            The product stops working in{" "}
            <Link href="/account/downloads" className="underline underline-offset-2">
              My Downloads
            </Link>{" "}
            and the download link stops resolving. Your order history keeps the record of
            the purchase and the refund — we do not delete it.
          </p>
          <p>
            Continuing to use a file after being refunded for it is a breach of the{" "}
            <Link href="/terms" className="underline underline-offset-2">
              licence terms
            </Link>
            .
          </p>
        </ContentSection>

        <ContentSection title="Chargebacks">
          <p>
            If something has gone wrong, please contact us before raising a chargeback —
            it is almost always quicker. A chargeback on a downloaded file is treated the
            same way as a refund: access is withdrawn, and the account may be suspended.
          </p>
        </ContentSection>
      </ContentPage>
    </>
  );
}
