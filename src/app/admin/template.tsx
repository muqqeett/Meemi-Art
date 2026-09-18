import type { ReactNode } from "react";

/**
 * Admin page entrance.
 *
 * A template, not part of the layout, because a template remounts on every
 * navigation — so each admin page plays its short settle once when it is
 * opened, while the sidebar and header (in the layout) stay put.
 *
 * The wrapper is a plain block element with no styling of its own beyond the
 * `admin-page` hook; the animation lives in the admin motion section of
 * `globals.css`, runs on transform and opacity only, and leaves nothing
 * behind once it has finished.
 */
export default function AdminTemplate({ children }: { children: ReactNode }) {
  return <div className="admin-page">{children}</div>;
}
