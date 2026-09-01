import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import { ContentPage, ContentSection } from "@/components/layout/content-page";
import { LAST_UPDATED } from "@/lib/legal";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `The terms that apply when you buy a digital product from ${siteConfig.name}.`,
  alternates: { canonical: "/terms" },
  openGraph: {
    title: `Terms & Conditions | ${siteConfig.name}`,
    description: `The terms that apply when you buy a digital product from ${siteConfig.name}.`,
    url: `${siteConfig.url}/terms`,
    images: [siteConfig.ogImage],
  },
};

/**
 * Terms & Conditions.
 *
 * Written from what this application actually does — accounts, a cart, a
 * Paddle checkout, a signed webhook, a licence to download a file — and
 * nothing else. There is no company registration number, registered office,
 * VAT number, governing-law clause or dispute-resolution venue here, because
 * none of those exist anywhere in the project and inventing them would be
 * worse than omitting them. Those gaps are named explicitly in the review
 * notice so the owner can fill them in.
 */
export default function TermsPage() {
  return (
    <>
      <div className="container-page max-w-3xl pt-8">
        <Breadcrumbs items={[{ label: "Terms & Conditions" }]} />
      </div>

      <ContentPage
        title="Terms & Conditions"
        intro={`These terms apply to every purchase made through ${siteConfig.name}. Last updated ${LAST_UPDATED}.`}
      >

        <ContentSection title="1. What we sell">
          <p>
            {siteConfig.name} sells <strong>digital products only</strong>. Every item in
            this shop is a file you download after paying — there is no physical item,
            nothing is posted or couriered to you, and no delivery address is collected
            at any point.
          </p>
          <p>
            Each product page states the file format and size before you buy. If a
            product does not have a file attached to it, it cannot be bought.
          </p>
        </ContentSection>

        <ContentSection title="2. Your account">
          <p>
            You need an account to buy, because a download has to be authorised against
            someone. You are responsible for keeping your password confidential and for
            activity that happens under your account.
          </p>
          <p>
            Give an email address you can actually receive mail at. Your receipt and your
            download link both depend on it.
          </p>
        </ContentSection>

        <ContentSection title="3. Prices and payment">
          <p>
            Prices are shown in {process.env.PAYMENT_CURRENCY ?? "USD"} and are exclusive
            of sales tax. Payments are processed by <strong>Paddle</strong>, which acts as
            the merchant of record for your purchase. That means Paddle — not{" "}
            {siteConfig.name} — is the seller on the transaction, and Paddle calculates,
            collects and remits any sales tax or VAT due in your country. The total you
            are shown at Paddle&rsquo;s checkout is the amount you pay.
          </p>
          <p>
            Paddle&rsquo;s own terms also apply to the payment itself. We never see or
            store your card details.
          </p>
          <p>
            An order is only complete once Paddle confirms the payment to us. Reaching a
            confirmation page is not by itself proof of payment, and access is granted
            only after that confirmation arrives.
          </p>
        </ContentSection>

        <ContentSection title="4. Delivery of digital products">
          <p>
            Delivery is electronic and immediate. Once your payment is confirmed, the
            product appears under{" "}
            <Link href="/account/downloads" className="underline underline-offset-2">
              My Downloads
            </Link>{" "}
            in your account, and a confirmation email is sent to the address on the order.
          </p>
          <p>
            Download links are generated fresh each time you click and expire after a few
            minutes, so a link cannot be usefully forwarded. You can return to your
            account and download the file again whenever you need it, for as long as your
            access remains valid.
          </p>
          <p>
            You are responsible for having a device and software capable of opening the
            format stated on the product page.
          </p>
        </ContentSection>

        <ContentSection title="5. Licence and permitted use">
          <p>
            When you buy a digital product you are buying a licence to use it, not
            ownership of the work itself. Unless a product page says otherwise, you may:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>download the file for your own personal use;</li>
            <li>keep a copy on your own devices and print it for your own use.</li>
          </ul>
          <p>You may not:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              resell, redistribute, share, upload or publish the file, in whole or in
              part;
            </li>
            <li>pass on your download link or your account credentials;</li>
            <li>
              claim the work as your own, or remove any attribution contained in it.
            </li>
          </ul>
          <p>
            Copyright in every product remains with {siteConfig.name} or its licensors.
          </p>
          <p className="text-warning">
            Commercial use — for example, selling items made from a purchased pattern —
            is <strong>not covered by these terms</strong> and needs the owner&rsquo;s
            decision before it can be stated here.
          </p>
        </ContentSection>

        <ContentSection title="6. Refunds and cancellation">
          <p>
            Because products are delivered immediately and cannot be returned, refunds
            are handled case by case. The full position is set out in our{" "}
            <Link href="/refunds" className="underline underline-offset-2">
              Refund &amp; Cancellation Policy
            </Link>
            , which forms part of these terms.
          </p>
        </ContentSection>

        <ContentSection title="7. Availability and changes">
          <p>
            We may add, change, re-price or withdraw products at any time. A change never
            affects an order you have already paid for.
          </p>
          <p>
            We aim to keep the shop available, but we do not guarantee uninterrupted
            access — the site depends on third-party hosting, payment and storage
            services.
          </p>
        </ContentSection>

        <ContentSection title="8. Suspension">
          <p>
            We may suspend or close an account that shares purchased files, attempts to
            access downloads it has not paid for, or charges back a payment for a file it
            has already downloaded. Where access is revoked, your order history is kept —
            we do not delete the record of what happened.
          </p>
        </ContentSection>

        <ContentSection title="9. Liability">
          <p>
            Digital products are supplied as they are. We do not promise that a product
            will meet a particular purpose beyond what its own page describes.
          </p>
          <p className="text-warning">
            A limitation-of-liability clause and a governing-law and jurisdiction clause
            belong here. Both depend on where the business is legally established, which
            is not recorded anywhere in this project — see the notice at the top of this
            page.
          </p>
        </ContentSection>

        <ContentSection title="10. Contact">
          <p>
            Questions about these terms go to{" "}
            <a
              href={`mailto:${siteConfig.email}`}
              className="underline underline-offset-2"
            >
              {siteConfig.email}
            </a>
            , or through the{" "}
            <Link href="/contact" className="underline underline-offset-2">
              contact page
            </Link>
            .
          </p>
        </ContentSection>
      </ContentPage>
    </>
  );
}
