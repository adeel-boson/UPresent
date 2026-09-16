import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export default auth((request) => {
  const isLoggedIn = Boolean(request.auth?.user);
  const isOnLogin = request.nextUrl.pathname === "/login";

  if (!isLoggedIn && !isOnLogin) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  if (isLoggedIn && isOnLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
