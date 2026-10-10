import type { WellnessDay } from "@/lib/types";

export type RecoveryPoint = {
  date: string;
  score: number | null;
  coverage: number;
  hrvScore: number | null;
  rhrScore: number | null;
  sleepScore: number | null;
  hrvBaseline: number | null;
  rhrBaseline: number | null;
};

export type LoadBalance = {
  ratio: number | null;
  label: "No baseline" | "Lower than recent" | "Near recent average" | "Above recent average";
};

function finite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function avg(values: Array<number | null | undefined>) {
  const clean = values.filter(finite);
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function previousValues(
  rows: WellnessDay[],
  index: number,
  key: "hrv" | "restingHr",
  maxObservations = 7
) {
  const values: number[] = [];
  for (let i = index - 1; i >= 0 && values.length < maxObservations; i--) {
    const value = rows[i][key];
    if (finite(value)) values.unshift(value);
  }
  return values;
}

export function buildRecoverySeries(wellness: WellnessDay[]): RecoveryPoint[] {
  const rows = [...wellness].sort((a, b) => a.date.localeCompare(b.date));

  return rows.map((row, index) => {
    const hrvBaseline = avg(previousValues(rows, index, "hrv"));
    const rhrBaseline = avg(previousValues(rows, index, "restingHr"));

    const hrvScore =
      finite(row.hrv) && finite(hrvBaseline) && hrvBaseline > 0
        ? Math.round(clamp((row.hrv / hrvBaseline) * 85, 45, 100))
        : null;

    const rhrScore =
      finite(row.restingHr) && finite(rhrBaseline) && row.restingHr > 0
        ? Math.round(clamp((rhrBaseline / row.restingHr) * 85, 45, 100))
        : null;

    const sleepScore =
      finite(row.sleepScore)
        ? Math.round(clamp(row.sleepScore))
        : finite(row.sleepHours)
          ? Math.round(clamp((row.sleepHours / 8) * 85, 45, 100))
          : null;

    const components = [hrvScore, rhrScore, sleepScore].filter(finite);

    return {
      date: row.date,
      score: components.length
        ? Math.round(components.reduce((a, b) => a + b, 0) / components.length)
        : null,
      coverage: components.length,
      hrvScore,
      rhrScore,
      sleepScore,
      hrvBaseline,
      rhrBaseline
    };
  });
}

export function recoveryLabel(score: number | null, coverage: number) {
  if (score === null || coverage === 0) return "Not enough data";
  if (coverage < 2) return "Limited recovery data";
  if (score >= 82) return "Recovery signals are strong";
  if (score >= 68) return "Recovery signals are steady";
  return "Recovery signals are subdued";
}

export function coverageLabel(coverage: number) {
  if (coverage >= 3) return "HRV · RHR · Sleep";
  if (coverage === 2) return "2 of 3 recovery signals";
  if (coverage === 1) return "1 of 3 recovery signals";
  return "No recovery signals";
}

export function recoveryTrend(series: RecoveryPoint[], date: string | null) {
  if (!date) return null;
  const idx = series.findIndex(x => x.date === date);
  if (idx < 0 || !finite(series[idx].score)) return null;

  const prior = series
    .slice(Math.max(0, idx - 7), idx)
    .map(x => x.score)
    .filter(finite);

  const baseline = avg(prior);
  return finite(baseline) ? series[idx].score! - baseline : null;
}

export function loadBalance(load7d: number, load28d: number): LoadBalance {
  if (!finite(load7d) || !finite(load28d) || load28d <= 0) {
    return { ratio: null, label: "No baseline" };
  }

  const recentWeeklyAverage = load28d / 4;
  const ratio = recentWeeklyAverage > 0 ? load7d / recentWeeklyAverage : null;

  if (!finite(ratio)) return { ratio: null, label: "No baseline" };
  if (ratio < 0.78) return { ratio, label: "Lower than recent" };
  if (ratio > 1.22) return { ratio, label: "Above recent average" };
  return { ratio, label: "Near recent average" };
}

export function sleepConsistency(wellness: WellnessDay[], observations = 7) {
  const values = [...wellness]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(x => x.sleepHours)
    .filter(finite)
    .slice(-observations);

  if (values.length < 3) return null;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const sd = Math.sqrt(variance);

  // Presentation score only: low night-to-night variation scores higher.
  return Math.round(clamp(100 - sd * 30, 45, 100));
}

export function weightTrendKg(wellness: WellnessDay[], lookbackDays = 28) {
  const measured = [...wellness]
    .filter(x => finite(x.weightKg))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (measured.length < 2) return null;

  const latest = measured.at(-1)!;
  const latestDate = new Date(`${latest.date}T12:00:00`);
  const cutoff = new Date(latestDate);
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  const candidates = measured.filter(x => new Date(`${x.date}T12:00:00`) >= cutoff);
  if (candidates.length < 2) return null;

  return latest.weightKg! - candidates[0].weightKg!;
}
