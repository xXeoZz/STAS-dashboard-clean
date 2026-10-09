import type { GarminNormalizedResponse, WellnessDay } from "@/lib/types";

export async function fetchOptionalGarminNormalized(): Promise<GarminNormalizedResponse | null> {
  const url = process.env.GARMIN_NORMALIZED_HEALTH_URL;
  if (!url) return null;

  const token = process.env.GARMIN_NORMALIZED_HEALTH_BEARER_TOKEN;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    cache: "no-store"
  });

  if (!res.ok) throw new Error(`Garmin normalized provider failed (${res.status})`);
  return await res.json() as GarminNormalizedResponse;
}

export function mergeWellness(intervals: WellnessDay[], garmin: WellnessDay[] = []): WellnessDay[] {
  const byDate = new Map<string, WellnessDay>();
  for (const row of intervals) byDate.set(row.date, row);

  for (const row of garmin) {
    const base = byDate.get(row.date) || { date: row.date };
    byDate.set(row.date, {
      ...base,
      ...Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined)),
      raw: { ...(base.raw || {}), garmin: row.raw || row },
      source: base.source ? `${base.source} + Garmin` : "Garmin"
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
