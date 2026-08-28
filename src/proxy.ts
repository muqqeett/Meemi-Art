import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic route gating only.
 *
 * Next.js explicitly warns against treating proxy as an authorization layer, so
 * this file does nothing more than bounce obviously-signed-out visitors away
 * from private routes to save a wasted render. Every protected page, server
 * action and route handler independently re-checks the session and role via
 * `requireUser` / `requireAdmin` in `src/lib/auth-guards.ts`, which is where
 * authorization is actually enforced.
 */

// `/checkout` is deliberately absent: guest checkout is supported, and the page
// itself offers sign-in rather than requiring it.
const PROTECTED_PREFIXES = ["/account", "/admin"];
const AUTH_PAGES = ["/login", "/register"];

/** Auth.js session cookie names, http and https variants. */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = hasSessionCookie(request);

  if (!signedIn && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (signedIn && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/login", "/register"],
};
