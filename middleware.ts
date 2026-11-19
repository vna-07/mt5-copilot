import { NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/login", "/api/auth", "/sw.js", "/manifest.webmanifest", "/icon.svg"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Allow public files and Next.js internals
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/")) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Verify cookie
  const token = req.cookies.get("copilot_session")?.value;
  const expected = process.env.APP_SESSION_SECRET;

  if (!token || !expected || token !== expected) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next();
}