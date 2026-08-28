import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import { ContentPage, ContentSection } from "@/components/layout/content-page";
import { LegalReviewNotice, LAST_UPDATED } from "@/components/layout/legal-review-notice";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `What ${siteConfig.name} collects, why, and who processes it.`,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: `Privacy Policy | ${siteConfig.name}`,
    description: `What ${siteConfig.name} collects, why, and who processes it.`,
    url: `${siteConfig.url}/privacy`,
  },
};

/**
 * Privacy Policy.
 *
 * Rewritten against what the application actually stores and which services it
 * actually calls. The previous version described a physical shop — delivery
 * addresses, carriers, delivery updates, marketing email — and opened by
 * calling itself a template for a demonstration store. None of that was true.
 *
 * Two accuracy points worth keeping right as the code changes: there is no
 * third-party analytics or advertising tracker anywhere in this project, and
 * there is currently no marketing email, because the signup form was removed
 * and no subscriber table exists. Both claims are checkable, and both must be
 * revisited if either changes.
 */
export default function PrivacyPage() {
  return (
    <>
      <div className="container-page max-w-3xl pt-8">
        <Breadcrumbs items={[{ label: "Privacy Policy" }]} />
      </div>

      <ContentPage
        title="Privacy Policy"
        intro={`What we collect, why we collect it, who else handles it, and what you can ask us to do with it. Last updated ${LAST_UPDATED}.`}
      >
        <LegalReviewNotice />

        <ContentSection title="What we collect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Account details</strong> — your name, email address and, if you
              choose to give one, a phone number. Passwords are stored only as a bcrypt
              hash and cannot be read back by us or by anyone else.
            </li>
            <li>
              <strong>Order details</strong> — the products you bought, the price, the
              currency, the name and email you gave at checkout, any note you added, and
              the outcome of the payment. <strong>No delivery address is collected</strong>
              , because nothing is posted to you.
            </li>
            <li>
              <strong>Payment references</strong> — the payment provider&rsquo;s own
              identifiers for the transaction and for you as their customer, plus the card
              brand and last four digits so you can recognise the payment. We never
              receive or store a full card number.
            </li>
            <li>
              <strong>Download records</strong> — which files your account has access to,
              how many times each has been downloaded and when it was last downloaded.
              This is what makes the download work and how misuse is spotted.
            </li>
            <li>
              <strong>Content you write</strong> — reviews, wishlist items and the contents
              of your basket.
            </li>
            <li>
              <strong>Email records</strong> — a log of the transactional emails we sent
              you and whether sending succeeded.
            </li>
            <li>
              <strong>Cookies</strong> — a sign-in session cookie, a basket cookie so your
              bag survives a refresh, and a cookie holding an applied discount code. All
              are strictly necessary for the shop to function.
            </li>
          </ul>
        </ContentSection>

        <ContentSection title="What we do not do">
          <p>
            There is no third-party analytics, advertising or tracking script on this site.
            We do not profile you, we do not build an advertising audience, and we do not
            sell or rent personal data to anyone.
          </p>
          <p>
            We do not currently send marketing email. If that changes, it will be
            opt-in and this policy will be updated first.
          </p>
        </ContentSection>

        <ContentSection title="Why we use it">
          <p>
            To create and secure your account, to take payment, to give you access to the
            files you bought, to send the transactional email that goes with an order —
            confirmation, verification, password reset — and to answer you when you get in
            touch.
          </p>
          <p>
            Order and payment records are also kept because we are required to keep
            records of sales.
          </p>
        </ContentSection>

        <ContentSection title="Who else handles your data">
          <p>Only the services needed to run the shop:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Paddle</strong> — payments. Paddle is the merchant of record for
              your purchase, which means it is the seller on the transaction and handles
              the card details, the tax and the refund. It has its own privacy policy,
              and your card data is given to Paddle, never to us.
            </li>
            <li>
              <strong>Resend</strong> — sends transactional email on our behalf.
            </li>
            <li>
              <strong>Cloudinary</strong> — stores product images and the purchasable
              files themselves. Purchased files are stored privately and reached only
              through a link that expires within minutes.
            </li>
            <li>
              <strong>Our hosting and database providers</strong> — which store the data
              described above.
            </li>
          </ul>
          <p className="text-warning">
            The specific hosting and database providers, and the countries your data is
            stored in, need to be named here by the business owner before this policy is
            complete.
          </p>
        </ContentSection>

        <ContentSection title="How long we keep it">
          <p>
            Order, payment and refund records are kept for as long as tax and accounting
            rules require — including for orders that were refunded, because deleting the
            record of a refund would remove the evidence that it happened.
          </p>
          <p>
            Account data is kept until you ask us to close your account. Verification and
            password-reset tokens are short-lived and expire on their own. Basket and
            discount cookies expire within thirty days.
          </p>
        </ContentSection>

        <ContentSection title="Your rights">
          <p>
            You can ask for a copy of your data, ask us to correct it, or ask us to close
            your account and delete it. Email{" "}
            <a
              href={`mailto:${siteConfig.email}`}
              className="underline underline-offset-2"
            >
              {siteConfig.email}
            </a>{" "}
            and we will respond within thirty days.
          </p>
          <p>
            Closing your account ends your access to files you bought, so download
            anything you want to keep first. Where we are required to retain a sales
            record, that record is kept even after an account is closed.
          </p>
          <p className="text-warning">
            Depending on where you live you may have further rights, and a right to
            complain to a supervisory authority. Which authority applies depends on where
            the business is established — see the notice at the top of this page.
          </p>
        </ContentSection>

        <ContentSection title="Security">
          <p>
            Traffic is served over HTTPS. Passwords are hashed with bcrypt. Purchased
            files are stored privately and are only ever served through a short-lived
            signed link, after we have checked that your signed-in account actually paid
            for that product. Payment confirmations are accepted only when they carry a
            valid cryptographic signature from the payment provider.
          </p>
          <p>
            Access to order and customer data is restricted to administrator accounts, and
            that check is re-run on every request rather than trusted from a previous one.
          </p>
        </ContentSection>

        <ContentSection title="Contact">
          <p>
            Questions about this policy, or about your data, go to{" "}
            <a
              href={`mailto:${siteConfig.email}`}
              className="underline underline-offset-2"
            >
              {siteConfig.email}
            </a>{" "}
            or through the{" "}
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
