import type { DashboardData, Scalar, WellnessDay } from "@/lib/types";
import { avg, daysAgo, inLastDays, isoDate, sum } from "@/lib/util";
import {
  fetchIntervalsActivities,
  fetchIntervalsAthlete,
  fetchIntervalsEvents,
  fetchIntervalsWellness
} from "@/lib/providers/intervals";
import { fetchOptionalGarminNormalized, mergeWellness } from "@/lib/providers/garmin";
import { fetchStasContext } from "@/lib/providers/stas";
import { fetchWithingsWellness } from "@/lib/providers/withings";

const knownHealthKeys = new Set([
  "id","date","local_date","hrv","hrvRmssd","hrv_rmssd","restingHR","restingHr","resting_hr",
  "sleepSecs","sleep_secs","sleepSeconds","sleep","sleepHours","sleep_hours","sleepScore","sleep_score",
  "steps","weight","weightKg","weight_kg","bodyBattery","body_battery","stress","stressScore","stress_score",
  "spo2","spO2","pulseOx","pulse_ox","respiration","respirationRate","respiration_rate","calories",
  "activeCalories","active_calories","bodyFatPct","fatMassKg","muscleMassKg","boneMassKg","hydrationKg"
]);


function activityFtpFromRaw(activity: { raw?: Record<string, unknown> }): number | null {
  const raw = activity.raw;
  if (!raw) return null;

  const keys = ["ftp", "icu_ftp", "athlete_ftp", "cycling_ftp", "bike_ftp", "power_ftp"];

  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  }

  for (const nestedKey of ["cycling", "ride", "bike", "sportSettings", "sport_settings", "settings"]) {
    const nested = raw[nestedKey];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;

    const obj = nested as Record<string, unknown>;
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
    }
  }

  return null;
}

function localDateInTimezone(timezone = process.env.DASHBOARD_TIMEZONE || "Europe/Copenhagen") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function hasWellnessValue(row: WellnessDay) {
  return [
    row.hrv, row.restingHr, row.sleepHours, row.sleepScore, row.steps, row.weightKg,
    row.bodyBattery, row.stress, row.spo2, row.respiration, row.calories,
    row.bodyFatPct, row.fatMassKg, row.muscleMassKg, row.boneMassKg, row.hydrationKg
  ].some(v => typeof v === "number" && Number.isFinite(v));
}

function latestUsableWellness(rows: WellnessDay[], today: string) {
  return [...rows]
    .filter(r => r.date <= today && hasWellnessValue(r))
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
}

function mergeWithings(baseRows: WellnessDay[], withingsRows: WellnessDay[]) {
  const byDate = new Map<string, WellnessDay>();
  for (const row of baseRows) byDate.set(row.date, row);

  for (const row of withingsRows) {
    const base = byDate.get(row.date) || { date: row.date };
    byDate.set(row.date, {
      ...base,
      ...(row.weightKg != null ? { weightKg: row.weightKg } : {}),
      ...(row.bodyFatPct != null ? { bodyFatPct: row.bodyFatPct } : {}),
      ...(row.fatMassKg != null ? { fatMassKg: row.fatMassKg } : {}),
      ...(row.muscleMassKg != null ? { muscleMassKg: row.muscleMassKg } : {}),
      ...(row.boneMassKg != null ? { boneMassKg: row.boneMassKg } : {}),
      ...(row.hydrationKg != null ? { hydrationKg: row.hydrationKg } : {}),
      raw: { ...(base.raw || {}), withings: row.raw?.withings || row.raw || row },
      source: base.source ? `${base.source} + Withings` : "Withings"
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function latestHealthExtras(row?: WellnessDay) {
  if (!row?.raw) return [];
  const extras: Array<{ key: string; value: Scalar; source: string }> = [];

  for (const [key, value] of Object.entries(row.raw)) {
    if (knownHealthKeys.has(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      extras.push({ key, value: value as Scalar, source: row.source || "wellness" });
    }
  }

  return extras.slice(0, 40);
}

export async function buildDashboard(days = 90): Promise<DashboardData> {
  const boundedDays = Math.max(14, Math.min(days, 365));
  const today = localDateInTimezone();
  const oldest = daysAgo(boundedDays);

  const tomorrowDate = new Date(`${today}T12:00:00Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const newest = isoDate(tomorrowDate);

  const [
    athleteResult,
    wellnessResult,
    activitiesResult,
    eventsResult,
    stasResult,
    garminResult,
    withingsResult
  ] = await Promise.allSettled([
    fetchIntervalsAthlete(),
    fetchIntervalsWellness(oldest, newest),
    fetchIntervalsActivities(oldest, newest),
    fetchIntervalsEvents(oldest, isoDate(new Date(Date.now() + 31 * 86400000))),
    fetchStasContext(),
    fetchOptionalGarminNormalized(),
    fetchWithingsWellness(oldest, today)
  ]);

  const sourceNotes: string[] = [];

  const athlete = athleteResult.status === "fulfilled" ? athleteResult.value : {};
  if (athleteResult.status === "rejected") {
    sourceNotes.push(athleteResult.reason instanceof Error ? athleteResult.reason.message : "Athlete profile unavailable.");
  }

  const intervalsWellness = wellnessResult.status === "fulfilled" ? wellnessResult.value : [];
  if (wellnessResult.status === "rejected") {
    sourceNotes.push(wellnessResult.reason instanceof Error ? wellnessResult.reason.message : "Wellness unavailable.");
  }

  const activities = activitiesResult.status === "fulfilled" ? activitiesResult.value : [];
  if (activitiesResult.status === "rejected") {
    sourceNotes.push(activitiesResult.reason instanceof Error ? activitiesResult.reason.message : "Activities unavailable.");
  }

  const planned = eventsResult.status === "fulfilled" ? eventsResult.value : [];
  if (eventsResult.status === "rejected") {
    sourceNotes.push(eventsResult.reason instanceof Error ? eventsResult.reason.message : "Calendar unavailable.");
  }

  const stasBundle = stasResult.status === "fulfilled"
    ? stasResult.value
    : { data: null, source: "unavailable" as const };

  const garmin = garminResult.status === "fulfilled" ? garminResult.value : null;
  if (garminResult.status === "rejected") {
    sourceNotes.push(garminResult.reason instanceof Error ? garminResult.reason.message : "Optional Garmin provider unavailable.");
  }

  const withings = withingsResult.status === "fulfilled"
    ? withingsResult.value
    : { status: "error" as const, wellness: [], error: "Withings unavailable." };

  if (withings.error) sourceNotes.push(withings.error);

  const wellness = mergeWithings(
    mergeWellness(intervalsWellness, garmin?.wellness || []),
    withings.wellness || []
  ).filter(w => w.date <= today);

  const currentWellness = latestUsableWellness(wellness, today);

  const latestWeight = [...wellness]
    .filter(w => typeof w.weightKg === "number" && Number.isFinite(w.weightKg))
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);

  const latestBodyComposition = [...wellness]
    .filter(w => [w.bodyFatPct, w.fatMassKg, w.muscleMassKg, w.boneMassKg, w.hydrationKg]
      .some(v => typeof v === "number" && Number.isFinite(v)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);

  const newestActivityWithLoad = [...activities]
    .filter(a => a.fitness !== null || a.fatigue !== null || a.form !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .at(0);

  const fitness = newestActivityWithLoad?.fitness ?? null;
  const fatigue = newestActivityWithLoad?.fatigue ?? null;
  const form = newestActivityWithLoad?.form ?? (fitness !== null && fatigue !== null ? fitness - fatigue : null);

  const a7 = activities.filter(a => inLastDays(a.date, 7));
  const a28 = activities.filter(a => inLastDays(a.date, 28));
  const w7 = wellness.filter(w => inLastDays(w.date, 7));

  const bike28 = a28.filter(a => /ride|cycling|bike|virtualride/i.test(a.sport));
  const strength28 = a28.filter(a => /weight|strength|workout|highintensity/i.test(a.sport));

  const latestRideWithFtp = [...activities]
    .filter(a => /ride|cycling|bike|virtualride/i.test(a.sport) && activityFtpFromRaw(a) !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .at(0);

  const latestRideFtp = latestRideWithFtp ? activityFtpFromRaw(latestRideWithFtp) : null;
  const stasFtpRaw = stasBundle.data?.athlete?.cyclingFtpW;
  const stasFtp = typeof stasFtpRaw === "number" && Number.isFinite(stasFtpRaw) ? stasFtpRaw : null;
  const currentFtp = athlete.ftp ?? latestRideFtp ?? stasFtp;

  return {
    generatedAt: new Date().toISOString(),
    days: boundedDays,
    sources: {
      intervals:
        athleteResult.status === "fulfilled" ||
        activitiesResult.status === "fulfilled" ||
        wellnessResult.status === "fulfilled" ||
        eventsResult.status === "fulfilled",
      stasContext: stasBundle.source,
      garminDirect: !!garmin,
      withings: withings.status,
      notes: sourceNotes
    },
    athlete,
    current: {
      fitness,
      fatigue,
      form,
      hrv: currentWellness?.hrv,
      restingHr: currentWellness?.restingHr,
      sleepHours: currentWellness?.sleepHours,
      sleepScore: currentWellness?.sleepScore,
      steps: currentWellness?.steps,
      weightKg: latestWeight?.weightKg ?? currentWellness?.weightKg ?? athlete.weightKg,
      ftp: currentFtp,
      bodyFatPct: currentWellness?.bodyFatPct ?? latestBodyComposition?.bodyFatPct,
      fatMassKg: currentWellness?.fatMassKg ?? latestBodyComposition?.fatMassKg,
      muscleMassKg: currentWellness?.muscleMassKg ?? latestBodyComposition?.muscleMassKg,
      boneMassKg: currentWellness?.boneMassKg ?? latestBodyComposition?.boneMassKg,
      hydrationKg: currentWellness?.hydrationKg ?? latestBodyComposition?.hydrationKg
    },
    aggregates: {
      load7d: sum(a7.map(a => a.load)),
      load28d: sum(a28.map(a => a.load)),
      sessions7d: a7.length,
      sessions28d: a28.length,
      bikeHours28d: sum(bike28.map(a => (a.movingTimeSec || 0) / 3600)),
      strengthSessions28d: strength28.length,
      rideSessions28d: bike28.length,
      avgHrv7d: avg(w7.map(w => w.hrv)),
      avgRestingHr7d: avg(w7.map(w => w.restingHr)),
      avgSleepHours7d: avg(w7.map(w => w.sleepHours)),
      avgWeight7d: avg(w7.map(w => w.weightKg))
    },
    wellness,
    activities: [...activities].sort((a, b) => b.date.localeCompare(a.date)),
    planned: [...planned].sort((a, b) => a.start.localeCompare(b.start)),
    stas: stasBundle.data,
    latestHealthExtras: latestHealthExtras(currentWellness)
  };
}
