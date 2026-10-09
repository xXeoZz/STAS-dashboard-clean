import { NextResponse } from "next/server";
import { clearWithingsToken } from "@/lib/providers/withings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  await clearWithingsToken();
  return NextResponse.json({ ok: true });
}
