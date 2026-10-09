import type { Activity, AthleteProfile, PlannedEvent, WellnessDay } from "@/lib/types";
import { firstNum, firstString } from "@/lib/util";

const base = process.env.INTERVALS_BASE_URL || "https://intervals.icu/api/v1";
const configuredAthleteId = process.env.INTERVALS_ATHLETE_ID || "i149757";

function candidateAthleteIds(): string[] {
  return [...new Set([configuredAthleteId, "i149757", "0"].filter(Boolean))];
}

function authHeader(): string {
  const key = process.env.INTERVALS_API_KEY;
  if (!key) throw new Error("INTERVALS_API_KEY is not configured");
  return "Basic " + Buffer.from(`API_KEY:${key}`).toString("base64");
}

async function getJsonPath(path: string) {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
    cache: "no-store"
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Intervals.icu request failed (${res.status}) for ${path}: ${body.slice(0, 240)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  return res.json();
}

async function getForAthlete(pathBuilder: (athleteId: string) => string) {
  let lastError: unknown = null;

  for (const id of candidateAthleteIds()) {
    try {
      return await getJsonPath(pathBuilder(id));
    } catch (e) {
      lastError = e;
      const status = (e as { status?: number })?.status;
      if (status === 401 || status === 403) break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Intervals.icu request failed");
}

function findFtp(raw: Record<string, unknown>): number | null {
  const ftpKeys = ["ftp", "icu_ftp", "athlete_ftp", "cycling_ftp", "bike_ftp", "power_ftp"];
  const direct = firstNum(raw, ftpKeys);
  if (direct !== null) return direct;

  for (const key of ["cycling", "ride", "bike", "sportSettings", "sport_settings", "settings"]) {
    const nested = raw[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const candidate = firstNum(nested as Record<string, unknown>, ftpKeys);
      if (candidate !== null) return candidate;
    }
  }

  return null;
}

function mapWellness(row: Record<string, unknown>): WellnessDay {
  const sleepSecs = firstNum(row, ["sleepSecs", "sleep_secs", "sleepSeconds", "sleep"]);
  return {
    date: firstString(row, ["id", "date", "local_date"]) || "",
    hrv: firstNum(row, ["hrv", "hrvRmssd", "hrv_rmssd"]),
    restingHr: firstNum(row, ["restingHR", "restingHr", "resting_hr"]),
    sleepHours: sleepSecs !== null ? sleepSecs / 3600 : firstNum(row, ["sleepHours", "sleep_hours"]),
    sleepScore: firstNum(row, ["sleepScore", "sleep_score"]),
    steps: firstNum(row, ["steps"]),
    weightKg: firstNum(row, ["weight", "weightKg", "weight_kg"]),
    bodyBattery: firstNum(row, ["bodyBattery", "body_battery"]),
    stress: firstNum(row, ["stress", "stressScore", "stress_score"]),
    spo2: firstNum(row, ["spo2", "spO2", "pulseOx", "pulse_ox"]),
    respiration: firstNum(row, ["respiration", "respirationRate", "respiration_rate"]),
    calories: firstNum(row, ["calories", "activeCalories", "active_calories"]),
    raw: row,
    source: "Intervals.icu wellness"
  };
}

function mapActivity(row: Record<string, unknown>): Activity {
  const fitness = firstNum(row, ["icu_ctl", "ctl", "fitness"]);
  const fatigue = firstNum(row, ["icu_atl", "atl", "fatigue"]);
  let form = firstNum(row, ["icu_form", "form"]);
  if (form === null && fitness !== null && fatigue !== null) form = fitness - fatigue;

  return {
    id: String(row.id ?? row.icu_id ?? row.activity_id ?? ""),
    date: firstString(row, ["start_date_local", "start_date", "date"]) || "",
    name: firstString(row, ["name"]) || "Activity",
    sport: firstString(row, ["type", "sport", "activity_type"]) || "Other",
    movingTimeSec: firstNum(row, ["moving_time", "movingTime", "elapsed_time"]),
    distanceM: firstNum(row, ["distance"]),
    load: firstNum(row, ["icu_training_load", "training_load", "load"]),
    avgHr: firstNum(row, ["average_heartrate", "avg_hr", "averageHr"]),
    maxHr: firstNum(row, ["max_heartrate", "max_hr", "maxHr"]),
    avgPower: firstNum(row, ["average_watts", "avg_watts", "averagePower"]),
    normalizedPower: firstNum(row, ["icu_weighted_avg_watts", "normalized_power", "weighted_average_watts"]),
    intensityFactor: firstNum(row, ["icu_intensity", "intensity_factor", "if"]),
    cadence: firstNum(row, ["average_cadence", "cadence"]),
    decouplingPct: firstNum(row, ["icu_aerobic_decoupling", "aerobic_decoupling", "decoupling"]),
    calories: firstNum(row, ["calories"]),
    elevationGainM: firstNum(row, ["total_elevation_gain", "elevation_gain", "elevationGain"]),
    fitness,
    fatigue,
    form,
    raw: row
  };
}

function mapEvent(row: Record<string, unknown>): PlannedEvent {
  return {
    id: String(row.id ?? row.external_id ?? ""),
    start: firstString(row, ["start_date_local", "start_date", "date"]) || "",
    end: firstString(row, ["end_date_local", "end_date"]),
    name: firstString(row, ["name", "title"]) || "Planned event",
    category: firstString(row, ["category"]),
    type: firstString(row, ["type", "activity_type"]),
    description: firstString(row, ["description"]),
    movingTimeSec: firstNum(row, ["moving_time"]),
    load: firstNum(row, ["icu_training_load", "load"])
  };
}

export async function fetchIntervalsAthlete(): Promise<AthleteProfile> {
  const raw = (await getForAthlete(id => `/athlete/${encodeURIComponent(id)}`)) as Record<string, unknown>;
  return {
    name: firstString(raw, ["name"]),
    weightKg: firstNum(raw, ["weight", "weightKg"]),
    maxHr: firstNum(raw, ["max_hr", "maxHr"]),
    lthr: firstNum(raw, ["lthr", "lt_hr", "lactateThresholdHr"]),
    ftp: findFtp(raw),
    timezone: firstString(raw, ["timezone", "time_zone"]),
    raw
  };
}

export async function fetchIntervalsWellness(oldest: string, newest: string): Promise<WellnessDay[]> {
  const raw = await getForAthlete(
    id => `/athlete/${encodeURIComponent(id)}/wellness?oldest=${encodeURIComponent(oldest)}&newest=${encodeURIComponent(newest)}`
  );
  if (!Array.isArray(raw)) return [];
  return raw.map(x => mapWellness(x as Record<string, unknown>)).filter(x => x.date);
}

export async function fetchIntervalsActivities(oldest: string, newest: string): Promise<Activity[]> {
  const raw = await getForAthlete(
    id => `/athlete/${encodeURIComponent(id)}/activities?oldest=${encodeURIComponent(oldest)}&newest=${encodeURIComponent(newest)}`
  );
  if (!Array.isArray(raw)) return [];
  return raw.map(x => mapActivity(x as Record<string, unknown>)).filter(x => x.date);
}

export async function fetchIntervalsEvents(oldest: string, newest: string): Promise<PlannedEvent[]> {
  const raw = await getForAthlete(
    id => `/athlete/${encodeURIComponent(id)}/events?oldest=${encodeURIComponent(oldest)}&newest=${encodeURIComponent(newest)}`
  );
  if (!Array.isArray(raw)) return [];
  return raw.map(x => mapEvent(x as Record<string, unknown>)).filter(x => x.start);
}
