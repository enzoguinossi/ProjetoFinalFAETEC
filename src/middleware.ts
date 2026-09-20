import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SECRET = process.env.JWT_SECRET ?? "nexus-dev-secret-change-in-production";

const publicRoutes = [
  "/login",
  "/primeiro-acesso",
  "/definir-senha",
  "/_next/static/",
  "/_next/image/",
  "/favicon",
  "/icons/",
  "/logo.svg",
];

function isPublic(pathname: string): boolean {
  return publicRoutes.some((r) => pathname.startsWith(r));
}

function verifyToken(token: string): boolean {
  try {
    const jwt = new TextEncoder().encode(SECRET);
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    // Simple base64 decode + check expiry (enough for middleware)
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes and API routes
  if (isPublic(pathname) || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("nexus_token")?.value;

  if (!token || !verifyToken(token)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};