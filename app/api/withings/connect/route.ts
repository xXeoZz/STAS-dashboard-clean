import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { setWithingsOAuthState } from "@/lib/providers/withings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = process.env.WITHINGS_CLIENT_ID;
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET;
  const cookieSecret = process.env.WITHINGS_COOKIE_SECRET;

  if (!clientId || !clientSecret || !cookieSecret) {
    return NextResponse.json({
      ok: false,
      message: "Withings is not configured. Add WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET and WITHINGS_COOKIE_SECRET in Vercel first."
    }, { status: 500 });
  }

  const state = crypto.randomUUID();
  await setWithingsOAuthState(state);

  const redirectUri = process.env.WITHINGS_REDIRECT_URI || `${req.nextUrl.origin}/api/withings/callback`;

  const url = new URL("https://account.withings.com/oauth2_user/authorize2");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "user.metrics");
  url.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(url);
}
