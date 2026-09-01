import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FolderTree,
  Users,
  CreditCard,
  RotateCcw,
  RefreshCw,
  MessageSquare,
  FileDown,
  PackageCheck,
  Ticket,
  Mail,
  ChartColumn,
  TrendingUp,
  Settings,
  History,
  type LucideIcon,
} from "lucide-react";

/**
 * The admin's information architecture.
 *
 * Grouped rather than flat: nine peers in one list made "Settings" look as
 * important as "Orders". The groups are the questions an operator actually
 * arrives with — what sold, what was paid, what needs moderating — not a
 * taxonomy of database tables.
 *
 * Only routes that exist are listed. Nothing here links to a page that has not
 * been built; a sidebar entry leading to a 404 is worse than a missing one.
 */
export type AdminNavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Match only this exact path — for index routes that would prefix-match. */
  exact?: boolean;
};

export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Home",
    items: [
      { href: "/admin", label: "Overview", Icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", Icon: ShoppingCart },
      { href: "/admin/products", label: "Products", Icon: Package },
      { href: "/admin/products/performance", label: "Performance", Icon: TrendingUp },
      { href: "/admin/categories", label: "Categories", Icon: FolderTree },
      { href: "/admin/customers", label: "Customers", Icon: Users },
    ],
  },
  {
    label: "Payments",
    items: [
      { href: "/admin/payments", label: "Payments", Icon: CreditCard, exact: true },
      { href: "/admin/payments/refunds", label: "Refunds", Icon: RotateCcw },
      { href: "/admin/payments/reconcile", label: "Reconciliation", Icon: RefreshCw },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/reviews", label: "Reviews", Icon: MessageSquare },
      { href: "/admin/files", label: "Digital Files", Icon: FileDown },
      { href: "/admin/delivery", label: "Delivery Health", Icon: PackageCheck },
    ],
  },
  {
    label: "Marketing",
    items: [{ href: "/admin/coupons", label: "Coupons", Icon: Ticket }],
  },
  {
    label: "Communications",
    items: [{ href: "/admin/emails", label: "Email Center", Icon: Mail }],
  },
  {
    label: "Insights",
    items: [{ href: "/admin/analytics", label: "Analytics", Icon: ChartColumn }],
  },
  {
    label: "System",
    items: [
      { href: "/admin/activity", label: "Activity", Icon: History },
      { href: "/admin/settings", label: "Settings", Icon: Settings },
    ],
  },
];

/** Flat list, for the command palette and breadcrumb lookups. */
export const ADMIN_NAV_FLAT: AdminNavItem[] = ADMIN_NAV.flatMap((g) => g.items);

/**
 * Whether a nav item is the current route. Shared by the sidebar and the
 * breadcrumbs so they can never disagree about where the reader is.
 */
export function isActiveRoute(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
