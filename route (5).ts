import { NextRequest, NextResponse } from "next/server";
import { fetchWithingsWellness } from "@/lib/providers/withings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function localDate(timeZone = process.env.DASHBOARD_TIMEZONE || "Europe/Copenhagen") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function daysBefore(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const today = localDate();
  const days = Math.max(7, Math.min(Number(req.nextUrl.searchParams.get("days") || 90), 365));
  const result = await fetchWithingsWellness(daysBefore(today, days), today);

  const rows = result.wellness || [];
  const weightRows = rows.filter(r => typeof r.weightKg === "number" && Number.isFinite(r.weightKg));
  const compositionRows = rows.filter(r =>
    [r.bodyFatPct, r.fatMassKg, r.muscleMassKg, r.boneMassKg, r.hydrationKg]
      .some(v => typeof v === "number" && Number.isFinite(v))
  );

  return NextResponse.json({
    status: result.status,
    error: result.error || null,
    rows: rows.length,
    weightRows: weightRows.length,
    compositionRows: compositionRows.length,
    firstDate: rows[0]?.date || null,
    lastDate: rows.at(-1)?.date || null,
    latestWeightDate: weightRows.at(-1)?.date || null,
    latestWeightMapped: weightRows.length > 0
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
