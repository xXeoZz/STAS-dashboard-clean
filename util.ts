export function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function firstNum(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = num(obj[key]);
    if (v !== null) return v;
  }
  return null;
}

export function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

export function avg(values: Array<number | null | undefined>): number | null {
  const clean = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return isoDate(d);
}

export function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((a, b) => a + (typeof b === "number" && Number.isFinite(b) ? b : 0), 0);
}

export function inLastDays(date: string, days: number): boolean {
  const t = new Date(date).getTime();
  return Number.isFinite(t) && t >= Date.now() - days * 86400000;
}
