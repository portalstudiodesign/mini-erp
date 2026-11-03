import { NextResponse, type NextRequest } from "next/server";

// Verificare rapidă la margine: fără cookie de sesiune, nu are rost să randăm aplicația.
// Validarea reală a tokenului o face API-ul la fiecare request.
export function proxy(request: NextRequest) {
  if (request.cookies.has("token")) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|api|_next|favicon.ico).*)"],
};
