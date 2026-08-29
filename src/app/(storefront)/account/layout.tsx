import { AccountNav } from "@/components/account/account-nav";
import { requireUser } from "@/lib/auth-guards";

/**
 * Every page under `/account` is behind this guard. The proxy also bounces
 * signed-out visitors, but authorization is enforced here, server-side.
 */
export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const user = await requireUser("/account");

  return (
    <div className="container-page py-8 lg:py-12">
      <header className="mb-8">
        <h1 className="heading-section">My account</h1>
        <p className="text-body mt-1">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-12">
        {/* min-w-0 because a grid item's automatic minimum is its min-content
            width: the nav below is a horizontal scroller of shrink-0 pills, so
            without this the track grows to ~704px and every account page
            scrolls sideways on a phone. */}
        <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <AccountNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
