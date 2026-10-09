import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { WellnessDay } from "@/lib/types";

export type WithingsStatus = "connected" | "not_configured" | "needs_authorization" | "error";

type TokenBundle = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

type WithingsResult = {
  status: WithingsStatus;
  wellness: WellnessDay[];
  error?: string;
};

const TOKEN_COOKIE = "stas_withings_token";
const STATE_COOKIE = "stas_withings_state";
const DEFAULT_API_BASE = "https://wbsapi.withings.net";

function configured() {
  return Boolean(
    process.env.WITHINGS_CLIENT_ID &&
    process.env.WITHINGS_CLIENT_SECRET &&
    process.env.WITHINGS_COOKIE_SECRET
  );
}

function cookieKey() {
  const secret = process.env.WITHINGS_COOKIE_SECRET;
  if (!secret) throw new Error("WITHINGS_COOKIE_SECRET is not configured");
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", cookieKey(), iv);
  const plain = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decrypt<T>(value?: string): T | null {
  if (!value) return null;
  try {
    const raw = Buffer.from(value, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", cookieKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function setWithingsOAuthState(state: string) {
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  });
}

export async function consumeWithingsOAuthState(state: string) {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (!expected || !state || expected.length !== state.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(state));
}

export async function saveWithingsToken(token: TokenBundle) {
  const store = await cookies();
  store.set(TOKEN_COOKIE, encrypt(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}

export async function clearWithingsToken() {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
}

async function readWithingsToken(): Promise<TokenBundle | null> {
  const store = await cookies();
  return decrypt<TokenBundle>(store.get(TOKEN_COOKIE)?.value);
}

function tokenBody(data: unknown): TokenBundle {
  const root = data as Record<string, unknown>;
  const body = ((root?.body && typeof root.body === "object") ? root.body : root) as Record<string, unknown>;

  const access = body.access_token;
  const refresh = body.refresh_token;
  if (typeof access !== "string" || typeof refresh !== "string") {
    throw new Error("Withings token response did not include access and refresh tokens");
  }

  const expiresIn = Number(body.expires_in ?? 10800);

  return {
    access_token: access,
    refresh_token: refresh,
    expires_at: Date.now() + Math.max(60, expiresIn - 60) * 1000
  };
}

async function requestToken(params: Record<string, string>) {
  const base = process.env.WITHINGS_API_BASE || DEFAULT_API_BASE;
  const form = new URLSearchParams({ action: "requesttoken", ...params });

  const res = await fetch(`${base}/v2/oauth2`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form,
    cache: "no-store"
  });

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  const status = typeof data.status === "number" ? data.status : null;

  if (!res.ok || (status !== null && status !== 0)) {
    throw new Error(`Withings token request failed (${status ?? res.status})`);
  }

  return tokenBody(data);
}

export async function exchangeWithingsCode(code: string, redirectUri: string) {
  if (!configured()) throw new Error("Withings is not configured");

  const token = await requestToken({
    grant_type: "authorization_code",
    client_id: process.env.WITHINGS_CLIENT_ID!,
    client_secret: process.env.WITHINGS_CLIENT_SECRET!,
    code,
    redirect_uri: redirectUri
  });

  await saveWithingsToken(token);
}

async function activeAccessToken(): Promise<string | null> {
  if (!configured()) return null;

  let token = await readWithingsToken();
  if (!token) return null;

  if (token.expires_at > Date.now()) return token.access_token;

  try {
    token = await requestToken({
      grant_type: "refresh_token",
      client_id: process.env.WITHINGS_CLIENT_ID!,
      client_secret: process.env.WITHINGS_CLIENT_SECRET!,
      refresh_token: token.refresh_token
    });
    await saveWithingsToken(token);
    return token.access_token;
  } catch {
    await clearWithingsToken();
    return null;
  }
}

function localDateFromUnix(seconds: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.DASHBOARD_TIMEZONE || "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(seconds * 1000));
}

function numericMeasure(value: unknown, unit: unknown) {
  const v = Number(value);
  const u = Number(unit);
  if (!Number.isFinite(v) || !Number.isFinite(u)) return null;
  return v * Math.pow(10, u);
}

function groupToWellness(group: Record<string, unknown>): WellnessDay | null {
  const ts = Number(group.date);
  if (!Number.isFinite(ts)) return null;

  const row: WellnessDay = {
    date: localDateFromUnix(ts),
    raw: { withings: group },
    source: "Withings"
  };

  const measures = Array.isArray(group.measures) ? group.measures : [];

  for (const rawMeasure of measures) {
    if (!rawMeasure || typeof rawMeasure !== "object") continue;
    const measure = rawMeasure as Record<string, unknown>;
    const value = numericMeasure(measure.value, measure.unit);
    const type = Number(measure.type);

    if (value === null || !Number.isFinite(type)) continue;

    if (type === 1) row.weightKg = value;
    if (type === 6) row.bodyFatPct = value;
    if (type === 8) row.fatMassKg = value;
    if (type === 76) row.muscleMassKg = value;
    if (type === 77) row.hydrationKg = value;
    if (type === 88) row.boneMassKg = value;
  }

  const hasValue = [
    row.weightKg, row.bodyFatPct, row.fatMassKg,
    row.muscleMassKg, row.hydrationKg, row.boneMassKg
  ].some(v => typeof v === "number" && Number.isFinite(v));

  return hasValue ? row : null;
}

export async function fetchWithingsWellness(oldest: string, newest: string): Promise<WithingsResult> {
  if (!configured()) return { status: "not_configured", wellness: [] };

  const token = await activeAccessToken();
  if (!token) return { status: "needs_authorization", wellness: [] };

  const start = Math.floor(new Date(`${oldest}T00:00:00Z`).getTime() / 1000);
  const end = Math.floor(new Date(`${newest}T23:59:59Z`).getTime() / 1000);
  const base = process.env.WITHINGS_API_BASE || DEFAULT_API_BASE;

  try {
    const params = new URLSearchParams({
      action: "getmeas",
      startdate: String(start),
      enddate: String(end)
    });

    const res = await fetch(`${base}/measure?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store"
    });

    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    const status = typeof data.status === "number" ? data.status : null;

    if (!res.ok || (status !== null && status !== 0)) {
      return {
        status: "error",
        wellness: [],
        error: `Withings measurements failed (${status ?? res.status})`
      };
    }

    const body = data.body && typeof data.body === "object"
      ? data.body as Record<string, unknown>
      : {};
    const groups = Array.isArray(body.measuregrps) ? body.measuregrps : [];
    const byDate = new Map<string, { ts: number; row: WellnessDay }>();

    for (const rawGroup of groups) {
      if (!rawGroup || typeof rawGroup !== "object") continue;
      const group = rawGroup as Record<string, unknown>;
      const row = groupToWellness(group);
      if (!row) continue;

      const ts = Number(group.date) || 0;
      const prev = byDate.get(row.date);
      if (!prev || ts >= prev.ts) byDate.set(row.date, { ts, row });
    }

    return {
      status: "connected",
      wellness: [...byDate.values()].map(x => x.row).sort((a, b) => a.date.localeCompare(b.date))
    };
  } catch (e) {
    return {
      status: "error",
      wellness: [],
      error: e instanceof Error ? e.message : "Withings request failed"
    };
  }
}
