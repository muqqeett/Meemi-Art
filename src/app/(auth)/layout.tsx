import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { PageTransition } from "@/components/motion/page-transition";
import { siteConfig } from "@/lib/config";

/**
 * Split auth layout: the form on the left, a full-bleed campaign image on the
 * right that drops away below `lg` so small screens get the form immediately.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-5 py-8 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-brand-600"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to shop
          </Link>
        </div>

        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <PageTransition>
            <div className="w-full max-w-md">{children}</div>
          </PageTransition>
        </main>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
      </div>

      <div className="relative hidden lg:block">
        <Image
          src="https://images.unsplash.com/photo-1516981879613-9f5da904015f?auto=format&fit=crop&w=1600&q=80"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
        <blockquote className="absolute right-12 bottom-14 left-12 text-white">
          <p className="font-display text-3xl leading-tight text-balance">
            Made by hand. Made to last.
          </p>
          <footer className="mt-3 text-sm text-white/70">
            — The {siteConfig.name} studio
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
