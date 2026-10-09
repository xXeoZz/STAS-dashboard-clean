import { NextRequest, NextResponse } from "next/server";
import { buildDashboard } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const days = Number(req.nextUrl.searchParams.get("days") || 90);
    const data = await buildDashboard(days);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown dashboard error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
