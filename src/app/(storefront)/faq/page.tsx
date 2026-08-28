import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "FAQ",
  description: `Answers about ordering, downloads, payment and refunds at ${siteConfig.name}.`,
  alternates: { canonical: "/faq" },
  openGraph: {
    title: `FAQ | ${siteConfig.name}`,
    description: `Common questions about buying digital products from ${siteConfig.name}.`,
    url: `${siteConfig.url}/faq`,
  },
};

/**
 * Every answer here describes something the application actually does.
 *
 * The previous set answered a physical shop — shipping timings, free-shipping
 * thresholds, international delivery, washing instructions, returning an
 * unused item within 30 days. None of that is true of a downloadable file, and
 * the returns answer directly contradicted the product pages.
 */
const FAQS = [
  {
    q: "What exactly am I buying?",
    a: "A digital product: a file you download. Nothing physical is made, packed or posted, and no delivery address is ever collected. Each product page states the file format and size before you buy.",
  },
  {
    q: "How long will my order take?",
    a: "Delivery is immediate. As soon as your payment is confirmed the file appears under My Downloads in your account, and a confirmation email is sent to the address on the order.",
  },
  {
    q: "Where do I find what I have bought?",
    a: "Sign in and go to My Downloads. Everything you have ever bought is listed there, and you can download it again whenever you need to — a purchase is not a one-time link.",
  },
  {
    q: "My download link stopped working.",
    a: "That is expected. Links are generated fresh each time you click and expire after a few minutes, so a link cannot be usefully forwarded or shared. Go back to My Downloads and click again for a new one.",
  },
  {
    q: "Who takes the payment?",
    a: "Paddle, which acts as the merchant of record for your purchase. It handles the card details, calculates and remits any sales tax or VAT due in your country, and appears on your statement. We never see or store your card number.",
  },
  {
    q: "Why is the total higher than the listed price?",
    a: "Listed prices exclude sales tax. Paddle adds whatever tax applies where you are at its checkout, so the amount shown there is the amount you pay.",
  },
  {
    q: "Can I get a refund?",
    a: "Because files are delivered immediately and cannot be returned, digital purchases are not automatically refundable. We will refund a file that is faulty, will not open, or is materially different from its description — see the refund policy for the full position, and get in touch either way.",
  },
  {
    q: "What am I allowed to do with a file I have bought?",
    a: "You are buying a licence to use it, not the work itself. You may download it, keep it on your own devices and print it for your own use. You may not resell, redistribute, share or republish it. Commercial use is not covered — ask us first.",
  },
  {
    q: "How do I use a discount code?",
    a: "Enter it in the coupon box in your bag or at checkout and press Apply. Codes are checked against their expiry, usage limit and minimum spend, and only one can be applied per order.",
  },
  {
    q: "Do I need an account?",
    a: "Yes. A download has to be authorised against someone, so purchases are tied to an account rather than to a link that anyone holding it could use.",
  },
] as const;

export default function FaqPage() {
  return (
    <div className="container-page py-10 lg:py-14">
      <Breadcrumbs items={[{ label: "FAQ" }]} />

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <header className="lg:sticky lg:top-28 lg:self-start">
          <h1 className="heading-section">Questions</h1>
          <p className="text-body mt-3 max-w-sm">
            Ordering, downloads, payment and refunds. Anything else — email{" "}
            <a
              href={`mailto:${siteConfig.email}`}
              className="text-brand-600 underline underline-offset-2"
            >
              {siteConfig.email}
            </a>
            .
          </p>
        </header>

        <Accordion>
          {FAQS.map((faq) => (
            <AccordionItem key={faq.q} value={faq.q}>
              <AccordionTrigger>{faq.q}</AccordionTrigger>
              <AccordionContent>
                <p className="text-body">{faq.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
