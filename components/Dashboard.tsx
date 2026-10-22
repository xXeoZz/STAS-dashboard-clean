"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Sparkline from "@/components/Sparkline";
import type { Activity, DashboardData, PlannedEvent, WellnessDay } from "@/lib/types";
import {
  buildRecoverySeries,
  coverageLabel,
  loadBalance,
  recoveryLabel,
  recoveryTrend,
  sleepConsistency,
  weightTrendKg,
  type RecoveryPoint
} from "@/lib/health-intelligence";

type Tab = "Today" | "Health" | "Training" | "Cycling" | "Plan";
type WorkoutKind = "rest" | "hiit" | "strength" | "cycling" | "running" | "other";
type HealthMetric = "hrv" | "rhr" | "sleep" | "weight";
type CyclingMetric = "efficiency" | "decoupling" | "avgPower" | "np";

const tabs: Array<{ key: Tab; label: string; icon: string }> = [
  { key: "Today", label: "Today", icon: "◉" },
  { key: "Health", label: "Health", icon: "♥" },
  { key: "Training", label: "Fitness", icon: "↗" },
  { key: "Cycling", label: "Cycling", icon: "◌" },
  { key: "Plan", label: "Plan", icon: "▦" }
];

const kindMeta: Record<WorkoutKind, { label: string; className: string }> = {
  rest: { label: "Rest", className: "kindRest" },
  hiit: { label: "HIIT", className: "kindHiit" },
  strength: { label: "Strength", className: "kindStrength" },
  cycling: { label: "Cycling", className: "kindCycling" },
  running: { label: "Running", className: "kindRunning" },
  other: { label: "Other", className: "kindOther" }
};

const fmt = (v: number | null | undefined, d = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—";

const dateOnly = (s: string) => (s ? s.slice(0, 10) : "—");

function localIso(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function duration(sec?: number | null) {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h ? `${h}h ` : ""}${m}m`;
}

function distance(m?: number | null) {
  return typeof m === "number" ? `${(m / 1000).toFixed(1)} km` : "—";
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function isRide(a: Activity) {
  return /ride|cycling|bike|virtualride|ebike/i.test(a.sport);
}

function workoutKind(sport?: string | null, name?: string | null): WorkoutKind {
  const text = `${sport || ""} ${name || ""}`.toLowerCase();
  if (/rest|recovery day|off day/.test(text)) return "rest";
  if (/hiit|highintensity|crossfit|metcon|interval/.test(text)) return "hiit";
  if (/weight|strength|weighttraining|gym|functional/.test(text)) return "strength";
  if (/run|running|trailrun|treadmill/.test(text)) return "running";
  if (/ride|cycling|bike|virtualride|ebike|indoorcycling/.test(text)) return "cycling";
  return "other";
}

function eventKind(p: PlannedEvent): WorkoutKind {
  const cat = `${p.category || ""}`.toLowerCase();
  const name = `${p.name || ""}`.toLowerCase();
  if (cat.includes("note") && /rest|off|recovery/.test(name)) return "rest";
  return workoutKind(p.type, p.name);
}

function average(values: Array<number | null | undefined>) {
  const clean = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
}

function ScoreOrb({ score }: { score: number | null }) {
  const style = { "--score": `${score == null ? 0 : clamp(score)}%` } as CSSProperties;
  return (
    <div className="scoreOrb" style={style}>
      <div>
        <b>{score ?? "—"}</b>
        <span>recovery</span>
      </div>
    </div>
  );
}

function Delta({
  value,
  unit = "",
  reverse = false
}: {
  value: number | null;
  unit?: string;
  reverse?: boolean;
}) {
  if (value === null || !Number.isFinite(value)) return <span className="delta neutral">No baseline</span>;
  const near = Math.abs(value) < 0.5;
  const positive = reverse ? value < 0 : value > 0;
  return (
    <span className={`delta ${near ? "neutral" : positive ? "positive" : "negative"}`}>
      {near ? "≈" : value > 0 ? "↑" : "↓"} {Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : 1)}{unit}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="sectionHeading">
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function RecoveryHero({
  data,
  series,
  selectedDate,
  setSelectedDate
}: {
  data: DashboardData;
  series: RecoveryPoint[];
  selectedDate: string | null;
  setSelectedDate: (d: string) => void;
}) {
  const available = series.filter(x => x.score !== null).map(x => x.date);
  const effectiveDate =
    selectedDate && available.includes(selectedDate)
      ? selectedDate
      : available.at(-1) || null;

  const idx = effectiveDate ? available.indexOf(effectiveDate) : -1;
  const point = effectiveDate ? series.find(x => x.date === effectiveDate) || null : null;
  const wellness = effectiveDate ? data.wellness.find(x => x.date === effectiveDate) || null : null;
  const trend = recoveryTrend(series, effectiveDate);

  const label = effectiveDate
    ? new Date(`${effectiveDate}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short"
      })
    : "No data";

  const hrvDelta =
    typeof wellness?.hrv === "number" && typeof point?.hrvBaseline === "number"
      ? wellness.hrv - point.hrvBaseline
      : null;

  const rhrDelta =
    typeof wellness?.restingHr === "number" && typeof point?.rhrBaseline === "number"
      ? wellness.restingHr - point.rhrBaseline
      : null;

  return (
    <section className="heroPanel">
      <div className="heroTop">
        <div>
          <span className="kicker">How am I?</span>
          <b>{label}</b>
        </div>

        <div className="dateStepper">
          <button
            onClick={() => idx > 0 && setSelectedDate(available[idx - 1])}
            disabled={idx <= 0}
            aria-label="Previous recovery day"
          >
            ‹
          </button>
          <button
            className="latestBtn"
            onClick={() => available.length && setSelectedDate(available[available.length - 1])}
            disabled={idx === available.length - 1}
          >
            Latest
          </button>
          <button
            onClick={() => idx >= 0 && idx < available.length - 1 && setSelectedDate(available[idx + 1])}
            disabled={idx < 0 || idx >= available.length - 1}
            aria-label="Next recovery day"
          >
            ›
          </button>
        </div>
      </div>

      <div className="heroBody">
        <ScoreOrb score={point?.score ?? null} />

        <div className="heroCopy">
          <span className="eyebrow">DAILY RECOVERY</span>
          <h1>{recoveryLabel(point?.score ?? null, point?.coverage ?? 0)}</h1>
          <p>
            A simple presentation score from the recovery data you already own.
            It is context for training decisions, not a medical or automatic readiness verdict.
          </p>

          <div className="heroTrend">
            <Delta value={trend} />
            <span>vs previous recovery days</span>
          </div>
        </div>
      </div>

      <div className="signalStrip">
        <div>
          <span>HRV</span>
          <b>{fmt(wellness?.hrv)} <em>ms</em></b>
          <Delta value={hrvDelta} unit=" ms" />
        </div>
        <div>
          <span>Resting HR</span>
          <b>{fmt(wellness?.restingHr)} <em>bpm</em></b>
          <Delta value={rhrDelta} unit=" bpm" reverse />
        </div>
        <div>
          <span>Sleep</span>
          <b>{fmt(wellness?.sleepHours, 1)} <em>h</em></b>
          <span className="delta neutral">score {fmt(wellness?.sleepScore)}</span>
        </div>
      </div>

      <div className="coverageLine">
        <span>{coverageLabel(point?.coverage ?? 0)}</span>
        <i />
      </div>
    </section>
  );
}


function RingScore({
  value,
  label,
  tone,
  suffix = "%"
}: {
  value: number | null;
  label: string;
  tone: "blue" | "green" | "purple";
  suffix?: string;
}) {
  const visual = value == null ? 0 : clamp(value, 0, 100);
  const style = { "--ring": `${visual}%` } as CSSProperties;

  return (
    <div className={`miniScore ${tone}`} style={style}>
      <div className="miniScoreCore">
        <b>{value == null ? "—" : Math.round(value)}{value == null ? "" : suffix}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

function DailyScores({
  data,
  recovery
}: {
  data: DashboardData;
  recovery: RecoveryPoint | null;
}) {
  const load = loadBalance(data.aggregates.load7d, data.aggregates.load28d);
  const loadPct = load.ratio == null ? null : load.ratio * 100;
  const sleep = typeof data.current.sleepScore === "number" ? data.current.sleepScore : null;

  return (
    <section className="dailyScoreCard">
      <div className="scoreHeader">
        <div>
          <span className="kicker">TODAY</span>
          <h2>Daily signals</h2>
        </div>
        <span className="scoreDate">
          {new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(new Date())}
        </span>
      </div>

      <div className="scoreTrio">
        <div>
          <RingScore value={loadPct} label="LOAD" tone="blue" />
          <small>{load.label}</small>
        </div>
        <div>
          <RingScore value={recovery?.score ?? null} label="RECOVERY" tone="green" suffix="" />
          <small>{recoveryLabel(recovery?.score ?? null, recovery?.coverage ?? 0)}</small>
        </div>
        <div>
          <RingScore value={sleep} label="SLEEP" tone="purple" suffix="" />
          <small>{typeof data.current.sleepHours === "number" ? `${data.current.sleepHours.toFixed(1)} h` : "No sleep data"}</small>
        </div>
      </div>

      <div className="dailySignalFoot">
        <span>HRV <b>{fmt(data.current.hrv)} ms</b></span>
        <span>RHR <b>{fmt(data.current.restingHr)} bpm</b></span>
        <span>Form <b>{fmt(data.current.form, 1)}</b></span>
      </div>
    </section>
  );
}

function RecentTrainingCard({ activities }: { activities: Activity[] }) {
  const latest = activities.slice(0, 3);

  return (
    <section className="card recentTrainingCard">
      <SectionHeading eyebrow="RECENT" title="Training" />
      <div className="ascentList">
        {latest.length ? latest.map((a, idx) => {
          const kind = workoutKind(a.sport, a.name);
          const intensity =
            typeof a.intensityFactor === "number"
              ? Math.round(a.intensityFactor * 100)
              : typeof a.load === "number"
                ? Math.min(100, Math.round(a.load))
                : null;

          return (
            <div className="ascentRow" key={`${a.id}-${a.date}`}>
              <div className={`activityTile ${kindMeta[kind].className}`}>
                <span>{kind === "cycling" ? "◌" : kind === "strength" ? "▥" : kind === "hiit" ? "↗" : "•"}</span>
              </div>
              <div className="ascentCopy">
                <b>{a.name}</b>
                <span>{dateOnly(a.date)} · {duration(a.movingTimeSec)}{typeof a.avgHr === "number" ? ` · ${fmt(a.avgHr)} bpm` : ""}</span>
              </div>
              <div className="ascentScore">
                <b>{intensity == null ? "—" : `${intensity}%`}</b>
                <span>{idx === 0 ? "latest" : "effort"}</span>
              </div>
            </div>
          );
        }) : <div className="emptyState">No recent activities returned.</div>}
      </div>
    </section>
  );
}

function LatestRideHero({ ride }: { ride: Activity | null }) {
  if (!ride) {
    return (
      <section className="rideHero">
        <span className="kicker">CYCLING</span>
        <h2>No recent ride</h2>
        <p>No cycling activity was returned for the selected period.</p>
      </section>
    );
  }

  const effort =
    typeof ride.intensityFactor === "number"
      ? Math.round(ride.intensityFactor * 100)
      : null;

  return (
    <section className="rideHero">
      <div className="rideHeroTop">
        <div>
          <span className="kicker">LATEST RIDE</span>
          <h2>{ride.name}</h2>
          <small>{dateOnly(ride.date)}</small>
        </div>
        <RingScore value={effort} label="EFFORT" tone="blue" />
      </div>

      <div className="rideMetrics">
        <div><span>Time</span><b>{duration(ride.movingTimeSec)}</b></div>
        <div><span>Distance</span><b>{distance(ride.distanceM)}</b></div>
        <div><span>Avg HR</span><b>{fmt(ride.avgHr)} bpm</b></div>
        <div><span>Avg power</span><b>{fmt(ride.avgPower)} W</b></div>
        <div><span>NP</span><b>{fmt(ride.normalizedPower)} W</b></div>
        <div><span>Cadence</span><b>{fmt(ride.cadence)} rpm</b></div>
      </div>
    </section>
  );
}

function startOfIsoWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function WeeklyReview({ data }: { data: DashboardData }) {
  const thisMonday = startOfIsoWeek(new Date());
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSundayEnd = new Date(thisMonday);

  const week = data.activities.filter(a => {
    const d = new Date(a.date);
    return d >= lastMonday && d < lastSundayEnd;
  });

  const previousMonday = new Date(lastMonday);
  previousMonday.setDate(lastMonday.getDate() - 7);
  const previous = data.activities.filter(a => {
    const d = new Date(a.date);
    return d >= previousMonday && d < lastMonday;
  });

  const weekLoad = week.reduce((sum, a) => sum + (a.load || 0), 0);
  const previousLoad = previous.reduce((sum, a) => sum + (a.load || 0), 0);
  const weekSec = week.reduce((sum, a) => sum + (a.movingTimeSec || 0), 0);

  const rides = week.filter(a => workoutKind(a.sport, a.name) === "cycling");
  const strength = week.filter(a => workoutKind(a.sport, a.name) === "strength");
  const hiit = week.filter(a => workoutKind(a.sport, a.name) === "hiit");

  const longestRide = [...rides]
    .sort((a, b) => (b.movingTimeSec || 0) - (a.movingTimeSec || 0))[0];

  const strongestRide = [...rides]
    .filter(a => typeof a.normalizedPower === "number" || typeof a.avgPower === "number")
    .sort((a, b) =>
      ((b.normalizedPower ?? b.avgPower ?? 0) - (a.normalizedPower ?? a.avgPower ?? 0))
    )[0];

  const change =
    previousLoad > 0 ? Math.round(((weekLoad - previousLoad) / previousLoad) * 100) : null;

  const mainSignal =
    rides.length === 0 && (strength.length + hiit.length) >= 3
      ? "Strength-heavy week; cycling frequency was the main thing missing."
      : longestRide && (longestRide.movingTimeSec || 0) >= 90 * 60
        ? `Long-endurance work anchored the week with ${duration(longestRide.movingTimeSec)} on the bike.`
        : rides.length >= 3
          ? "Good cycling frequency with repeated aerobic exposure."
          : week.length
            ? "Training stayed consistent, but the week was relatively light on bike volume."
            : "No completed training was returned for the previous week.";

  const goalLink =
    rides.length === 0
      ? "For Vätternrundan, the priority is simply to re-establish regular saddle time—no catch-up debt."
      : longestRide && (longestRide.movingTimeSec || 0) >= 90 * 60
        ? "Useful for the Vätternrundan goal: duration and repeatability matter more than chasing one big session."
        : "The next useful step is another controlled bike exposure while preserving the weekly long-endurance anchor.";

  const response =
    strongestRide
      ? `${strongestRide.name}: ${fmt(strongestRide.normalizedPower ?? strongestRide.avgPower)} W ${strongestRide.normalizedPower ? "NP" : "avg"}${typeof strongestRide.avgHr === "number" ? ` at ${fmt(strongestRide.avgHr)} bpm` : ""}.`
      : `${rides.length} ride${rides.length === 1 ? "" : "s"}, ${strength.length} strength and ${hiit.length} HIIT session${hiit.length === 1 ? "" : "s"}.`;

  const risk =
    rides.length === 0
      ? "Risk: strength/HIIT can crowd out the aerobic work if that pattern continues."
      : rides.length >= 4 && (strength.length + hiit.length) >= 3
        ? "Risk: density is high; protect recovery before adding more intensity."
        : "No major pattern-level concern from the week alone.";

  const mondayLabel = lastMonday.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const sunday = new Date(thisMonday);
  sunday.setDate(thisMonday.getDate() - 1);
  const sundayLabel = sunday.toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <section className="weeklyReviewCard">
      <div className="weeklyReviewTop">
        <div>
          <span className="kicker">WEEKLY REVIEW</span>
          <h2>{mondayLabel}–{sundayLabel}</h2>
        </div>
        <span className="reviewBadge">Previous week</span>
      </div>

      <div className="weeklyReviewStats">
        <div><b>{(weekSec / 3600).toFixed(1)}h</b><span>training</span></div>
        <div><b>{Math.round(weekLoad)}</b><span>load</span></div>
        <div><b>{week.length}</b><span>sessions</span></div>
        <div><b>{rides.length}</b><span>rides</span></div>
      </div>

      <div className="reviewNarrative">
        <div>
          <span>Main signal</span>
          <p>{mainSignal}</p>
        </div>
        <div>
          <span>Response</span>
          <p>{response}</p>
        </div>
        <div>
          <span>Goal link</span>
          <p>{goalLink}</p>
        </div>
        <div>
          <span>Watch</span>
          <p>{risk}</p>
        </div>
      </div>

      <div className="reviewFooter">
        <span>Load vs prior week</span>
        <b>{change === null ? "No comparison" : `${change > 0 ? "+" : ""}${change}%`}</b>
      </div>
    </section>
  );
}

function WeekSnapshot({ data }: { data: DashboardData }) {
  const balance = loadBalance(data.aggregates.load7d, data.aggregates.load28d);
  const pct = balance.ratio === null ? 0 : clamp(balance.ratio * 100, 0, 160);

  const activities = data.activities.filter(a => {
    const d = new Date(a.date);
    const now = new Date();
    const monday = new Date(now);
    const weekday = monday.getDay();
    monday.setDate(monday.getDate() + (weekday === 0 ? -6 : 1 - weekday));
    monday.setHours(0, 0, 0, 0);
    return d >= monday;
  });

  const seconds = activities.reduce((sum, a) => sum + (a.movingTimeSec || 0), 0);
  const rides = activities.filter(a => workoutKind(a.sport, a.name) === "cycling").length;

  return (
    <section className="card compactCard">
      <SectionHeading
        eyebrow="THIS WEEK"
        title="Training in one glance"
        action={<span className="subtleTag">{balance.label}</span>}
      />

      <div className="weekNumbers">
        <div><b>{(seconds / 3600).toFixed(1)}h</b><span>time</span></div>
        <div><b>{Math.round(data.aggregates.load7d)}</b><span>load</span></div>
        <div><b>{activities.length}</b><span>sessions</span></div>
        <div><b>{rides}</b><span>rides</span></div>
      </div>

      <div className="balanceRow">
        <div>
          <span>7d load vs recent weekly average</span>
          <b>{balance.ratio === null ? "—" : `${Math.round(balance.ratio * 100)}%`}</b>
        </div>
        <div className="balanceTrack">
          <i style={{ width: `${Math.min(100, pct)}%` }} />
          <span className="balanceMarker" />
        </div>
      </div>
    </section>
  );
}

function buildMonthData(activities: Activity[], planned: PlannedEvent[], monthOffset: number) {
  const now = new Date();
  const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (firstDay.getDay() + 6) % 7;

  const activityMap = new Map<string, Activity[]>();
  const planMap = new Map<string, PlannedEvent[]>();

  for (const a of activities) {
    const iso = dateOnly(a.date);
    const d = new Date(`${iso}T12:00:00`);
    if (d.getFullYear() === year && d.getMonth() === month) {
      activityMap.set(iso, [...(activityMap.get(iso) || []), a]);
    }
  }

  for (const p of planned) {
    const iso = dateOnly(p.start);
    const d = new Date(`${iso}T12:00:00`);
    if (d.getFullYear() === year && d.getMonth() === month) {
      planMap.set(iso, [...(planMap.get(iso) || []), p]);
    }
  }

  const cells: Array<{
    key: string;
    day?: number;
    iso?: string;
    kinds?: WorkoutKind[];
    plannedOnly?: boolean;
    explicitRest?: boolean;
  }> = [];

  for (let i = 0; i < mondayOffset; i++) cells.push({ key: `start-${i}` });

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = localIso(new Date(year, month, day, 12));
    const actual = activityMap.get(iso) || [];
    const plans = planMap.get(iso) || [];
    const actualKinds = [...new Set(actual.map(a => workoutKind(a.sport, a.name)))];
    const planKinds = [...new Set(plans.map(eventKind))];
    const explicitRest = planKinds.includes("rest");

    cells.push({
      key: iso,
      day,
      iso,
      kinds: actualKinds.length ? actualKinds : planKinds.filter(k => k !== "rest"),
      plannedOnly: actual.length === 0 && planKinds.some(k => k !== "rest"),
      explicitRest
    });
  }

  while (cells.length % 7 !== 0) cells.push({ key: `end-${cells.length}` });

  const monthActivities = activities.filter(a => {
    const d = new Date(`${dateOnly(a.date)}T12:00:00`);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const counts: Record<WorkoutKind, number> = {
    rest: 0, hiit: 0, strength: 0, cycling: 0, running: 0, other: 0
  };
  monthActivities.forEach(a => counts[workoutKind(a.sport, a.name)]++);
  planned
    .filter(p => {
      const d = new Date(`${dateOnly(p.start)}T12:00:00`);
      return d.getFullYear() === year && d.getMonth() === month && eventKind(p) === "rest";
    })
    .forEach(() => counts.rest++);

  return {
    monthLabel: monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    cells,
    counts,
    timeSec: monthActivities.reduce((sum, a) => sum + (a.movingTimeSec || 0), 0),
    load: monthActivities.reduce((sum, a) => sum + (a.load || 0), 0)
  };
}

function MonthCard({
  activities,
  planned,
  monthOffset,
  setMonthOffset,
  compact = false
}: {
  activities: Activity[];
  planned: PlannedEvent[];
  monthOffset: number;
  setMonthOffset: (n: number) => void;
  compact?: boolean;
}) {
  const month = buildMonthData(activities, planned, monthOffset);
  const today = localIso();

  return (
    <section className={`card monthCard ${compact ? "monthCompact" : ""}`}>
      <SectionHeading
        eyebrow={compact ? "THIS MONTH" : "MONTHLY REPORT"}
        title={month.monthLabel}
        action={
          <div className="monthNav">
            <button onClick={() => setMonthOffset(monthOffset - 1)}>‹</button>
            <button onClick={() => setMonthOffset(monthOffset + 1)} disabled={monthOffset >= 0}>›</button>
          </div>
        }
      />

      <div className="calendarWeekdays">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
      </div>

      <div className="calendarGrid">
        {month.cells.map(cell => {
          if (!cell.day || !cell.iso) return <div className="dayCell emptyCell" key={cell.key} />;

          const kinds = cell.kinds || [];
          return (
            <div
              className={`dayCell ${cell.iso === today ? "todayCell" : ""} ${cell.plannedOnly ? "plannedCell" : ""}`}
              key={cell.key}
              title={
                cell.explicitRest
                  ? `${cell.iso} · Rest`
                  : kinds.length
                    ? `${cell.iso} · ${kinds.map(k => kindMeta[k].label).join(", ")}`
                    : `${cell.iso} · No workout recorded`
              }
            >
              <span>{cell.day}</span>
              <div className="dayDots">
                {(cell.explicitRest ? (["rest"] as WorkoutKind[]) : kinds).slice(0, 3).map((k, idx) => (
                  <i className={kindMeta[k].className} key={`${k}-${idx}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="monthSummaryLine">
        {(["cycling", "strength", "hiit", "running"] as WorkoutKind[])
          .filter(k => month.counts[k] > 0)
          .map(k => (
            <span key={k}><i className={kindMeta[k].className} />{kindMeta[k].label} <b>{month.counts[k]}</b></span>
          ))}
      </div>

      {!compact && (
        <div className="monthTotals">
          <div><b>{(month.timeSec / 3600).toFixed(1)}h</b><span>training time</span></div>
          <div><b>{Math.round(month.load)}</b><span>load</span></div>
          <div><b>{month.counts.rest}</b><span>explicit rest</span></div>
        </div>
      )}
    </section>
  );
}

function HealthExplorer({
  wellness,
  metric,
  setMetric,
  avgHrv7d,
  avgRhr7d,
  avgSleep7d,
  avgWeight7d
}: {
  wellness: WellnessDay[];
  metric: HealthMetric;
  setMetric: (m: HealthMetric) => void;
  avgHrv7d?: number | null;
  avgRhr7d?: number | null;
  avgSleep7d?: number | null;
  avgWeight7d?: number | null;
}) {
  const config: Record<HealthMetric, {
    label: string;
    values: Array<number | null | undefined>;
    unit: string;
    reference?: number | null;
  }> = {
    hrv: { label: "HRV", values: wellness.map(x => x.hrv), unit: " ms", reference: avgHrv7d },
    rhr: { label: "Resting HR", values: wellness.map(x => x.restingHr), unit: " bpm", reference: avgRhr7d },
    sleep: { label: "Sleep", values: wellness.map(x => x.sleepHours), unit: " h", reference: avgSleep7d },
    weight: { label: "Weight", values: wellness.map(x => x.weightKg), unit: " kg", reference: avgWeight7d }
  };

  const active = config[metric];

  return (
    <section className="card explorerCard">
      <SectionHeading
        eyebrow="TREND"
        title={active.label}
        action={
          <div className="segmented">
            {(Object.keys(config) as HealthMetric[]).map(k => (
              <button key={k} className={metric === k ? "active" : ""} onClick={() => setMetric(k)}>
                {config[k].label}
              </button>
            ))}
          </div>
        }
      />

      <Sparkline
        values={active.values}
        dates={wellness.map(x => x.date)}
        label={active.label}
        unit={active.unit}
        reference={active.reference}
        connectGaps
        smooth
      />
    </section>
  );
}

function WeeklyLoadBars({ activities }: { activities: Activity[] }) {
  const now = new Date();
  const weeks = Array.from({ length: 12 }, (_, idx) => {
    const end = new Date(now);
    end.setDate(now.getDate() - (11 - idx) * 7 + 1);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);
    const items = activities.filter(a => {
      const d = new Date(a.date);
      return d >= start && d < end;
    });
    return {
      label: start.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      load: items.reduce((s, a) => s + (a.load || 0), 0)
    };
  });

  const max = Math.max(1, ...weeks.map(w => w.load));

  return (
    <div className="loadBars">
      {weeks.map((w, idx) => (
        <div className="loadColumn" key={`${w.label}-${idx}`} title={`${w.label}: ${Math.round(w.load)} load`}>
          <div className="loadBar" style={{ height: `${Math.max(4, (w.load / max) * 100)}%` }} />
          <span>{idx % 2 === 0 ? w.label.split(" ")[0] : ""}</span>
        </div>
      ))}
    </div>
  );
}

function TrainingDistribution({ activities }: { activities: Activity[] }) {
  const recent = activities.filter(a => Date.now() - new Date(a.date).getTime() <= 28 * 86400000);
  const seconds: Record<WorkoutKind, number> = {
    rest: 0, hiit: 0, strength: 0, cycling: 0, running: 0, other: 0
  };

  recent.forEach(a => {
    seconds[workoutKind(a.sport, a.name)] += a.movingTimeSec || 0;
  });

  const total = Object.values(seconds).reduce((a, b) => a + b, 0) || 1;
  const visible = (["cycling", "strength", "hiit", "running", "other"] as WorkoutKind[])
    .filter(k => seconds[k] > 0);

  return (
    <>
      <div className="distribution">
        {visible.map(k => (
          <i
            key={k}
            className={kindMeta[k].className}
            style={{ width: `${(seconds[k] / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="distributionLegend">
        {visible.map(k => (
          <span key={k}><i className={kindMeta[k].className} />{kindMeta[k].label}<b>{(seconds[k] / 3600).toFixed(1)}h</b></span>
        ))}
      </div>
    </>
  );
}

function ActivityList({ activities, limit = 8 }: { activities: Activity[]; limit?: number }) {
  return (
    <div className="activityList">
      {activities.slice(0, limit).map(a => {
        const kind = workoutKind(a.sport, a.name);
        return (
          <div className="activityRow" key={a.id + a.date}>
            <i className={`activityMark ${kindMeta[kind].className}`} />
            <div>
              <b>{a.name}</b>
              <span>{dateOnly(a.date)} · {duration(a.movingTimeSec)} · {distance(a.distanceM)}</span>
            </div>
            <div className="activityMeta">
              <b>{fmt(a.load)}</b>
              <span>load</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CyclingExplorer({
  rides,
  metric,
  setMetric
}: {
  rides: Activity[];
  metric: CyclingMetric;
  setMetric: (m: CyclingMetric) => void;
}) {
  const chronological = [...rides].reverse();
  const endurance = chronological.filter(a =>
    typeof a.avgPower === "number" &&
    typeof a.avgHr === "number" &&
    (a.movingTimeSec || 0) >= 45 * 60
  );

  const map: Record<CyclingMetric, {
    label: string;
    unit: string;
    values: Array<number | null | undefined>;
    dates: string[];
  }> = {
    efficiency: {
      label: "Endurance efficiency",
      unit: "",
      values: endurance.map(a =>
        typeof a.avgPower === "number" && typeof a.avgHr === "number" && a.avgHr > 0
          ? a.avgPower / a.avgHr
          : null
      ),
      dates: endurance.map(a => dateOnly(a.date))
    },
    decoupling: {
      label: "Aerobic decoupling",
      unit: "%",
      values: chronological.map(a => a.decouplingPct),
      dates: chronological.map(a => dateOnly(a.date))
    },
    avgPower: {
      label: "Average power",
      unit: " W",
      values: chronological.map(a => a.avgPower),
      dates: chronological.map(a => dateOnly(a.date))
    },
    np: {
      label: "Normalized power",
      unit: " W",
      values: chronological.map(a => a.normalizedPower),
      dates: chronological.map(a => dateOnly(a.date))
    }
  };

  const active = map[metric];

  return (
    <section className="card explorerCard">
      <SectionHeading
        eyebrow="CYCLING TREND"
        title={active.label}
        action={
          <div className="segmented">
            {(Object.keys(map) as CyclingMetric[]).map(k => (
              <button key={k} className={metric === k ? "active" : ""} onClick={() => setMetric(k)}>
                {k === "efficiency" ? "Efficiency" : k === "decoupling" ? "Drift" : k === "avgPower" ? "Avg W" : "NP"}
              </button>
            ))}
          </div>
        }
      />

      <Sparkline
        values={active.values}
        dates={active.dates}
        label={active.label}
        unit={active.unit}
        connectGaps
        smooth
      />

      {metric === "efficiency" && (
        <p className="contextNote">Average watts divided by average HR on rides ≥45 min. Use it as a trend, not a standalone score.</p>
      )}
      {metric === "decoupling" && (
        <p className="contextNote">Lower aerobic drift at comparable endurance work is generally a useful durability signal.</p>
      )}
    </section>
  );
}

function UpcomingList({ planned }: { planned: PlannedEvent[] }) {
  if (!planned.length) return <div className="emptyState">No upcoming sessions returned.</div>;

  return (
    <div className="activityList">
      {planned.slice(0, 10).map(p => {
        const kind = eventKind(p);
        return (
          <div className="activityRow" key={p.id + p.start}>
            <i className={`activityMark ${kindMeta[kind].className}`} />
            <div>
              <b>{p.name}</b>
              <span>{dateOnly(p.start)} · {p.type || p.category || kindMeta[kind].label} · {duration(p.movingTimeSec)}</span>
            </div>
            <div className="activityMeta">
              <b>{fmt(p.load)}</b>
              <span>load</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GoalList({ data }: { data: DashboardData }) {
  const goals = data.stas?.goals || [];
  if (!goals.length) return <div className="emptyState">No goals snapshot.</div>;

  return (
    <div className="goalList">
      {goals.slice(0, 4).map((g, idx) => {
        const title = typeof g.title === "string" ? g.title : `Goal ${idx + 1}`;
        const date = typeof g.date === "string" ? g.date : null;
        return (
          <div className="goalRow" key={`${title}-${idx}`}>
            <span>{idx + 1}</span>
            <div><b>{title}</b>{date && <small>{date}</small>}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("Today");
  const [days, setDays] = useState(90);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedRecoveryDate, setSelectedRecoveryDate] = useState<string | null>(null);
  const [healthMetric, setHealthMetric] = useState<HealthMetric>("hrv");
  const [cyclingMetric, setCyclingMetric] = useState<CyclingMetric>("efficiency");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?days=${days}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Dashboard request failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dashboard request failed");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = window.setInterval(load, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [load]);

  const recoverySeries = useMemo(
    () => buildRecoverySeries(data?.wellness || []),
    [data]
  );

  useEffect(() => {
    const latest = recoverySeries.filter(x => x.score !== null).at(-1)?.date;
    if (latest && !selectedRecoveryDate) setSelectedRecoveryDate(latest);
  }, [recoverySeries, selectedRecoveryDate]);

  const rides = useMemo(() => data?.activities.filter(isRide) || [], [data]);
  const today = localIso();
  const upcoming = useMemo(
    () => data?.planned.filter(p => dateOnly(p.start) >= today).sort((a, b) => a.start.localeCompare(b.start)) || [],
    [data, today]
  );

  if (!data) {
    return (
      <main className="appShell">
        <div className="loadingState">
          <i />
          <b>{error ? "Could not load STAS" : "Loading STAS…"}</b>
          {error && <span>{error}</span>}
        </div>
      </main>
    );
  }

  const currentPoint = recoverySeries.filter(x => x.score !== null).at(-1) || null;
  const consistency = sleepConsistency(data.wellness);
  const weightTrend = weightTrendKg(data.wellness);
  const balance = loadBalance(data.aggregates.load7d, data.aggregates.load28d);
  const wkg =
    typeof data.current.ftp === "number" &&
    typeof data.current.weightKg === "number" &&
    data.current.weightKg > 0
      ? data.current.ftp / data.current.weightKg
      : null;

  const pageDate = new Intl.DateTimeFormat(undefined, {
    weekday: "short", day: "2-digit", month: "short"
  }).format(new Date());

  return (
    <main className="appShell">
      <header className="topBar">
        <div>
          <span>{pageDate}</span>
          <h1>STAS <em>9.4</em></h1>
        </div>
        <div className="topActions">
          <select value={days} onChange={(e: { target: { value: string } }) => setDays(Number(e.target.value))}>
            <option value={30}>30d</option>
            <option value={90}>90d</option>
            <option value={180}>180d</option>
            <option value={365}>1y</option>
          </select>
          <button onClick={load} disabled={loading} aria-label="Refresh">{loading ? "…" : "↻"}</button>
        </div>
      </header>

      {tab === "Today" && (
        <section className="screen homeScreen zenHome">
          <DailyScores data={data} recovery={currentPoint} />

          <WeeklyReview data={data} />

          <RecentTrainingCard activities={data.activities} />

          <MonthCard
            activities={data.activities}
            planned={data.planned}
            monthOffset={monthOffset}
            setMonthOffset={setMonthOffset}
            compact
          />
        </section>
      )}

      {tab === "Health" && (
        <section className="screen">
          <section className="insightCard">
            <SectionHeading eyebrow="HEALTH INTELLIGENCE" title="Recovery & trends" />
            <div className="insightGrid">
              <div>
                <span>Recovery</span>
                <b>{currentPoint?.score ?? "—"}</b>
                <small>{recoveryLabel(currentPoint?.score ?? null, currentPoint?.coverage ?? 0)}</small>
              </div>
              <div>
                <span>Sleep consistency</span>
                <b>{consistency ?? "—"}</b>
                <small>{consistency === null ? "Need more nights" : "presentation score"}</small>
              </div>
              <div>
                <span>Load balance</span>
                <b>{balance.ratio === null ? "—" : `${Math.round(balance.ratio * 100)}%`}</b>
                <small>{balance.label}</small>
              </div>
              <div>
                <span>Weight 28d</span>
                <b>{weightTrend === null ? "—" : `${weightTrend > 0 ? "+" : ""}${weightTrend.toFixed(1)} kg`}</b>
                <small>measured points only</small>
              </div>
            </div>
          </section>

          <HealthExplorer
            wellness={data.wellness}
            metric={healthMetric}
            setMetric={setHealthMetric}
            avgHrv7d={data.aggregates.avgHrv7d}
            avgRhr7d={data.aggregates.avgRestingHr7d}
            avgSleep7d={data.aggregates.avgSleepHours7d}
            avgWeight7d={data.aggregates.avgWeight7d}
          />

          <section className="card">
            <SectionHeading eyebrow="CURRENT" title="Body & recovery" />
            <div className="simpleMetrics">
              <div><span>HRV</span><b>{fmt(data.current.hrv)} ms</b><small>7d {fmt(data.aggregates.avgHrv7d, 1)}</small></div>
              <div><span>Resting HR</span><b>{fmt(data.current.restingHr)} bpm</b><small>7d {fmt(data.aggregates.avgRestingHr7d, 1)}</small></div>
              <div><span>Sleep</span><b>{fmt(data.current.sleepHours, 1)} h</b><small>score {fmt(data.current.sleepScore)}</small></div>
              <div><span>Weight</span><b>{fmt(data.current.weightKg, 1)} kg</b><small>7d {fmt(data.aggregates.avgWeight7d, 1)}</small></div>
            </div>
          </section>
        </section>
      )}

      {tab === "Training" && (
        <section className="screen">
          <section className="statusCard">
            <SectionHeading
              eyebrow="TRAINING STATUS"
              title="Load context"
              action={<span className="subtleTag">{balance.label}</span>}
            />
            <div className="statusTriplet">
              <div><span>Fitness</span><b>{fmt(data.current.fitness, 1)}</b></div>
              <div><span>Fatigue</span><b>{fmt(data.current.fatigue, 1)}</b></div>
              <div><span>Form</span><b>{fmt(data.current.form, 1)}</b></div>
            </div>
            <p>Fitness, Fatigue and Form describe load context. They are not an automatic readiness decision.</p>
          </section>

          <section className="card">
            <SectionHeading
              eyebrow="12 WEEKS"
              title="Training load"
              action={<span className="subtleTag">7d {Math.round(data.aggregates.load7d)} · 28d {Math.round(data.aggregates.load28d)}</span>}
            />
            <WeeklyLoadBars activities={data.activities} />
          </section>

          <section className="card">
            <SectionHeading eyebrow="LAST 28 DAYS" title="Where the time went" />
            <TrainingDistribution activities={data.activities} />
          </section>

          <section className="card">
            <SectionHeading eyebrow="RECENT" title="Sessions" />
            <ActivityList activities={data.activities} limit={10} />
          </section>
        </section>
      )}

      {tab === "Cycling" && (
        <section className="screen">
          <LatestRideHero ride={rides[0] || null} />

          <section className="performanceCard">
            <div>
              <span className="kicker">CYCLING</span>
              <h2>Performance</h2>
            </div>
            <div className="performanceNumbers">
              <div><span>FTP</span><b>{fmt(data.current.ftp)} W</b></div>
              <div><span>W/kg</span><b>{fmt(wkg, 2)}</b></div>
              <div><span>28d rides</span><b>{data.aggregates.rideSessions28d}</b></div>
              <div><span>28d time</span><b>{fmt(data.aggregates.bikeHours28d, 1)} h</b></div>
            </div>
          </section>

          <CyclingExplorer rides={rides} metric={cyclingMetric} setMetric={setCyclingMetric} />

          <section className="card">
            <SectionHeading eyebrow="RECENT" title="Rides" />
            <ActivityList activities={rides} limit={10} />
          </section>
        </section>
      )}

      {tab === "Plan" && (
        <section className="screen">
          <MonthCard
            activities={data.activities}
            planned={data.planned}
            monthOffset={monthOffset}
            setMonthOffset={setMonthOffset}
          />

          <section className="card">
            <SectionHeading eyebrow="UPCOMING" title="Next sessions" />
            <UpcomingList planned={upcoming} />
          </section>

          <section className="card">
            <SectionHeading eyebrow="GOALS" title="Direction" />
            <GoalList data={data} />
          </section>

          <section className="card sourcesCard">
            <SectionHeading eyebrow="DATA" title="Sources" />
            <div>
              <span>Intervals.icu</span>
              <b className={data.sources.intervals ? "good" : "bad"}>{data.sources.intervals ? "Connected" : "Unavailable"}</b>
            </div>
            <div>
              <span>Withings</span>
              <b className={data.sources.withings === "connected" ? "good" : ""}>{data.sources.withings.replaceAll("_", " ")}</b>
            </div>
          </section>
        </section>
      )}

      <nav className="bottomNav">
        {tabs.map(t => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            <span>{t.icon}</span>
            <b>{t.label}</b>
          </button>
        ))}
      </nav>
    </main>
  );
}
