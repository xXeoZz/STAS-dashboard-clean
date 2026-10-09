import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // Withings must be able to return from OAuth without browser Basic Auth.
  if (req.nextUrl.pathname === "/api/withings/callback") {
    return NextResponse.next();
  }

  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;

  if (!user || !pass) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Dashboard authentication is not configured.", { status: 503 });
    }
    return NextResponse.next();
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      if (sep >= 0) {
        const suppliedUser = decoded.slice(0, sep);
        const suppliedPass = decoded.slice(sep + 1);
        if (suppliedUser === user && suppliedPass === pass) {
          return NextResponse.next();
        }
      }
    } catch {}
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="STAS Training Dashboard"' }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
