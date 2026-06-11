import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfigBase } from "@/lib/auth/base";

// Next.js 16: middleware was renamed to `proxy` and defaults to the Node.js
// runtime. We use a db-free Auth.js instance here (authConfigBase has no
// providers) so the JWT is decoded without importing the DB/argon2 layer.
const { auth } = NextAuth(authConfigBase);

const PUBLIC_PATHS = ["/login", "/invite"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  // Public auth pages — always allow.
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Require a session for everything else.
  if (!isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Admin-only areas.
  if (pathname.startsWith("/admin") || pathname.startsWith("/trash")) {
    if (req.auth?.user?.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/gallery";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except API routes (they self-guard), static assets, and
  // image optimizer. API mutation handlers call requireAdmin()/auth() directly.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
