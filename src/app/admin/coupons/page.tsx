import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CouponManager, type AdminCoupon } from "@/components/admin/coupon-manager";
import { listAdminCoupons } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  const coupons = await listAdminCoupons();

  return (
    <div>
      <AdminPageHeader
        title="Coupons"
        description="Percentage and fixed discounts, with expiry, minimum spend and usage limits."
      />
      <CouponManager coupons={coupons as AdminCoupon[]} />
    </div>
  );
}
