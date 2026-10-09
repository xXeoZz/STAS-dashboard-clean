export type Scalar = string | number | boolean | null | undefined;

export type WellnessDay = {
  date: string;
  hrv?: number | null;
  restingHr?: number | null;
  sleepHours?: number | null;
  sleepScore?: number | null;
  steps?: number | null;
  weightKg?: number | null;
  bodyBattery?: number | null;
  stress?: number | null;
  spo2?: number | null;
  respiration?: number | null;
  calories?: number | null;
  bodyFatPct?: number | null;
  fatMassKg?: number | null;
  muscleMassKg?: number | null;
  boneMassKg?: number | null;
  hydrationKg?: number | null;
  raw?: Record<string, unknown>;
  source?: string;
};

export type Activity = {
  id: string;
  date: string;
  name: string;
  sport: string;
  movingTimeSec?: number | null;
  distanceM?: number | null;
  load?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  avgPower?: number | null;
  normalizedPower?: number | null;
  intensityFactor?: number | null;
  cadence?: number | null;
  decouplingPct?: number | null;
  calories?: number | null;
  elevationGainM?: number | null;
  fitness?: number | null;
  fatigue?: number | null;
  form?: number | null;
  ftp?: number | null;
  raw?: Record<string, unknown>;
};

export type PlannedEvent = {
  id: string;
  start: string;
  end?: string | null;
  name: string;
  category?: string | null;
  type?: string | null;
  description?: string | null;
  movingTimeSec?: number | null;
  load?: number | null;
};

export type AthleteProfile = {
  name?: string | null;
  weightKg?: number | null;
  maxHr?: number | null;
  lthr?: number | null;
  ftp?: number | null;
  timezone?: string | null;
  raw?: Record<string, unknown>;
};

export type StasContext = {
  snapshotDate?: string;
  athlete?: Record<string, unknown>;
  goals?: Array<Record<string, unknown>>;
  rules?: string[];
  strategy?: string;
  notes?: string[];
};

export type GarminNormalizedResponse = {
  wellness?: WellnessDay[];
  latest?: Record<string, unknown>;
};

export type DashboardData = {
  generatedAt: string;
  days: number;
  sources: {
    intervals: boolean;
    stasContext: "local" | "remote" | "unavailable";
    garminDirect: boolean;
    withings: "connected" | "not_configured" | "needs_authorization" | "error";
    notes: string[];
  };
  athlete: AthleteProfile;
  current: {
    fitness?: number | null;
    fatigue?: number | null;
    form?: number | null;
    hrv?: number | null;
    restingHr?: number | null;
    sleepHours?: number | null;
    sleepScore?: number | null;
    steps?: number | null;
    weightKg?: number | null;
    ftp?: number | null;
    bodyFatPct?: number | null;
    fatMassKg?: number | null;
    muscleMassKg?: number | null;
    boneMassKg?: number | null;
    hydrationKg?: number | null;
  };
  aggregates: {
    load7d: number;
    load28d: number;
    sessions7d: number;
    sessions28d: number;
    bikeHours28d: number;
    strengthSessions28d: number;
    rideSessions28d: number;
    avgHrv7d?: number | null;
    avgRestingHr7d?: number | null;
    avgSleepHours7d?: number | null;
    avgWeight7d?: number | null;
  };
  wellness: WellnessDay[];
  activities: Activity[];
  planned: PlannedEvent[];
  stas: StasContext | null;
  latestHealthExtras: Array<{ key: string; value: Scalar; source: string }>;
};
