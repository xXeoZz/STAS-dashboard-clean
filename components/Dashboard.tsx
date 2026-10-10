"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Sparkline from "@/components/Sparkline";
import type { Activity, DashboardData } from "@/lib/types";

type Tab = "Today" | "Health" | "Training" | "Cycling" | "Plan";
const tabs: Array<{key:Tab; label:string; icon:string}> = [
  {key:"Today",label:"Today",icon:"◉"},
  {key:"Health",label:"Health",icon:"♥"},
  {key:"Training",label:"Training",icon:"↗"},
  {key:"Cycling",label:"Cycling",icon:"◌"},
  {key:"Plan",label:"Plan",icon:"▦"}
];

const fmt=(v:number|null|undefined,d=0)=>typeof v==="number"&&Number.isFinite(v)?v.toFixed(d):"—";
const dateOnly=(s:string)=>s?s.slice(0,10):"—";
const duration=(s?:number|null)=>!s?"—":`${Math.floor(s/3600)?`${Math.floor(s/3600)}h `:""}${Math.floor((s%3600)/60)}m`;
const distance=(m?:number|null)=>typeof m==="number"?`${(m/1000).toFixed(1)} km`:"—";
const isRide=(a:Activity)=>/ride|cycling|bike|virtualride/i.test(a.sport);
const clamp=(v:number,min=0,max=100)=>Math.max(min,Math.min(max,v));

function Donut({score}:{score:number|null}) {
  const style={"--score":`${score==null?0:clamp(score)}%`} as CSSProperties;
  return <div className="donut" style={style}><div className="donutCore"><b>{score??"—"}</b><span>recovery</span></div></div>;
}

function Metric({icon,label,value,sub}:{icon:string;label:string;value:string;sub?:string}) {
  return <div className="metric"><span>{icon}</span><div><small>{label}</small><b>{value}</b>{sub&&<em>{sub}</em>}</div></div>;
}

function Schedule({planned}:{planned:DashboardData["planned"]}) {
  const base=new Date(); base.setHours(12,0,0,0);
  const days=Array.from({length:7},(_,i)=>{
    const d=new Date(base); d.setDate(base.getDate()+i);
    const iso=d.toISOString().slice(0,10);
    return {iso,day:d.getDate(),dow:d.toLocaleDateString(undefined,{weekday:"short"}),has:planned.some(p=>dateOnly(p.start)===iso)};
  });
  return <div className="schedule">{days.map((d,i)=><div key={d.iso} className={`${i===0?"today":""} ${d.has?"has":""}`}><span>{d.dow}</span><b>{d.day}</b><i/></div>)}</div>;
}

export default function Dashboard(){
  const [tab,setTab]=useState<Tab>("Today");
  const [days,setDays]=useState(90);
  const [data,setData]=useState<DashboardData|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true); setError(null);
    try{
      const res=await fetch(`/api/dashboard?days=${days}`,{cache:"no-store"});
      const json=await res.json();
      if(!res.ok) throw new Error(json.error||"Dashboard request failed");
      setData(json);
    }catch(e){setError(e instanceof Error?e.message:"Dashboard request failed")}
    finally{setLoading(false)}
  },[days]);

  useEffect(()=>{load()},[load]);
  useEffect(()=>{const id=window.setInterval(load,300000); return()=>window.clearInterval(id)},[load]);

  const rides=useMemo(()=>data?.activities.filter(isRide)||[],[data]);

  if(!data) return <main className="appShell"><div className="loading"><div className="pulse"/><b>{error?"Could not load dashboard":"Loading your dashboard…"}</b>{error&&<span>{error}</span>}</div></main>;

  const sleepScore=typeof data.current.sleepScore==="number"?Math.round(clamp(data.current.sleepScore)):null;
  const hrvScore=data.current.hrv&&data.aggregates.avgHrv7d?Math.round(clamp((data.current.hrv/data.aggregates.avgHrv7d)*85,45,100)):null;
  const rhrScore=data.current.restingHr&&data.aggregates.avgRestingHr7d?Math.round(clamp((data.aggregates.avgRestingHr7d/data.current.restingHr)*85,45,100)):null;
  const scores=[sleepScore,hrvScore,rhrScore].filter((x):x is number=>x!==null);
  const recovery=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null;
  const greeting=new Intl.DateTimeFormat(undefined,{weekday:"short",day:"2-digit",month:"short"}).format(new Date());

  return <main className="appShell">
    <header>
      <div><span>{greeting}</span><h1>STAS</h1></div>
      <div className="headerActions">
        <select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={30}>30d</option><option value={90}>90d</option><option value={180}>180d</option><option value={365}>1y</option></select>
        <button onClick={load} disabled={loading}>{loading?"…":"↻"}</button>
      </div>
    </header>

    {tab==="Today"&&<section className="screen">
      <section className="heroCard">
        <small>DAILY RECOVERY</small>
        <Donut score={recovery}/>
        <h2>{recovery!=null&&recovery>=80?"Ready for quality work":recovery!=null&&recovery>=65?"Moderate readiness":"Keep it controlled"}</h2>
        <p>Sleep, HRV and resting heart rate combined as context — not an automatic training verdict.</p>
        <div className="signals">
          <div><span>♥ HRV</span><b>{fmt(data.current.hrv)} ms</b></div>
          <div><span>● RHR</span><b>{fmt(data.current.restingHr)} bpm</b></div>
          <div><span>☾ Sleep</span><b>{fmt(data.current.sleepHours,1)} h</b></div>
        </div>
      </section>

      <section className="card accent">
        <div className="title"><div><small>TRAINING STATUS</small><h3>Load & form</h3></div><span className="pill">{fmt(data.aggregates.load7d)} load</span></div>
        <div className="metrics">
          <Metric icon="↗" label="Fitness" value={fmt(data.current.fitness,1)}/>
          <Metric icon="⚡" label="Fatigue" value={fmt(data.current.fatigue,1)}/>
          <Metric icon="◌" label="Form" value={fmt(data.current.form,1)}/>
          <Metric icon="W" label="FTP" value={`${fmt(data.current.ftp)} W`}/>
        </div>
      </section>

      <section className="card">
        <div className="title"><div><small>BODY</small><h3>Health snapshot</h3></div></div>
        <div className="metrics">
          <Metric icon="⚖" label="Weight" value={`${fmt(data.current.weightKg,1)} kg`} sub={`7d avg ${fmt(data.aggregates.avgWeight7d,1)}`}/>
          <Metric icon="♥" label="HRV" value={`${fmt(data.current.hrv)} ms`} sub={`7d avg ${fmt(data.aggregates.avgHrv7d,1)}`}/>
          <Metric icon="●" label="Resting HR" value={`${fmt(data.current.restingHr)} bpm`} sub={`7d avg ${fmt(data.aggregates.avgRestingHr7d,1)}`}/>
          <Metric icon="☾" label="Sleep" value={`${fmt(data.current.sleepHours,1)} h`} sub={`score ${fmt(data.current.sleepScore)}`}/>
        </div>
      </section>

      <section className="card">
        <div className="title"><div><small>NEXT 7 DAYS</small><h3>Schedule</h3></div></div>
        <Schedule planned={data.planned}/>
        <div className="list">{data.planned.slice(0,4).map(p=><div className="row" key={p.id+p.start}><i/><div><b>{p.name}</b><span>{dateOnly(p.start)} · {duration(p.movingTimeSec)}</span></div></div>)}</div>
      </section>

      <section className="card">
        <div className="title"><div><small>RECENT TRAINING</small><h3>Latest sessions</h3></div><button className="link" onClick={()=>setTab("Training")}>See all</button></div>
        <div className="list">{data.activities.slice(0,5).map(a=><div className="session" key={a.id+a.date}><strong>{isRide(a)?"BIKE":/weight|strength/i.test(a.sport)?"GYM":"MOVE"}</strong><div><b>{a.name}</b><span>{dateOnly(a.date)} · {duration(a.movingTimeSec)}</span></div><em><b>{fmt(a.load)}</b><span>load</span></em></div>)}</div>
      </section>
    </section>}

    {tab==="Health"&&<section className="screen">
      <section className="card"><div className="title"><div><small>RECOVERY</small><h3>HRV trend</h3></div></div><Sparkline values={data.wellness.map(x=>x.hrv)} dates={data.wellness.map(x=>x.date)} label="HRV" unit=" ms" reference={data.aggregates.avgHrv7d}/></section>
      <section className="card"><div className="title"><div><small>RECOVERY</small><h3>Resting HR</h3></div></div><Sparkline values={data.wellness.map(x=>x.restingHr)} dates={data.wellness.map(x=>x.date)} label="Resting HR" unit=" bpm" reference={data.aggregates.avgRestingHr7d}/></section>
      <section className="card"><div className="title"><div><small>SLEEP</small><h3>Sleep duration</h3></div></div><Sparkline values={data.wellness.map(x=>x.sleepHours)} dates={data.wellness.map(x=>x.date)} label="Sleep" unit=" h" reference={data.aggregates.avgSleepHours7d}/></section>
      <section className="card"><div className="title"><div><small>BODY</small><h3>Weight</h3></div></div><Sparkline values={data.wellness.map(x=>x.weightKg)} dates={data.wellness.map(x=>x.date)} label="Weight" unit=" kg" reference={data.aggregates.avgWeight7d}/></section>
    </section>}

    {tab==="Training"&&<section className="screen">
      <section className="card"><div className="title"><div><small>TRAINING</small><h3>28-day summary</h3></div></div><div className="metrics"><Metric icon="◉" label="Sessions" value={`${data.aggregates.sessions28d}`}/><Metric icon="↗" label="Load" value={fmt(data.aggregates.load28d)}/><Metric icon="🚲" label="Bike time" value={`${fmt(data.aggregates.bikeHours28d,1)} h`}/><Metric icon="GYM" label="Strength/HIIT" value={`${data.aggregates.strengthSessions28d}`}/></div></section>
      <section className="card"><div className="title"><div><small>HISTORY</small><h3>Recent sessions</h3></div></div><div className="list">{data.activities.map(a=><div className="session detailed" key={a.id+a.date}><strong>{isRide(a)?"BIKE":/weight|strength/i.test(a.sport)?"GYM":"MOVE"}</strong><div><b>{a.name}</b><span>{dateOnly(a.date)} · {duration(a.movingTimeSec)} · {distance(a.distanceM)}</span><small>{fmt(a.avgHr)} bpm · {fmt(a.avgPower)} W · NP {fmt(a.normalizedPower)} W</small></div><em><b>{fmt(a.load)}</b><span>load</span></em></div>)}</div></section>
    </section>}

    {tab==="Cycling"&&<section className="screen">
      <section className="card accent"><div className="title"><div><small>CYCLING</small><h3>Power profile</h3></div><span className="pill">{fmt(data.current.ftp)} W FTP</span></div><div className="metrics"><Metric icon="W" label="FTP" value={`${fmt(data.current.ftp)} W`}/><Metric icon="◉" label="Rides 28d" value={`${data.aggregates.rideSessions28d}`}/><Metric icon="↗" label="Bike time" value={`${fmt(data.aggregates.bikeHours28d,1)} h`}/><Metric icon="⚖" label="W/kg" value={data.current.ftp&&data.current.weightKg?(data.current.ftp/data.current.weightKg).toFixed(2):"—"}/></div></section>
      <section className="card"><div className="title"><div><small>POWER</small><h3>Average power</h3></div></div><Sparkline values={[...rides].reverse().map(x=>x.avgPower)} dates={[...rides].reverse().map(x=>dateOnly(x.date))} label="Average power" unit=" W"/></section>
      <section className="card"><div className="title"><div><small>POWER</small><h3>Normalized power</h3></div></div><Sparkline values={[...rides].reverse().map(x=>x.normalizedPower)} dates={[...rides].reverse().map(x=>dateOnly(x.date))} label="Normalized power" unit=" W"/></section>
    </section>}

    {tab==="Plan"&&<section className="screen">
      <section className="card"><div className="title"><div><small>CALENDAR</small><h3>Next 7 days</h3></div></div><Schedule planned={data.planned}/></section>
      <section className="card"><div className="title"><div><small>PLANNED WORK</small><h3>Upcoming sessions</h3></div></div><div className="list">{data.planned.map(p=><div className="session detailed" key={p.id+p.start}><strong>PLAN</strong><div><b>{p.name}</b><span>{dateOnly(p.start)} · {p.type||p.category||"Session"} · {duration(p.movingTimeSec)}</span>{p.description&&<small>{p.description}</small>}</div><em><b>{fmt(p.load)}</b><span>load</span></em></div>)}</div></section>
      <section className="card"><div className="title"><div><small>CONNECTIONS</small><h3>Data sources</h3></div></div><div className="connections"><div><span>Intervals.icu</span><b>{data.sources.intervals?"Connected":"Unavailable"}</b></div><div><span>Withings</span><b>{data.sources.withings.replaceAll("_"," ")}</b></div><div><span>STAS context</span><b>{data.sources.stasContext}</b></div></div></section>
    </section>}

    <nav className="bottomNav">{tabs.map(t=><button key={t.key} className={tab===t.key?"active":""} onClick={()=>setTab(t.key)}><span>{t.icon}</span><b>{t.label}</b></button>)}</nav>
  </main>;
}
