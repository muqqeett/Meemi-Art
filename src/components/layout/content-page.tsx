import type { ReactNode } from "react";

/**
 * Shared shell for editorial pages (about, FAQ, policies). Keeps a readable
 * measure and the same heading rhythm as the rest of the storefront.
 */
export function ContentPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="container-page max-w-3xl py-12 lg:py-16">
      <header className="mb-10">
        <h1 className="heading-section">{title}</h1>
        {intro && <p className="text-body mt-3 text-base">{intro}</p>}
      </header>

      <div className="space-y-8">{children}</div>
    </div>
  );
}

export function ContentSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="text-body mt-2 space-y-3">{children}</div>
    </section>
  );
}
