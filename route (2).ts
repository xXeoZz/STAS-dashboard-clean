import { NextRequest, NextResponse } from "next/server";
import { consumeWithingsOAuthState, exchangeWithingsCode } from "@/lib/providers/withings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/?withings=denied", req.url));
  }

  if (!code || !state || !(await consumeWithingsOAuthState(state))) {
    return NextResponse.json({
      ok: false,
      message: "Invalid or expired Withings OAuth state."
    }, { status: 400 });
  }

  const redirectUri = process.env.WITHINGS_REDIRECT_URI || `${req.nextUrl.origin}/api/withings/callback`;

  try {
    await exchangeWithingsCode(code, redirectUri);
    return NextResponse.redirect(new URL("/?withings=connected", req.url));
  } catch (e) {
    return NextResponse.json({
      ok: false,
      message: e instanceof Error ? e.message : "Withings connection failed"
    }, { status: 502 });
  }
}
