import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { legalNav, siteConfig } from "@/lib/config";

/**
 * Plum Studio footer — Figma "Footer" (15:412).
 *
 * Plum-900 band: brand block, three link columns, a contact column, and a
 * legal row. Rendered by the storefront layout on every route except the
 * homepage, which keeps the footer it was built with.
 *
 * Every link is a route that exists. The design's columns list Templates,
 * Printables, Bundles, Free downloads, Notion & templates, Selling digital and
 * Licences, none of which this shop has; they are omitted rather than shipped
 * as dead links. The design's newsletter form is replaced by the contact
 * address the earlier footer carried: there is no signup action wired to this
 * footer, and a form that submits nowhere would be a fake control.
 */

const SHOP = [
  { label: "Shop all", href: "/shop" },
  { label: "New in", href: "/shop?sort=newest" },
] as const;

const LEARN = [
  { label: "All guides", href: "/learn" },
  { label: "Abbreviations", href: "/resources/abbreviations" },
  { label: "Yarn weights", href: "/resources/yarn-weights" },
  { label: "Hook sizes", href: "/resources/hook-sizes" },
] as const;

const HELP = [
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
  { label: "Refunds", href: "/refunds" },
  { label: "About", href: "/about" },
] as const;

function Column({
  title,
  links,
}: {
  title: string;
  links: readonly { label: string; href: string }[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h2 className="font-figtree text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-on-dark">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="pl-focus font-figtree text-sm leading-[22px] text-plum-200 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlumFooter() {
  return (
    <footer className="mt-auto w-full bg-plum-900">
      <div className="mx-auto w-full max-w-[1280px] px-4 pt-10 pb-8 sm:px-6 lg:px-8 lg:pt-16 lg:pb-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[260px_repeat(3,150px)_1fr] lg:gap-8">
          <div className="flex flex-col items-start gap-3 sm:col-span-2 lg:col-span-1">
            <Logo focus="plum" tone="light" size="md" className="text-pl-on-dark" />
            <p className="font-figtree max-w-[260px] text-sm leading-[22px] text-plum-200">
              {siteConfig.tagline}. Made by hand, delivered as a download.
            </p>
          </div>

          <Column title="Shop" links={SHOP} />
          <Column title="Learn" links={LEARN} />
          <Column title="Help" links={HELP} />

          <div className="flex min-w-0 flex-col gap-3 sm:col-span-2 lg:col-span-1">
            <h2 className="font-figtree text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-on-dark">
              Stay up to date
            </h2>
            <p className="font-figtree text-sm leading-[22px] text-plum-200">
              Questions about a pattern or an order? Write to us.
            </p>
            <a
              href={`mailto:${siteConfig.email}`}
              className="pl-focus font-figtree w-fit text-sm leading-[22px] font-bold text-pl-on-dark underline-offset-4 hover:underline"
            >
              {siteConfig.email}
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-plum-800">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p className="font-figtree text-sm leading-[22px] text-plum-200">
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          {/* The policy row has to resolve from every page — a payment
              provider's review follows it first. */}
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {legalNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="pl-focus font-figtree text-sm leading-[22px] text-plum-200 transition-colors hover:text-white"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
