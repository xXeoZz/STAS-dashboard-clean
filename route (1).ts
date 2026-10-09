import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.INTERVALS_BASE_URL || "https://intervals.icu/api/v1";
  const configured = process.env.INTERVALS_ATHLETE_ID || "i149757";
  const ids = [...new Set([configured, "i149757", "0"])];
  const key = process.env.INTERVALS_API_KEY;

  if (!key) {
    return NextResponse.json({
      ok: false,
      keyPresent: false,
      configuredAthleteId: configured,
      message: "INTERVALS_API_KEY is missing from this deployment."
    }, { status: 500 });
  }

  const auth = "Basic " + Buffer.from(`API_KEY:${key}`).toString("base64");
  const results: Array<Record<string, unknown>> = [];

  for (const id of ids) {
    const path = `/athlete/${encodeURIComponent(id)}`;

    try {
      const res = await fetch(`${base}${path}`, {
        headers: { Authorization: auth, Accept: "application/json" },
        cache: "no-store"
      });

      const text = await res.text();

      results.push({
        athleteId: id,
        status: res.status,
        ok: res.ok,
        responsePreview: res.ok ? "Authenticated successfully." : text.slice(0, 180)
      });

      if (res.ok) break;
      if (res.status === 401 || res.status === 403) break;
    } catch (e) {
      results.push({
        athleteId: id,
        status: null,
        ok: false,
        responsePreview: e instanceof Error ? e.message : "Network error"
      });
    }
  }

  const ok = results.some(r => r.ok === true);

  return NextResponse.json({
    ok,
    keyPresent: true,
    keyLength: key.length,
    configuredAthleteId: configured,
    baseUrl: base,
    results,
    nextStep: ok
      ? "Intervals authentication works. Open /api/dashboard?days=30 next."
      : "401/403 means key/auth; 404 usually means athlete id/path."
  }, {
    status: ok ? 200 : 502,
    headers: { "Cache-Control": "no-store" }
  });
}
