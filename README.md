# STAS Training & Health Dashboard — Clean v8

This is a clean rebuild of the dashboard with no stray TypeScript files at repository root.

## Included
- Intervals.icu activities, wellness, calendar, training load and FTP
- Garmin-origin wellness through Intervals.icu
- optional direct Garmin normalized provider
- Withings OAuth, weight and body composition
- Withings diagnostics route
- Intervals diagnostics route
- graphical dark dashboard layout
- FTP fallback: Intervals athlete -> latest cycling activity -> STAS snapshot
- latest-weight fallback: latest available Withings/Intervals/Garmin weight
- Basic Auth protection

## Critical repository structure

These files must be in these exact places:

```text
app/
  api/
    dashboard/route.ts
    diagnostics/route.ts
    withings/
      connect/route.ts
      callback/route.ts
      disconnect/route.ts
      diagnostics/route.ts
  globals.css
  layout.tsx
  page.tsx

components/
  Dashboard.tsx
  Sparkline.tsx

lib/
  dashboard.ts
  types.ts
  util.ts
  providers/
    intervals.ts
    garmin.ts
    stas.ts
    withings.ts
```

There should NOT be a root-level `dashboard.ts`, `types.ts`, `intervals.ts`, or `route.ts`.

## Vercel environment variables

Required:
```text
INTERVALS_API_KEY
INTERVALS_ATHLETE_ID=i149757
DASHBOARD_USER
DASHBOARD_PASSWORD
```

Recommended:
```text
DASHBOARD_TIMEZONE=Europe/Copenhagen
```

Withings:
```text
WITHINGS_CLIENT_ID
WITHINGS_CLIENT_SECRET
WITHINGS_REDIRECT_URI=https://YOUR-STABLE-DOMAIN/api/withings/callback
WITHINGS_COOKIE_SECRET
WITHINGS_API_BASE=https://wbsapi.withings.net
```

## Diagnostics

Intervals:
```text
https://YOUR-DOMAIN/api/diagnostics
```

Withings:
```text
https://YOUR-DOMAIN/api/withings/diagnostics
```

Dashboard JSON:
```text
https://YOUR-DOMAIN/api/dashboard?days=90
```

## Clean install recommendation

For the cleanest recovery from the earlier repository file mix-ups:

1. Create a new empty private GitHub repository, or delete the old repository contents.
2. Unzip this package locally.
3. Upload the CONTENTS of the unzipped package to the repository root.
4. Confirm `package.json`, `app/`, `components/`, `lib/`, and `data/` are at the repository root.
5. Import or reconnect that repository in Vercel.
6. Re-add the Vercel environment variables.
7. Deploy.


## v8.1 FTP compile fix

The dashboard no longer depends on an `ftp` property existing on the `Activity` TypeScript type.
For activity-level FTP fallback it reads the FTP value from the raw Intervals activity payload instead.

This specifically avoids the Vercel build error:
`Property 'ftp' does not exist on type 'Activity'.`


## v8.3 smooth sparse weight chart

The weight chart now:
- connects only real weigh-in points across missing days
- uses a smooth curve between those observed points
- keeps the actual date spacing
- does not invent daily weight values


## v8.4 monthly training calendar

The Today screen now includes a monthly training report with:
- Rest days
- HIIT
- Strength
- Cycling
- Running
- distinct colors and legend
- previous-month navigation
- completed sessions as solid markers
- planned sessions as faded markers
- multi-workout days shown with multiple color dots


## v8.4.1 TypeScript fix

Fixed calendar legend/dot rendering so the Rest fallback is explicitly typed as `WorkoutKind[]`.
This resolves the Vercel build error where `workoutKindMeta[k]` was indexed by an inferred `string`.


## v8.5 recovery history navigation

The Daily Recovery card now supports historical navigation:
- previous / next recovery day buttons
- Latest button
- historical HRV, RHR and sleep values
- trailing 7-day HRV and RHR context calculated for the selected date
- recovery score recalculated for the selected historical date
- navigation only uses dates that actually contain recovery data


# STAS Dashboard v9

v9 is a decision-first cycling, health and training UI.

## Today
- historical Daily Recovery navigation
- today's planned workout
- monthly training report with color-coded Cycling / Strength / HIIT / Running / explicit Rest
- weekly training summary
- Fitness / Fatigue / Form context
- body and health snapshot
- recent sessions

## Health
- HRV, resting HR, sleep and weight trends
- sparse data connected without inventing measurements
- current wellness metrics

## Training
- 12-week load bars
- 28-day training distribution
- Fitness / Fatigue / Form
- detailed recent session list

## Cycling
- FTP and W/kg
- average and normalized power trends
- endurance efficiency (average power / average HR on rides >=45 min)
- aerobic decoupling trend
- recent rides

## Plan
- upcoming sessions
- goals
- data-source status

## Calendar semantics
- completed workouts are solid
- future/planned workouts are faded
- Rest is only shown when explicitly recorded as rest/recovery/off
- a blank historical day means no workout was recorded; it is not silently reclassified as rest

All existing Intervals.icu, Garmin-via-Intervals and Withings provider code is preserved.
