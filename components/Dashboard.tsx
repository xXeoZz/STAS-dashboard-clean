"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Sparkline from "@/components/Sparkline";
import type { Activity, DashboardData, PlannedEvent, WellnessDay } from "@/lib/types";

type Tab = "Today" | "Health" | "Training" | "Cycling" | "Plan";
type WorkoutKind = "rest" | "hiit" | "strength" | "cycling" | "running" | "other";

const tabs: Array<{ key: Tab; label: string; icon: string }> = [
  { key: "Today", label: "Today", icon: "◉" },
  { key: "Health", label: "Health", icon: "♥" },
  { key: "Training", label: "Training", icon: "↗" },
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

const fmt = (v: number | null | undefined, digits = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";

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

function hours(sec?: number | null) {
  return typeof sec === "number" ? sec / 3600 : 0;
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

function Donut({ score, label = "recovery" }: { score: number | null; label?: string }) {
  const style = { "--score": `${score == null ? 0 : clamp(score)}%` } as CSSProperties;
  return (
    <div className="donut" style={style}>
      <div className="donutCore">
        <b>{score ?? "—"}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  tone
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  tone?: WorkoutKind | "health";
}) {
  return (
    <div className={`metric ${tone ? `metric-${tone}` : ""}`}>
      <span className="metricIcon">{icon}</span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
        {sub && <em>{sub}</em>}
      </div>
    </div>
  );
}

function TrendChip({
  current,
  reference,
  unit = "",
  reverse = false
}: {
  current?: number | null;
  reference?: number | null;
  unit?: string;
  reverse?: boolean;
}) {
  if (typeof current !== "number" || typeof reference !== "number") return <span className="trendChip neutral">No baseline</span>;
  const delta = current - reference;
  const improved = reverse ? delta < 0 : delta > 0;
  const near = Math.abs(delta) < Math.max(0.5, Math.abs(reference) * 0.015);
  return (
    <span className={`trendChip ${near ? "neutral" : improved ? "up" : "down"}`}>
      {near ? "≈" : delta > 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(Math.abs(delta) >= 10 ? 0 : 1)}{unit}
    </span>
  );
}

function RecoveryHistory({
  data,
  selectedDate,
  setSelectedDate
}: {
  data: DashboardData;
  selectedDate: string | null;
  setSelectedDate: (d: string) => void;
}) {
  const recoveryDates = data.wellness
    .filter(w => w.date && (
      typeof w.hrv === "number" ||
      typeof w.restingHr === "number" ||
      typeof w.sleepHours === "number" ||
      typeof w.sleepScore === "number"
    ))
    .map(w => w.date)
    .sort();

  const effectiveDate =
    selectedDate && recoveryDates.includes(selectedDate)
      ? selectedDate
      : recoveryDates.at(-1) || null;

  const wellness = effectiveDate
    ? data.wellness.find(w => w.date === effectiveDate) || null
    : null;

  const idx = effectiveDate ? recoveryDates.indexOf(effectiveDate) : -1;

  const trailingRows = effectiveDate
    ? data.wellness.filter(w => {
        const end = new Date(`${effectiveDate}T12:00:00`);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        const d = new Date(`${w.date}T12:00:00`);
        return d >= start && d <= end;
      })
    : [];

  const hrv7 = average(trailingRows.map(w => w.hrv));
  const rhr7 = average(trailingRows.map(w => w.restingHr));

  const sleepScore =
    wellness && typeof wellness.sleepScore === "number"
      ? Math.round(clamp(wellness.sleepScore))
      : wellness && typeof wellness.sleepHours === "number"
        ? Math.round(clamp((wellness.sleepHours / 8) * 85, 45, 100))
        : null;

  const hrvScore =
    wellness && typeof wellness.hrv === "number" && typeof hrv7 === "number" && hrv7 > 0
      ? Math.round(clamp((wellness.hrv / hrv7) * 85, 45, 100))
      : null;

  const rhrScore =
    wellness && typeof wellness.restingHr === "number" && typeof rhr7 === "number" && wellness.restingHr > 0
      ? Math.round(clamp((rhr7 / wellness.restingHr) * 85, 45, 100))
      : null;

  const bits = [sleepScore, hrvScore, rhrScore].filter((x): x is number => x !== null);
  const score = bits.length ? Math.round(bits.reduce((a, b) => a + b, 0) / bits.length) : null;

  const label = effectiveDate
    ? new Date(`${effectiveDate}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short"
      })
    : "No data";

  return (
    <section className="heroCard">
      <div className="recoveryTop">
        <div>
          <small>DAILY RECOVERY</small>
          <b>{label}</b>
        </div>
        <div className="dateNav">
          <button
            onClick={() => idx > 0 && setSelectedDate(recoveryDates[idx - 1])}
            disabled={idx <= 0}
            aria-label="Previous recovery day"
          >
            ‹
          </button>
          <button
            className="todayButton"
            onClick={() => recoveryDates.length && setSelectedDate(recoveryDates[recoveryDates.length - 1])}
            disabled={idx === recoveryDates.length - 1}
          >
            Latest
          </button>
          <button
            onClick={() => idx >= 0 && idx < recoveryDates.length - 1 && setSelectedDate(recoveryDates[idx + 1])}
            disabled={idx < 0 || idx >= recoveryDates.length - 1}
            aria-label="Next recovery day"
          >
            ›
          </button>
        </div>
      </div>

      <Donut score={score} />

      <h2>
        {score != null && score >= 80
          ? "Strong recovery signals"
          : score != null && score >= 65
            ? "Moderate recovery signals"
            : "Recovery signals are subdued"}
      </h2>
      <p>Sleep, HRV and resting heart rate for this date, compared with its own trailing 7-day context.</p>

      <div className="signals">
        <div>
          <span>♥ HRV</span>
          <b>{fmt(wellness?.hrv)} ms</b>
          <TrendChip current={wellness?.hrv} reference={hrv7} unit=" ms" />
        </div>
        <div>
          <span>● RHR</span>
          <b>{fmt(wellness?.restingHr)} bpm</b>
          <TrendChip current={wellness?.restingHr} reference={rhr7} unit=" bpm" reverse />
        </div>
        <div>
          <span>☾ Sleep</span>
          <b>{fmt(wellness?.sleepHours, 1)} h</b>
          <small>score {fmt(wellness?.sleepScore)}</small>
        </div>
      </div>
    </section>
  );
}

function TodayWorkout({ planned }: { planned: PlannedEvent[] }) {
  const today = localIso();
  const todayEvents = planned.filter(p => dateOnly(p.start) === today);

  return (
    <section className="card todayWorkoutCard">
      <div className="title">
        <div>
          <small>TODAY</small>
          <h3>{todayEvents.length ? "Planned training" : "No workout scheduled"}</h3>
        </div>
        <span className={`statusPill ${todayEvents.length ? "plannedStatus" : "restStatus"}`}>
          {todayEvents.length ? "Planned" : "Open"}
        </span>
      </div>

      {todayEvents.length ? (
        <div className="todayWorkoutList">
          {todayEvents.map(p => {
            const kind = eventKind(p);
            return (
              <div className="todayWorkout" key={p.id + p.start}>
                <span className={`workoutOrb ${kindMeta[kind].className}`} />
                <div>
                  <b>{p.name}</b>
                  <span>{p.type || p.category || kindMeta[kind].label} · {duration(p.movingTimeSec)}</span>
                  {p.description && <small>{p.description.split("\n")[0]}</small>}
                </div>
                <em>{fmt(p.load)}<small>load</small></em>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="softCopy">No planned session is returned for today. That is not automatically a rest prescription.</p>
      )}
    </section>
  );
}

function MonthlyTrainingCalendar({
  activities,
  planned,
  monthOffset,
  onMonthOffset
}: {
  activities: Activity[];
  planned: PlannedEvent[];
  monthOffset: number;
  onMonthOffset: (next: number) => void;
}) {
  const now = new Date();
  const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const today = localIso();

  const activityByDate = new Map<string, Activity[]>();
  for (const a of activities) {
    const iso = dateOnly(a.date);
    const d = new Date(`${iso}T12:00:00`);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    activityByDate.set(iso, [...(activityByDate.get(iso) || []), a]);
  }

  const planByDate = new Map<string, PlannedEvent[]>();
  for (const p of planned) {
    const iso = dateOnly(p.start);
    const d = new Date(`${iso}T12:00:00`);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    planByDate.set(iso, [...(planByDate.get(iso) || []), p]);
  }

  const summary: Record<WorkoutKind, number> = {
    rest: 0, hiit: 0, strength: 0, cycling: 0, running: 0, other: 0
  };
  let totalSeconds = 0;
  let totalLoad = 0;

  for (const a of activities) {
    const iso = dateOnly(a.date);
    const d = new Date(`${iso}T12:00:00`);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    summary[workoutKind(a.sport, a.name)] += 1;
    totalSeconds += a.movingTimeSec || 0;
    totalLoad += a.load || 0;
  }

  for (const p of planned) {
    const iso = dateOnly(p.start);
    const d = new Date(`${iso}T12:00:00`);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    if (eventKind(p) === "rest") summary.rest += 1;
  }

  const cells: Array<{
    key: string;
    day?: number;
    iso?: string;
    kinds?: WorkoutKind[];
    plannedOnly?: boolean;
    explicitRest?: boolean;
  }> = [];

  for (let i = 0; i < mondayOffset; i++) cells.push({ key: `blank-start-${i}` });

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = localIso(new Date(year, month, day, 12));
    const actual = activityByDate.get(iso) || [];
    const plan = planByDate.get(iso) || [];
    const actualKinds = [...new Set(actual.map(a => workoutKind(a.sport, a.name)))];
    const planKinds = [...new Set(plan.map(eventKind))];
    const explicitRest = planKinds.includes("rest");
    const kinds = actualKinds.length ? actualKinds : planKinds.filter(k => k !== "rest");

    cells.push({
      key: iso,
      day,
      iso,
      kinds,
      plannedOnly: actual.length === 0 && plan.some(p => eventKind(p) !== "rest"),
      explicitRest
    });
  }

  while (cells.length % 7 !== 0) cells.push({ key: `blank-end-${cells.length}` });

  return (
    <section className="card calendarCard">
      <div className="monthHeader">
        <div>
          <small>MONTHLY REPORT</small>
          <h3>Training calendar</h3>
        </div>
        <div className="monthControls">
          <button onClick={() => onMonthOffset(monthOffset - 1)} aria-label="Previous month">‹</button>
          <span>{monthLabel}</span>
          <button
            onClick={() => onMonthOffset(monthOffset + 1)}
            aria-label="Next month"
            disabled={monthOffset >= 0}
          >
            ›
          </button>
        </div>
      </div>

      <div className="calendarLegend">
        {(["rest", "hiit", "strength", "cycling", "running"] as WorkoutKind[]).map(k => (
          <span key={k}>
            <i className={kindMeta[k].className} />
            {kindMeta[k].label}
          </span>
        ))}
      </div>

      <div className="weekdayRow">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <span key={d}>{d}</span>)}
      </div>

      <div className="monthGrid">
        {cells.map(cell => {
          if (!cell.day || !cell.iso) return <div className="monthCell blank" key={cell.key} />;

          const kinds = cell.kinds || [];
          const primary = cell.explicitRest ? "rest" : kinds[0] || "other";
          const neutral = !cell.explicitRest && kinds.length === 0;
          const classes = [
            "monthCell",
            neutral ? "noData" : kindMeta[primary].className,
            cell.iso === today ? "isToday" : "",
            cell.plannedOnly ? "plannedOnly" : ""
          ].filter(Boolean).join(" ");

          return (
            <div
              className={classes}
              key={cell.key}
              title={
                cell.explicitRest
                  ? `${cell.iso} · Rest`
                  : kinds.length
                    ? `${cell.iso} · ${kinds.map(k => kindMeta[k].label).join(", ")}${cell.plannedOnly ? " (planned)" : ""}`
                    : `${cell.iso} · No workout recorded`
              }
            >
              <b>{cell.day}</b>
              <div className="kindDots">
                {(cell.explicitRest ? (["rest"] as WorkoutKind[]) : kinds).slice(0, 3).map((k, idx) => (
                  <i key={`${k}-${idx}`} className={kindMeta[k].className} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="monthReport">
        <span><i className="kindCycling" /> Cycling <b>{summary.cycling}</b></span>
        <span><i className="kindStrength" /> Strength <b>{summary.strength}</b></span>
        <span><i className="kindHiit" /> HIIT <b>{summary.hiit}</b></span>
        <span><i className="kindRunning" /> Running <b>{summary.running}</b></span>
        <span><i className="kindRest" /> Rest <b>{summary.rest}</b></span>
      </div>

      <div className="monthTotals">
        <b>{(totalSeconds / 3600).toFixed(1)}h</b><span>training time</span>
        <b>{Math.round(totalLoad)}</b><span>load</span>
      </div>

      <div className="calendarNote">Solid = completed · faded = planned · grey rest only when explicitly recorded · blank = no workout recorded</div>
    </section>
  );
}

function ThisWeek({ activities, planned }: { activities: Activity[]; planned: PlannedEvent[] }) {
  const now = new Date();
  const monday = new Date(now);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const weekActivities = activities.filter(a => new Date(a.date) >= monday);
  const weekEvents = planned.filter(p => new Date(p.start) >= monday && new Date(p.start) <= now);

  const totalSec = weekActivities.reduce((s, a) => s + (a.movingTimeSec || 0), 0);
  const load = weekActivities.reduce((s, a) => s + (a.load || 0), 0);
  const kinds = weekActivities.map(a => workoutKind(a.sport, a.name));
  const explicitRest = weekEvents.filter(p => eventKind(p) === "rest").length;

  return (
    <section className="card">
      <div className="title">
        <div>
          <small>THIS WEEK</small>
          <h3>Training summary</h3>
        </div>
        <span className="pill">Mon → today</span>
      </div>

      <div className="weekSummary">
        <div><b>{(totalSec / 3600).toFixed(1)}h</b><span>training</span></div>
        <div><b>{Math.round(load)}</b><span>load</span></div>
        <div><b>{kinds.filter(k => k === "cycling").length}</b><span>rides</span></div>
        <div><b>{kinds.filter(k => k === "strength").length}</b><span>strength</span></div>
        <div><b>{kinds.filter(k => k === "hiit").length}</b><span>HIIT</span></div>
        <div><b>{explicitRest}</b><span>rest notes</span></div>
      </div>
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
    <div className="weeklyBars">
      {weeks.map((w, idx) => (
        <div className="weeklyBarCol" key={`${w.label}-${idx}`} title={`${w.label}: load ${Math.round(w.load)}`}>
          <div className="weeklyBar" style={{ height: `${Math.max(5, (w.load / max) * 100)}%` }} />
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
    <div>
      <div className="distributionBar">
        {visible.map(k => (
          <i
            key={k}
            className={kindMeta[k].className}
            style={{ width: `${(seconds[k] / total) * 100}%` }}
            title={`${kindMeta[k].label}: ${(seconds[k] / 3600).toFixed(1)}h`}
          />
        ))}
      </div>
      <div className="distributionLegend">
        {visible.map(k => (
          <span key={k}><i className={kindMeta[k].className} />{kindMeta[k].label} <b>{(seconds[k] / 3600).toFixed(1)}h</b></span>
        ))}
      </div>
    </div>
  );
}

function ActivityList({ activities, limit }: { activities: Activity[]; limit?: number }) {
  const rows = typeof limit === "number" ? activities.slice(0, limit) : activities;
  return (
    <div className="list">
      {rows.map(a => {
        const kind = workoutKind(a.sport, a.name);
        return (
          <div className="session detailed" key={a.id + a.date}>
            <strong className={kindMeta[kind].className}>{kindMeta[kind].label.toUpperCase()}</strong>
            <div>
              <b>{a.name}</b>
              <span>{dateOnly(a.date)} · {duration(a.movingTimeSec)} · {distance(a.distanceM)}</span>
              <small>
                {typeof a.avgHr === "number" ? `${fmt(a.avgHr)} bpm` : "HR —"}
                {" · "}
                {typeof a.avgPower === "number" ? `${fmt(a.avgPower)} W` : "Power —"}
                {typeof a.normalizedPower === "number" ? ` · NP ${fmt(a.normalizedPower)} W` : ""}
              </small>
            </div>
            <em><b>{fmt(a.load)}</b><span>load</span></em>
          </div>
        );
      })}
    </div>
  );
}

function GoalCards({ data }: { data: DashboardData }) {
  const goals = data.stas?.goals || [];
  if (!goals.length) return <div className="empty">No goals snapshot.</div>;

  return (
    <div className="goalGrid">
      {goals.map((g, idx) => {
        const title = typeof g.title === "string" ? g.title : `Goal ${idx + 1}`;
        const date = typeof g.date === "string" ? g.date : null;
        const direction = typeof g.direction === "string" ? g.direction : null;
        return (
          <div className="goalCard" key={`${title}-${idx}`}>
            <span>GOAL {idx + 1}</span>
            <b>{title}</b>
            {date && <small>{date}</small>}
            {direction && <p>{direction}</p>}
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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

  const rides = useMemo(() => data?.activities.filter(isRide) || [], [data]);
  const today = localIso();
  const upcoming = useMemo(
    () => data?.planned.filter(p => dateOnly(p.start) >= today).sort((a, b) => a.start.localeCompare(b.start)) || [],
    [data, today]
  );

  if (!data) {
    return (
      <main className="appShell">
        <div className="loading">
          <div className="pulse" />
          <b>{error ? "Could not load dashboard" : "Loading STAS…"}</b>
          {error && <span>{error}</span>}
        </div>
      </main>
    );
  }

  const latestWellness = data.wellness.at(-1);
  const wkg =
    typeof data.current.ftp === "number" && typeof data.current.weightKg === "number" && data.current.weightKg > 0
      ? data.current.ftp / data.current.weightKg
      : null;

  const enduranceRides = rides.filter(a =>
    typeof a.avgPower === "number" &&
    typeof a.avgHr === "number" &&
    (a.movingTimeSec || 0) >= 45 * 60
  );

  const efficiencyValues = enduranceRides.map(a =>
    typeof a.avgPower === "number" && typeof a.avgHr === "number" && a.avgHr > 0
      ? a.avgPower / a.avgHr
      : null
  );

  const pageDate = new Intl.DateTimeFormat(undefined, {
    weekday: "short", day: "2-digit", month: "short"
  }).format(new Date());

  return (
    <main className="appShell">
      <header className="appHeader">
        <div>
          <span>{pageDate}</span>
          <h1>STAS <em>v9</em></h1>
        </div>

        <div className="headerActions">
          <select value={days} onChange={(e: { target: { value: string } }) => setDays(Number(e.target.value))} aria-label="History window">
            <option value={30}>30d</option>
            <option value={90}>90d</option>
            <option value={180}>180d</option>
            <option value={365}>1y</option>
          </select>
          <button onClick={load} disabled={loading} aria-label="Refresh">{loading ? "…" : "↻"}</button>
        </div>
      </header>

      {tab === "Today" && (
        <section className="screen todayScreen">
          <RecoveryHistory data={data} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
          <TodayWorkout planned={upcoming} />

          <MonthlyTrainingCalendar
            activities={data.activities}
            planned={data.planned}
            monthOffset={monthOffset}
            onMonthOffset={setMonthOffset}
          />

          <ThisWeek activities={data.activities} planned={data.planned} />

          <section className="card">
            <div className="title">
              <div><small>TRAINING STATUS</small><h3>Load state</h3></div>
              <span className="pill">Context, not a readiness verdict</span>
            </div>
            <div className="metrics trainingMetrics">
              <Metric icon="↗" label="Fitness" value={fmt(data.current.fitness, 1)} />
              <Metric icon="⚡" label="Fatigue" value={fmt(data.current.fatigue, 1)} />
              <Metric icon="◌" label="Form" value={fmt(data.current.form, 1)} />
              <Metric icon="W" label="FTP" value={`${fmt(data.current.ftp)} W`} />
            </div>
          </section>

          <section className="card">
            <div className="title"><div><small>BODY & HEALTH</small><h3>Current picture</h3></div></div>
            <div className="metrics">
              <Metric icon="⚖" label="Weight" value={`${fmt(data.current.weightKg, 1)} kg`} sub={`7d avg ${fmt(data.aggregates.avgWeight7d, 1)}`} tone="health" />
              <Metric icon="♥" label="HRV" value={`${fmt(data.current.hrv)} ms`} sub={`7d avg ${fmt(data.aggregates.avgHrv7d, 1)}`} tone="health" />
              <Metric icon="●" label="Resting HR" value={`${fmt(data.current.restingHr)} bpm`} sub={`7d avg ${fmt(data.aggregates.avgRestingHr7d, 1)}`} tone="health" />
              <Metric icon="☾" label="Sleep" value={`${fmt(data.current.sleepHours, 1)} h`} sub={`score ${fmt(data.current.sleepScore)}`} tone="health" />
            </div>
          </section>

          <section className="card">
            <div className="title">
              <div><small>RECENT TRAINING</small><h3>Latest sessions</h3></div>
              <button className="link" onClick={() => setTab("Training")}>See all</button>
            </div>
            <ActivityList activities={data.activities} limit={4} />
          </section>
        </section>
      )}

      {tab === "Health" && (
        <section className="screen twoColScreen">
          <section className="card">
            <div className="title"><div><small>RECOVERY</small><h3>HRV trend</h3></div></div>
            <Sparkline
              values={data.wellness.map(x => x.hrv)}
              dates={data.wellness.map(x => x.date)}
              label="HRV"
              unit=" ms"
              reference={data.aggregates.avgHrv7d}
              connectGaps
              smooth
            />
          </section>

          <section className="card">
            <div className="title"><div><small>RECOVERY</small><h3>Resting HR</h3></div></div>
            <Sparkline
              values={data.wellness.map(x => x.restingHr)}
              dates={data.wellness.map(x => x.date)}
              label="Resting HR"
              unit=" bpm"
              reference={data.aggregates.avgRestingHr7d}
              connectGaps
              smooth
            />
          </section>

          <section className="card">
            <div className="title"><div><small>SLEEP</small><h3>Duration</h3></div></div>
            <Sparkline
              values={data.wellness.map(x => x.sleepHours)}
              dates={data.wellness.map(x => x.date)}
              label="Sleep"
              unit=" h"
              reference={data.aggregates.avgSleepHours7d}
              connectGaps
              smooth
            />
          </section>

          <section className="card">
            <div className="title"><div><small>BODY</small><h3>Weight trend</h3></div></div>
            <Sparkline
              values={data.wellness.map(x => x.weightKg)}
              dates={data.wellness.map(x => x.date)}
              label="Weight"
              unit=" kg"
              reference={data.aggregates.avgWeight7d}
              connectGaps
              smooth
            />
          </section>

          <section className="card spanAll">
            <div className="title"><div><small>WELLNESS</small><h3>Current metrics</h3></div></div>
            <div className="metrics">
              <Metric icon="◉" label="Body Battery" value={fmt(latestWellness?.bodyBattery)} tone="health" />
              <Metric icon="⚡" label="Stress" value={fmt(latestWellness?.stress)} tone="health" />
              <Metric icon="O₂" label="SpO₂" value={`${fmt(latestWellness?.spo2, 1)}%`} tone="health" />
              <Metric icon="↟" label="Respiration" value={fmt(latestWellness?.respiration, 1)} tone="health" />
            </div>
          </section>
        </section>
      )}

      {tab === "Training" && (
        <section className="screen">
          <section className="card">
            <div className="title">
              <div><small>TRAINING LOAD</small><h3>12-week load</h3></div>
              <span className="pill">7d {Math.round(data.aggregates.load7d)} · 28d {Math.round(data.aggregates.load28d)}</span>
            </div>
            <WeeklyLoadBars activities={data.activities} />
          </section>

          <section className="card">
            <div className="title"><div><small>DISTRIBUTION</small><h3>Last 28 days</h3></div></div>
            <TrainingDistribution activities={data.activities} />
          </section>

          <section className="card">
            <div className="title"><div><small>TRAINING STATUS</small><h3>Fitness · fatigue · form</h3></div></div>
            <div className="metrics trainingMetrics">
              <Metric icon="↗" label="Fitness" value={fmt(data.current.fitness, 1)} />
              <Metric icon="⚡" label="Fatigue" value={fmt(data.current.fatigue, 1)} />
              <Metric icon="◌" label="Form" value={fmt(data.current.form, 1)} />
              <Metric icon="◉" label="Sessions 28d" value={`${data.aggregates.sessions28d}`} />
            </div>
          </section>

          <section className="card">
            <div className="title"><div><small>HISTORY</small><h3>Recent sessions</h3></div></div>
            <ActivityList activities={data.activities} />
          </section>
        </section>
      )}

      {tab === "Cycling" && (
        <section className="screen twoColScreen">
          <section className="card accent spanAll">
            <div className="title">
              <div><small>CYCLING</small><h3>Performance snapshot</h3></div>
              <span className="pill">{fmt(data.current.ftp)} W FTP</span>
            </div>
            <div className="metrics cyclingMetrics">
              <Metric icon="W" label="FTP" value={`${fmt(data.current.ftp)} W`} tone="cycling" />
              <Metric icon="⚖" label="W/kg" value={fmt(wkg, 2)} tone="cycling" />
              <Metric icon="◉" label="Rides 28d" value={`${data.aggregates.rideSessions28d}`} tone="cycling" />
              <Metric icon="↗" label="Bike time 28d" value={`${fmt(data.aggregates.bikeHours28d, 1)} h`} tone="cycling" />
            </div>
          </section>

          <section className="card">
            <div className="title"><div><small>POWER</small><h3>Average power</h3></div></div>
            <Sparkline
              values={[...rides].reverse().map(x => x.avgPower)}
              dates={[...rides].reverse().map(x => dateOnly(x.date))}
              label="Average power"
              unit=" W"
              connectGaps
              smooth
            />
          </section>

          <section className="card">
            <div className="title"><div><small>POWER</small><h3>Normalized power</h3></div></div>
            <Sparkline
              values={[...rides].reverse().map(x => x.normalizedPower)}
              dates={[...rides].reverse().map(x => dateOnly(x.date))}
              label="Normalized power"
              unit=" W"
              connectGaps
              smooth
            />
          </section>

          <section className="card">
            <div className="title"><div><small>EFFICIENCY</small><h3>Power / HR</h3></div></div>
            <Sparkline
              values={[...efficiencyValues].reverse()}
              dates={[...enduranceRides].reverse().map(x => dateOnly(x.date))}
              label="Power per heartbeat"
              unit=""
              connectGaps
              smooth
            />
            <p className="softCopy">Simple endurance efficiency: average watts divided by average HR for rides ≥45 min.</p>
          </section>

          <section className="card">
            <div className="title"><div><small>DURABILITY</small><h3>Aerobic decoupling</h3></div></div>
            <Sparkline
              values={[...rides].reverse().map(x => x.decouplingPct)}
              dates={[...rides].reverse().map(x => dateOnly(x.date))}
              label="Aerobic decoupling"
              unit="%"
              connectGaps
              smooth
            />
            <p className="softCopy">Lower drift at comparable endurance work is generally a useful durability signal.</p>
          </section>

          <section className="card spanAll">
            <div className="title"><div><small>RIDES</small><h3>Recent cycling</h3></div></div>
            <ActivityList activities={rides} limit={12} />
          </section>
        </section>
      )}

      {tab === "Plan" && (
        <section className="screen">
          <section className="card">
            <div className="title"><div><small>UPCOMING</small><h3>Next sessions</h3></div></div>
            <div className="list">
              {upcoming.slice(0, 12).map(p => {
                const kind = eventKind(p);
                return (
                  <div className="session detailed" key={p.id + p.start}>
                    <strong className={kindMeta[kind].className}>{kindMeta[kind].label.toUpperCase()}</strong>
                    <div>
                      <b>{p.name}</b>
                      <span>{dateOnly(p.start)} · {p.type || p.category || kindMeta[kind].label} · {duration(p.movingTimeSec)}</span>
                      {p.description && <small>{p.description}</small>}
                    </div>
                    <em><b>{fmt(p.load)}</b><span>load</span></em>
                  </div>
                );
              })}
              {!upcoming.length && <div className="empty">No upcoming sessions returned.</div>}
            </div>
          </section>

          <section className="card">
            <div className="title"><div><small>GOALS</small><h3>Direction</h3></div></div>
            <GoalCards data={data} />
          </section>

          <section className="card">
            <div className="title"><div><small>CONNECTIONS</small><h3>Data sources</h3></div></div>
            <div className="connections">
              <div><span>Intervals.icu</span><b className={data.sources.intervals ? "goodText" : "badText"}>{data.sources.intervals ? "Connected" : "Unavailable"}</b></div>
              <div><span>Withings</span><b className={data.sources.withings === "connected" ? "goodText" : ""}>{data.sources.withings.replaceAll("_", " ")}</b></div>
              <div><span>STAS context</span><b>{data.sources.stasContext}</b></div>
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
