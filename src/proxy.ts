import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const ISSUER = "nexus";
const AUDIENCE = "nexus-web";

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

async function verifyToken(token: string): Promise<boolean> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes and API routes
  if (isPublic(pathname) || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("nexus_token")?.value;

  if (!token || !(await verifyToken(token))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
