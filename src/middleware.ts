import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const role = session?.user?.role;

  const isMemberArea = pathname.startsWith("/app");
  const isAdminArea = pathname.startsWith("/admin");

  if ((isMemberArea || isAdminArea) && !session) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminArea && role !== "admin" && role !== "staff") {
    return NextResponse.redirect(new URL("/app", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
