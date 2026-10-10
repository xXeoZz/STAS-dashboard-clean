"use client";

function nice(v: number, digits = 1) {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const d = abs >= 100 ? 0 : abs >= 10 ? 1 : digits;
  return v.toFixed(d);
}

function shortDate(s?: string) {
  if (!s) return "";
  const d = new Date(`${s.slice(0,10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s.slice(5,10);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function smoothPath(points: Array<{x:number;y:number}>) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}

export default function Sparkline({
  values,
  dates,
  label = "Trend",
  unit = "",
  reference,
  width = 620,
  height = 220,
  connectGaps = false,
  smooth = false
}: {
  values: Array<number | null | undefined>;
  dates?: string[];
  label?: string;
  unit?: string;
  reference?: number | null;
  width?: number;
  height?: number;
  connectGaps?: boolean;
  smooth?: boolean;
}) {
  const clean = values.map(v => (typeof v === "number" && Number.isFinite(v) ? v : null));
  const points = clean
    .map((v,i) => ({ v, i, date: dates?.[i] }))
    .filter((p): p is {v:number;i:number;date:string|undefined} => p.v !== null);

  if (points.length < 2) return <div className="empty">Not enough data</div>;

  const vals = points.map(p => p.v);
  const dataMin = Math.min(...vals);
  const dataMax = Math.max(...vals);
  const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
  const latest = points[points.length - 1];
  const ref = typeof reference === "number" && Number.isFinite(reference) ? reference : avg;

  const rawRange = Math.max(dataMax - dataMin, Math.abs(dataMax || 1) * 0.04, 1);
  const min = Math.min(dataMin, ref) - rawRange * 0.12;
  const max = Math.max(dataMax, ref) + rawRange * 0.12;
  const range = max - min || 1;

  const padL = 52, padR = 18, padT = 18, padB = 34;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const x = (i:number) => padL + innerW * (i / Math.max(clean.length - 1, 1));
  const y = (v:number) => padT + innerH * (1 - (v - min) / range);

  let path = "";

  if (connectGaps) {
    const plotted = points.map(p => ({ x: x(p.i), y: y(p.v) }));
    path = smooth ? smoothPath(plotted) : plotted.map((p,idx) =>
      `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    ).join(" ");
  } else {
    let started = false;
    clean.forEach((v,i)=>{
      if (v === null) { started = false; return; }
      path += `${started ? " L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
      started = true;
    });
  }

  const ticks = [max, (max+min)/2, min];
  const firstDate = points[0].date;
  const midDate = points[Math.floor((points.length-1)/2)].date;
  const lastDate = latest.date;

  return <div className="chartBlock">
    <div className="chartMeta">
      <span><b>{nice(latest.v)}</b>{unit} latest</span>
      <span><b>{nice(avg)}</b>{unit} avg</span>
      <span><b>{nice(dataMin)}–{nice(dataMax)}</b>{unit} range</span>
    </div>
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`${label}: latest ${nice(latest.v)}${unit}, average ${nice(avg)}${unit}`}>
      {ticks.map((t,i)=><g key={i}>
        <line className="gridLine" x1={padL} x2={width-padR} y1={y(t)} y2={y(t)} />
        <text className="axisText" x={padL-8} y={y(t)+4} textAnchor="end">{nice(t)}{unit}</text>
      </g>)}
      <line className="referenceLine" x1={padL} x2={width-padR} y1={y(ref)} y2={y(ref)} />
      <text className="referenceText" x={width-padR-3} y={y(ref)-5} textAnchor="end">
        {typeof reference === "number" ? "ref" : "avg"} {nice(ref)}{unit}
      </text>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      {points.map((p,idx)=>{
        const showDot = points.length <= 35 || idx % Math.ceil(points.length/30) === 0 || idx === points.length-1;
        if (!showDot) return null;
        return <circle className="chartPoint" key={`${p.i}-${idx}`} cx={x(p.i)} cy={y(p.v)} r={idx===points.length-1 ? 4 : 2.5}>
          <title>{`${p.date ? shortDate(p.date) + ": " : ""}${nice(p.v)}${unit}`}</title>
        </circle>;
      })}
      <text className="axisText" x={padL} y={height-10} textAnchor="start">{shortDate(firstDate)}</text>
      <text className="axisText" x={padL+innerW/2} y={height-10} textAnchor="middle">{shortDate(midDate)}</text>
      <text className="axisText" x={width-padR} y={height-10} textAnchor="end">{shortDate(lastDate)}</text>
    </svg>
  </div>;
}
