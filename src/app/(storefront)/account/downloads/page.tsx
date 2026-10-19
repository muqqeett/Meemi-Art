import type { Metadata } from "next";
import { FileDown } from "lucide-react";

import { requireUser } from "@/lib/auth-guards";
import { getDownloadsForUser } from "@/lib/queries/downloads";
import { getReviewEligibility } from "@/lib/queries/reviews";
import { EmptyState } from "@/components/brand/empty-state";
import { PlumButtonLink } from "@/components/ui/plum-button";
import { DownloadList } from "@/components/account/download-list";

export const metadata: Metadata = {
  title: "Downloads",
  robots: { index: false, follow: false },
};

/**
 * The customer's purchased files.
 *
 * Every row here corresponds to a `DigitalAccess` grant, which only the
 * payment webhook can create — so anything listed has been paid for. A
 * refunded purchase is still listed, greyed out with its reason, rather than
 * vanishing: a customer who was refunded should be able to see that happened.
 *
 * The download button is a plain link to a route handler. It carries only the
 * product id; the authorisation is done server-side from the session.
 */
export default async function DownloadsPage() {
  const user = await requireUser("/account/downloads");
  const downloads = await getDownloadsForUser(user.id);

  /**
   * Which of these the customer may review, and what they have already
   * written. A `DigitalAccess` grant is not itself proof of a reviewable
   * purchase — a refund revokes access but leaves the row — so eligibility is
   * asked of the orders, exactly as everywhere else.
   */
  const reviewable = await getReviewEligibility(
    user.id,
    downloads.map((entry) => entry.productId),
  );

  return (
    <div className="font-figtree">
      {/* Plum Studio "Library" (28:3320): a title and lead, then one white
          20px-radius card holding a divided row per file. The design's
          Patterns / Templates filter is not drawn — it filters by product
          type, which the shop does not have. */}
      <header className="mb-6">
        <h1 className="pl-display pl-h2">Downloads</h1>
        <p className="mt-1 text-base leading-[26px] text-pl-muted">
          Everything you have bought. Files stay here — come back to them any time.
        </p>
      </header>

      {downloads.length === 0 ? (
        <EmptyState
          tone="plum"
          icon={FileDown}
          title="No downloads yet"
          description="Once you buy something, your files appear here straight after payment."
          action={
            <PlumButtonLink href="/shop" style="primary">
              Browse the shop
            </PlumButtonLink>
          }
        />
      ) : (
        <DownloadList downloads={downloads} reviewable={reviewable} />
      )}
    </div>
  );
}
