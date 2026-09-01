import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, HelpCircle, RotateCcw } from "lucide-react";

import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with ${siteConfig.name} about an order, a download or anything else.`,
  alternates: { canonical: "/contact" },
  openGraph: {
    title: `Contact | ${siteConfig.name}`,
    description: `Get in touch with ${siteConfig.name}.`,
    url: `${siteConfig.url}/contact`,
    images: [siteConfig.ogImage],
  },
};

/**
 * Contact.
 *
 * One mailbox, stated plainly, because one mailbox is what the business has —
 * see lib/email/config.ts. No phone number, no postal address and no support
 * hours are published here: none of them exist in this project, and a contact
 * page that invents them is worse than one that does not.
 *
 * The shortcuts point at pages that answer the questions this shop actually
 * generates. They previously pointed at order tracking, shipping and a size
 * guide — none of which apply to a file you download.
 */
const SHORTCUTS = [
  {
    href: "/account/downloads",
    title: "Find your downloads",
    description: "Everything you have bought, ready to download again.",
    Icon: Download,
  },
  {
    href: "/refunds",
    title: "Refunds & cancellations",
    description: "How refunds work for digital products.",
    Icon: RotateCcw,
  },
  {
    href: "/terms",
    title: "Terms & licence",
    description: "What you may do with a file you have bought.",
    Icon: FileText,
  },
  {
    href: "/faq",
    title: "Read the FAQ",
    description: "Ordering, downloading, formats and payment.",
    Icon: HelpCircle,
  },
] as const;

export default function ContactPage() {
  return (
    <>
      <div className="container-page pt-8">
        <Breadcrumbs items={[{ label: "Contact" }]} />
      </div>

      <div className="container-page pt-10 pb-20 lg:pt-14 lg:pb-28">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
          <div>
            <h1 className="heading-section">Get in touch</h1>
            <p className="text-body mt-4 max-w-md">
              Questions about an order, a download that will not open, or a refund — one
              person reads this mailbox and answers everything personally.
            </p>

            <div className="mt-10 border-t border-border pt-6">
              <h2 className="label-caps text-muted-foreground">Email</h2>
              <a
                href={`mailto:${siteConfig.email}`}
                className="font-display mt-2 block text-xl text-ink underline-offset-4 hover:underline"
              >
                {siteConfig.email}
              </a>
              <p className="text-body mt-2">
                Include your order number if you have one — it is on your confirmation
                email, and it makes everything faster.
              </p>
            </div>

            <div className="mt-8 border-t border-border pt-6">
              <h2 className="label-caps text-muted-foreground">A problem with a file</h2>
              <p className="text-body mt-2">
                If a download will not open or looks wrong, tell us the product and what
                you are opening it with. We would rather send you a working file than
                process a refund, and we will offer that first — see the{" "}
                <Link href="/refunds" className="underline underline-offset-2">
                  refund policy
                </Link>
                .
              </p>
            </div>
          </div>

          <div>
            <h2 className="label-caps text-muted-foreground">Answers, faster</h2>
            <ul className="mt-4 grid gap-px overflow-hidden border border-border bg-border">
              {SHORTCUTS.map(({ href, title, description, Icon }) => (
                <li key={href} className="bg-surface">
                  <Link
                    href={href}
                    className="flex items-start gap-4 p-6 transition-colors hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500"
                  >
                    <Icon className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden />
                    <span>
                      <span className="block font-medium text-ink">{title}</span>
                      <span className="text-body mt-0.5 block">{description}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
