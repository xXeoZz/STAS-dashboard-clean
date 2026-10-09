"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Sparkline from "@/components/Sparkline";
import type { Activity, DashboardData, WellnessDay } from "@/lib/types";

const tabs = ["Overview", "Health", "Training", "Cycling", "Calendar", "Goals & Rules", "Data"];

function fmt(v: number | null | undefined, digits = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";
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

function dateOnly(s: string) {
  return s ? s.slice(0, 10) : "—";
}

function isRide(a: Activity) {
  return /ride|cycling|bike|virtualride/i.test(a.sport);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  tone = "blue"
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  tone?: "blue" | "pink" | "green" | "orange" | "purple";
}) {
  return (
    <div className={`metricCard tone-${tone}`}>
      <div className="metricTop">
        <span className="metricIcon">{icon}</span>
        <span className="metricLabel">{label}</span>
      </div>
      <div className="metricValue">{value}</div>
      {sub && <div className="metricSub">{sub}</div>}
    </div>
  );
}

function RingMetric({
  label,
  value,
  detail,
  pct,
  tone = "blue"
}: {
  label: string;
  value: string;
  detail?: string;
  pct: number;
  tone?: "blue" | "pink" | "green" | "orange";
}) {
  const style = { "--ring-p": `${clamp(pct, 0, 100)}%` } as CSSProperties;

  return (
    <div className="ringMetric">
      <div className={`ring tone-${tone}`} style={style}>
        <div className="ringInner"><b>{value}</b></div>
      </div>
      <div>
        <b>{label}</b>
        {detail && <span>{detail}</span>}
      </div>
    </div>
  );
}

function HealthTable({ rows }: { rows: WellnessDay[] }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>HRV</th><th>RHR</th><th>Sleep</th><th>Sleep score</th><th>Steps</th>
            <th>Weight</th><th>Body fat</th><th>Muscle</th><th>Body Battery</th><th>Stress</th><th>SpO₂</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().slice(0, 30).map((w, i) => (
            <tr key={`${w.date}-${i}`}>
              <td>{w.date}</td>
              <td>{fmt(w.hrv)}</td>
              <td>{fmt(w.restingHr)}</td>
              <td>{fmt(w.sleepHours, 1)}h</td>
              <td>{fmt(w.sleepScore)}</td>
              <td>{fmt(w.steps)}</td>
              <td>{fmt(w.weightKg, 1)} kg</td>
              <td>{fmt(w.bodyFatPct, 1)}%</td>
              <td>{fmt(w.muscleMassKg, 1)} kg</td>
              <td>{fmt(w.bodyBattery)}</td>
              <td>{fmt(w.stress)}</td>
              <td>{fmt(w.spo2, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadBars({ activities }: { activities: Activity[] }) {
  const points = [...activities]
    .filter(a => typeof a.load === "number" && a.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-18);

  const max = Math.max(1, ...points.map(x => x.load || 0));
  if (!points.length) return <div className="empty">No recent load data</div>;

  return (
    <div className="loadChart" aria-label="Recent training load">
      {points.map((a, i) => {
        const h = 18 + ((a.load || 0) / max) * 82;
        return (
          <div className="loadBarWrap" key={`${a.id}-${i}`}>
            <div
              className="loadBar"
              style={{ height: `${h}%` }}
              title={`${dateOnly(a.date)} · ${a.name} · load ${fmt(a.load)}`}
            />
            <span>{new Date(`${dateOnly(a.date)}T12:00:00`).toLocaleDateString(undefined, { day: "numeric" })}</span>
          </div>
        );
      })}
    </div>
  );
}

function ScheduleStrip({ planned }: { planned: DashboardData["planned"] }) {
  const base = new Date();
  base.setHours(12, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = d.toISOString().slice(0, 10);

    return {
      iso,
      dow: d.toLocaleDateString(undefined, { weekday: "short" }),
      day: d.getDate(),
      has: planned.some(p => dateOnly(p.start) === iso)
    };
  });

  return (
    <div className="weekStrip">
      {days.map((d, i) => (
        <div key={d.iso} className={`dayDot ${d.has ? "planned" : ""} ${i === 0 ? "today" : ""}`}>
          <span>{d.dow}</span>
          <b>{d.day}</b>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState("Overview");
  const [days, setDays] = useState(90);
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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(load, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [load]);

  const rides = useMemo(() => data?.activities.filter(isRide) || [], [data]);
  const latestWellness = data?.wellness[data.wellness.length - 1];

  const avgWeeklyLoad28 = data ? data.aggregates.load28d / 4 : 0;
  const loadRatioPct =
    data && avgWeeklyLoad28 > 0
      ? clamp((data.aggregates.load7d / avgWeeklyLoad28) * 100, 0, 180)
      : 0;

  const hrvPct =
    data && data.aggregates.avgHrv7d && data.current.hrv
      ? clamp((data.current.hrv / data.aggregates.avgHrv7d) * 100, 0, 140)
      : 0;

  const sleepPct =
    data?.current.sleepHours
      ? clamp((data.current.sleepHours / 8) * 100, 0, 120)
      : 0;

  return (
    <main className="shell">
      <section className="hero">
        <div className="heroGlow glowOne" />
        <div className="heroGlow glowTwo" />

        <div className="heroContent">
          <div>
            <div className="eyebrow">Private endurance dashboard</div>
            <h1>STAS Training & Health</h1>
            <p>Live training, recovery, body weight and coaching context in one view.</p>
          </div>

          <div className="heroActions">
            <div className="windowPicker">
              <span>Window</span>
              <select value={days} onChange={e => setDays(Number(e.target.value))}>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>365 days</option>
              </select>
            </div>

            <button className="refreshButton" onClick={load} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh now"}
            </button>
          </div>
        </div>

        <div className="heroPills">
          <span className={data?.sources.intervals ? "sourcePill good" : "sourcePill bad"}>● Intervals</span>
          <span className={data?.sources.withings === "connected" ? "sourcePill good" : "sourcePill"}>● Withings</span>
          <span className="sourcePill">● Garmin via Intervals</span>
          {data && (
            <span className="sourcePill subtle">
              Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </section>

      {error && <div className="error">{error}</div>}
      {!data && !error && <div className="panel">Loading live data…</div>}

      {data && (
        <>
          <section className="visualMetrics">
            <MetricCard icon="↗" label="Fitness" value={fmt(data.current.fitness, 1)} sub="CTL / long-term load" tone="blue" />
            <MetricCard icon="⚡" label="Fatigue" value={fmt(data.current.fatigue, 1)} sub="ATL / short-term load" tone="orange" />
            <MetricCard icon="◌" label="Form" value={fmt(data.current.form, 1)} sub="Fitness minus fatigue" tone="green" />
            <MetricCard icon="♥" label="HRV" value={`${fmt(data.current.hrv)} ms`} sub={`7d avg ${fmt(data.aggregates.avgHrv7d, 1)}`} tone="pink" />
            <MetricCard icon="☾" label="Sleep" value={`${fmt(data.current.sleepHours, 1)} h`} sub={`score ${fmt(data.current.sleepScore)}`} tone="purple" />
            <MetricCard icon="⚖" label="Weight" value={`${fmt(data.current.weightKg, 1)} kg`} sub={`7d avg ${fmt(data.aggregates.avgWeight7d, 1)}`} tone="green" />
            <MetricCard icon="W" label="FTP" value={`${fmt(data.current.ftp)} W`} sub="Cycling threshold" tone="blue" />
            <MetricCard icon="●" label="Resting HR" value={`${fmt(data.current.restingHr)} bpm`} sub={`7d avg ${fmt(data.aggregates.avgRestingHr7d, 1)}`} tone="orange" />
          </section>

          <nav className="tabs">
            {tabs.map(t => (
              <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </nav>

          {tab === "Overview" && (
            <div className="overviewGrid">
              <section className="panel loadPanel">
                <div className="panelHeading">
                  <div><span className="panelKicker">Training load</span><h2>Recent workload</h2></div>
                  <span className="badge">{days}d view</span>
                </div>

                <div className="loadHeadline">
                  <b>{fmt(data.aggregates.load7d)}</b>
                  <span>7-day load</span>
                </div>

                <LoadBars activities={data.activities} />

                <div className="microStats">
                  <div><b>{data.aggregates.sessions7d}</b><span>sessions · 7d</span></div>
                  <div><b>{fmt(data.aggregates.load28d)}</b><span>load · 28d</span></div>
                  <div><b>{fmt(data.aggregates.bikeHours28d, 1)}h</b><span>cycling · 28d</span></div>
                </div>
              </section>

              <section className="panel readinessPanel">
                <div className="panelHeading">
                  <div><span className="panelKicker">Recovery context</span><h2>Current signals</h2></div>
                </div>

                <div className="rings">
                  <RingMetric label="Load vs 4wk avg" value={`${fmt(loadRatioPct)}%`} detail="7d relative load" pct={Math.min(loadRatioPct, 100)} tone="orange" />
                  <RingMetric label="HRV vs 7d" value={`${fmt(hrvPct)}%`} detail={`${fmt(data.current.hrv)} ms`} pct={Math.min(hrvPct, 100)} tone="pink" />
                  <RingMetric label="Sleep target" value={`${fmt(data.current.sleepHours, 1)}h`} detail="vs 8h reference" pct={Math.min(sleepPct, 100)} tone="blue" />
                </div>

                <div className="healthStrip">
                  <div><span>RHR</span><b>{fmt(data.current.restingHr)} bpm</b></div>
                  <div><span>Weight</span><b>{fmt(data.current.weightKg, 1)} kg</b></div>
                  <div><span>FTP</span><b>{fmt(data.current.ftp)} W</b></div>
                </div>
              </section>

              <section className="panel widePanel">
                <div className="panelHeading">
                  <div><span className="panelKicker">Health trend</span><h2>HRV</h2></div>
                  <span className="badge">7d avg {fmt(data.aggregates.avgHrv7d, 1)}</span>
                </div>

                <Sparkline
                  values={data.wellness.map(x => x.hrv)}
                  dates={data.wellness.map(x => x.date)}
                  label="HRV"
                  unit=" ms"
                  reference={data.aggregates.avgHrv7d}
                />
              </section>

              <section className="panel sidePanel">
                <div className="panelHeading">
                  <div><span className="panelKicker">Schedule</span><h2>Next 7 days</h2></div>
                </div>

                <ScheduleStrip planned={data.planned} />

                <div className="upcomingList">
                  {data.planned.length ? data.planned.slice(0, 4).map(p => (
                    <div className="compactSession" key={p.id + p.start}>
                      <span className="sessionDot" />
                      <div>
                        <b>{p.name}</b>
                        <span>{dateOnly(p.start)} · {duration(p.movingTimeSec)}</span>
                      </div>
                    </div>
                  )) : <div className="empty">No upcoming events returned.</div>}
                </div>
              </section>

              <section className="panel sessionsPanel">
                <div className="panelHeading">
                  <div><span className="panelKicker">Recent work</span><h2>Latest sessions</h2></div>
                  <button className="textButton" onClick={() => setTab("Training")}>See all</button>
                </div>

                <div className="sessionCards">
                  {data.activities.slice(0, 5).map(a => (
                    <div className="sessionCard" key={a.id + a.date}>
                      <div className="sessionSport">
                        {/ride/i.test(a.sport) ? "BIKE" : /weight|strength/i.test(a.sport) ? "GYM" : "MOVE"}
                      </div>
                      <div className="sessionInfo">
                        <b>{a.name}</b>
                        <span>{dateOnly(a.date)} · {duration(a.movingTimeSec)}</span>
                      </div>
                      <div className="sessionLoad">
                        <b>{fmt(a.load)}</b>
                        <span>load</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "Health" && (
            <div className="stack">
              <div className="chartGrid">
                <section className="panel">
                  <div className="panelHeading"><div><span className="panelKicker">Recovery</span><h2>HRV</h2></div></div>
                  <Sparkline values={data.wellness.map(x => x.hrv)} dates={data.wellness.map(x => x.date)} label="HRV" unit=" ms" reference={data.aggregates.avgHrv7d} />
                </section>

                <section className="panel">
                  <div className="panelHeading"><div><span className="panelKicker">Recovery</span><h2>Resting HR</h2></div></div>
                  <Sparkline values={data.wellness.map(x => x.restingHr)} dates={data.wellness.map(x => x.date)} label="Resting HR" unit=" bpm" reference={data.aggregates.avgRestingHr7d} />
                </section>

                <section className="panel">
                  <div className="panelHeading"><div><span className="panelKicker">Recovery</span><h2>Sleep duration</h2></div></div>
                  <Sparkline values={data.wellness.map(x => x.sleepHours)} dates={data.wellness.map(x => x.date)} label="Sleep duration" unit=" h" reference={data.aggregates.avgSleepHours7d} />
                </section>

                <section className="panel">
                  <div className="panelHeading"><div><span className="panelKicker">Body</span><h2>Weight</h2></div></div>
                  <Sparkline values={data.wellness.map(x => x.weightKg)} dates={data.wellness.map(x => x.date)} label="Weight" unit=" kg" reference={data.aggregates.avgWeight7d} />
                </section>

                {data.wellness.some(x => typeof x.bodyFatPct === "number") && (
                  <section className="panel">
                    <h2>Body fat</h2>
                    <Sparkline values={data.wellness.map(x => x.bodyFatPct)} dates={data.wellness.map(x => x.date)} label="Body fat" unit="%" />
                  </section>
                )}

                {data.wellness.some(x => typeof x.muscleMassKg === "number") && (
                  <section className="panel">
                    <h2>Muscle mass</h2>
                    <Sparkline values={data.wellness.map(x => x.muscleMassKg)} dates={data.wellness.map(x => x.date)} label="Muscle mass" unit=" kg" />
                  </section>
                )}
              </div>

              <section className="panel">
                <div className="panelHeading">
                  <div><span className="panelKicker">Garmin & Withings</span><h2>Wellness metrics</h2></div>
                </div>

                <div className="extras">
                  <div><span>Body Battery</span><b>{fmt(latestWellness?.bodyBattery)}</b></div>
                  <div><span>Stress</span><b>{fmt(latestWellness?.stress)}</b></div>
                  <div><span>SpO₂</span><b>{fmt(latestWellness?.spo2, 1)}</b></div>
                  <div><span>Respiration</span><b>{fmt(latestWellness?.respiration, 1)}</b></div>
                </div>

                {(data.sources.withings === "connected" || data.wellness.some(x => x.bodyFatPct != null || x.muscleMassKg != null)) && (
                  <>
                    <h3>Withings body composition</h3>
                    <div className="extras">
                      <div><span>Body fat</span><b>{fmt(data.current.bodyFatPct, 1)}%</b></div>
                      <div><span>Fat mass</span><b>{fmt(data.current.fatMassKg, 1)} kg</b></div>
                      <div><span>Muscle mass</span><b>{fmt(data.current.muscleMassKg, 1)} kg</b></div>
                      <div><span>Bone mass</span><b>{fmt(data.current.boneMassKg, 1)} kg</b></div>
                    </div>
                  </>
                )}

                {data.latestHealthExtras.length > 0 && (
                  <div className="extras spaceTop">
                    {data.latestHealthExtras.map(x => (
                      <div key={x.key}>
                        <span>{x.key}</span>
                        <b>{String(x.value ?? "—")}</b>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="panelHeading"><div><span className="panelKicker">History</span><h2>Daily health data</h2></div></div>
                <HealthTable rows={data.wellness} />
              </section>
            </div>
          )}

          {tab === "Training" && (
            <section className="panel">
              <div className="panelHeading"><div><span className="panelKicker">Sessions</span><h2>Training history</h2></div></div>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th><th>Sport</th><th>Session</th><th>Time</th><th>Distance</th><th>Load</th>
                      <th>HR</th><th>Power</th><th>NP</th><th>IF</th><th>Cadence</th><th>Drift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activities.map(a => (
                      <tr key={a.id + a.date}>
                        <td>{dateOnly(a.date)}</td>
                        <td>{a.sport}</td>
                        <td>{a.name}</td>
                        <td>{duration(a.movingTimeSec)}</td>
                        <td>{distance(a.distanceM)}</td>
                        <td>{fmt(a.load)}</td>
                        <td>{fmt(a.avgHr)}/{fmt(a.maxHr)}</td>
                        <td>{fmt(a.avgPower)} W</td>
                        <td>{fmt(a.normalizedPower)} W</td>
                        <td>{fmt(a.intensityFactor, 2)}</td>
                        <td>{fmt(a.cadence)}</td>
                        <td>{fmt(a.decouplingPct, 1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "Cycling" && (
            <div className="chartGrid">
              <section className="panel">
                <div className="panelHeading">
                  <div><span className="panelKicker">Cycling</span><h2>Summary</h2></div>
                  <span className="badge">{fmt(data.current.ftp)} W FTP</span>
                </div>

                <div className="microStats">
                  <div><b>{rides.length}</b><span>rides in window</span></div>
                  <div><b>{data.aggregates.rideSessions28d}</b><span>rides · 28d</span></div>
                  <div><b>{fmt(data.aggregates.bikeHours28d, 1)}h</b><span>bike time · 28d</span></div>
                </div>

                <h3>Average power trend</h3>
                <Sparkline
                  values={[...rides].reverse().map(x => x.avgPower)}
                  dates={[...rides].reverse().map(x => dateOnly(x.date))}
                  label="Average power"
                  unit=" W"
                />

                <h3>Normalized power trend</h3>
                <Sparkline
                  values={[...rides].reverse().map(x => x.normalizedPower)}
                  dates={[...rides].reverse().map(x => dateOnly(x.date))}
                  label="Normalized power"
                  unit=" W"
                />
              </section>

              <section className="panel">
                <div className="panelHeading"><div><span className="panelKicker">Cycling</span><h2>Recent rides</h2></div></div>
                {rides.slice(0, 12).map(a => (
                  <div className="rowCard" key={a.id + a.date}>
                    <div>
                      <b>{a.name}</b>
                      <span>{dateOnly(a.date)} · {duration(a.movingTimeSec)} · {distance(a.distanceM)}</span>
                    </div>
                    <div>{fmt(a.avgPower)} / {fmt(a.normalizedPower)} W</div>
                  </div>
                ))}
              </section>
            </div>
          )}

          {tab === "Calendar" && (
            <section className="panel">
              <div className="panelHeading"><div><span className="panelKicker">Plan</span><h2>Upcoming sessions</h2></div></div>

              {data.planned.length ? (
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Name</th><th>Type</th><th>Duration</th><th>Load</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      {data.planned.map(p => (
                        <tr key={p.id + p.start}>
                          <td>{dateOnly(p.start)}</td>
                          <td>{p.name}</td>
                          <td>{p.type || p.category || "—"}</td>
                          <td>{duration(p.movingTimeSec)}</td>
                          <td>{fmt(p.load)}</td>
                          <td className="desc">{p.description || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="empty">No planned events returned.</div>}
            </section>
          )}

          {tab === "Goals & Rules" && (
            <div className="chartGrid">
              <section className="panel">
                <div className="panelHeading"><div><span className="panelKicker">Direction</span><h2>Goals</h2></div></div>
                {data.stas?.goals?.length
                  ? data.stas.goals.map((g, i) => <pre className="context" key={i}>{JSON.stringify(g, null, 2)}</pre>)
                  : <div className="empty">No STAS goals snapshot.</div>}
              </section>

              <section className="panel">
                <div className="panelHeading"><div><span className="panelKicker">Guardrails</span><h2>Rules</h2></div></div>
                {data.stas?.rules?.length
                  ? <ul>{data.stas.rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  : <div className="empty">No STAS rules snapshot.</div>}

                <h2 className="spaceTop">Strategy</h2>
                <div className="strategy">{data.stas?.strategy || "No STAS strategy snapshot."}</div>
              </section>
            </div>
          )}

          {tab === "Data" && (
            <div className="chartGrid">
              <section className="panel">
                <div className="panelHeading"><div><span className="panelKicker">Connections</span><h2>Source coverage</h2></div></div>

                <div className="source"><b>Intervals.icu</b><span>{data.sources.intervals ? "Connected" : "Unavailable"}</span></div>
                <div className="source"><b>STAS context</b><span>{data.sources.stasContext}</span></div>
                <div className="source"><b>Direct Garmin provider</b><span>{data.sources.garminDirect ? "Connected" : "Optional / not configured"}</span></div>
                <div className="source"><b>Withings</b><span>{data.sources.withings.replaceAll("_", " ")}</span></div>

                {data.sources.withings !== "connected" && (
                  <a className="connectButton" href="/api/withings/connect">Connect Withings</a>
                )}

                {data.sources.withings === "connected" && (
                  <button
                    className="secondaryButton"
                    onClick={async () => {
                      await fetch("/api/withings/disconnect", { method: "POST" });
                      await load();
                    }}
                  >
                    Disconnect Withings
                  </button>
                )}

                <p className="muted">
                  Garmin wellness is read through Intervals when available. Withings is preferred for weight/body composition.
                </p>
              </section>

              <section className="panel">
                <div className="panelHeading"><div><span className="panelKicker">Diagnostics</span><h2>Loaded data</h2></div></div>

                {data.sources.notes.length
                  ? <ul>{data.sources.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                  : <div className="okText">No source errors reported.</div>}

                <div className="microStats spaceTop">
                  <div><b>{data.activities.length}</b><span>activities</span></div>
                  <div><b>{data.wellness.length}</b><span>wellness days</span></div>
                  <div><b>{data.planned.length}</b><span>planned events</span></div>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
