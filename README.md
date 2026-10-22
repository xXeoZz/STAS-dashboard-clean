# STAS Dashboard v9.3

Personal cycling, health and training dashboard built with Next.js 15 / React 19.

## v9.3 changes

### Weekly Review on Today
The old "What's next?" card has been replaced by a stable review of the previous completed ISO week (Monday-Sunday).

It shows:
- training time
- total load
- sessions
- rides
- main signal
- response
- goal link
- risk/watch item
- load change versus the prior week

The review refreshes naturally when a new week starts and remains visible for the rest of that week.

### Cycling trend fix
Intervals.icu power mapping is now more defensive and accepts multiple field names for:
- average power
- normalized/weighted power
- cadence
- aerobic decoupling
- intensity factor

This fixes blank Average Power and Endurance Efficiency charts when Intervals returns power under alternate keys.

### Better empty states
If a selected Cycling/Health metric truly does not contain enough usable points, the chart now explains that directly instead of looking broken.

### UI redesign
The visual hierarchy is calmer and more wellness-oriented:
- larger type
- softer surfaces
- fewer hard borders
- more spacing
- stronger emphasis on Recovery + Weekly Review
- cleaner chart and tab controls
- reduced visual competition between secondary metrics

The design is inspired by modern premium wellness products. It does not copy third-party branding.

### Data architecture
- Intervals.icu: activities, wellness, calendar, load and cycling metrics
- Withings: weight/body composition
- STAS local/remote snapshot: goals, rules and strategy
- Garmin-direct experimental integration is not included in v9.3

## Repository structure

```text
app/
components/
data/
lib/
middleware.ts
next.config.ts
next-env.d.ts
package.json
tsconfig.json
.env.example
```

These folders must be at the repository root.

## Vercel environment variables

Required:

```text
INTERVALS_API_KEY
INTERVALS_ATHLETE_ID=i149757
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

Optional STAS context:

```text
STAS_CONTEXT_URL
STAS_CONTEXT_BEARER_TOKEN
```

Do not put real secrets in `.env.example`; add real values in Vercel Environment Variables.

## Deployment

1. Unzip the package.
2. Open your local GitHub repository folder.
3. Replace the repository contents with the contents of this package (leave the hidden `.git` folder).
4. Confirm `app/`, `components/`, `data/` and `lib/` are folders at the root.
5. Commit in GitHub Desktop.
6. Push origin.
7. Vercel should deploy automatically.
