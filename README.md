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
