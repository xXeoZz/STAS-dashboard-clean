# STAS v9.2 — Market UI Review

## Scope and limitation

This review is based on established product patterns in Oura, WHOOP, Garmin, Strava, TrainingPeaks, Intervals.icu, TrainerRoad, Apple Health/Fitness and similar health/endurance products. Live web access was unavailable during this build, so this is not a claim about every competitor's exact 2026 screen layout or pricing.

## What the strongest products consistently do

### 1. One primary question per screen
- Recovery products lead with: "How am I today?"
- Coaching products lead with: "What should I do next?"
- Training analytics products lead with: "What is my load/trend?"
- Activity products lead with: "What did I do?"

The weak pattern is a dashboard where every metric has equal visual weight.

### 2. One dominant summary, then drivers
Oura/WHOOP-style products reduce complexity with one main state/score and show the inputs immediately underneath. The lesson is not "copy the score"; it is "make the hierarchy obvious."

For STAS:
- primary: Daily Recovery context
- drivers: HRV, resting HR, sleep
- deeper view: Health tab

### 3. Action is more valuable than another metric
TrainerRoad-style experiences are effective because today's training is obvious. A user should not have to interpret six charts before finding the next session.

For STAS:
- Today screen places the planned workout directly after recovery context.

### 4. Calendar remains the best training backbone
TrainingPeaks/Intervals/Garmin patterns work because athletes naturally reason in days, weeks and months.

For STAS:
- Today contains a compact monthly report.
- Plan contains the full monthly report and upcoming sessions.
- completed, planned, explicit rest and no-record states remain distinct.

### 5. Trends belong behind a selector, not in a wall of charts
Health products become noisy when HRV, RHR, sleep, weight, stress, SpO2 and more all have equal cards.

For STAS:
- the Health tab shows one selected trend at a time:
  HRV / Resting HR / Sleep / Weight.
- the Cycling tab does the same:
  Efficiency / Drift / Average Power / Normalized Power.

### 6. Training load needs context, not traffic-light certainty
TrainingPeaks/Intervals-style Fitness/Fatigue/Form metrics are useful, but poor products turn them into automatic readiness judgments.

For STAS:
- Fitness/Fatigue/Form are shown together.
- load balance compares 7-day load with the recent weekly average.
- neither automatically tells the athlete to train hard or rest.

## UI changes made in v9.2

### Today — reduced to four blocks
1. Recovery context
2. Today's planned training
3. This week's training summary
4. Compact monthly report

Removed from the Today screen:
- duplicate body cards
- training-status card
- recent activity feed
- multiple secondary charts

Those remain available in the deeper tabs.

### Health — interpretation before charts
Top-level Health Intelligence:
- Recovery
- Sleep consistency
- Load balance
- 28-day measured weight trend

Then one trend explorer for:
- HRV
- RHR
- Sleep
- Weight

### Training — three questions
- What is the current load context?
- How has load changed over 12 weeks?
- Where did training time go?

Recent sessions come after those questions.

### Cycling — cycling-specific value
- FTP
- W/kg
- 28-day ride frequency
- 28-day ride time
- selectable trend for endurance efficiency, aerobic drift, average power, normalized power

### Plan — full context
- monthly report
- upcoming sessions
- goals
- source status

## Health Intelligence design

STAS v9.2 deliberately avoids recreating Garmin Body Battery with a fake proprietary clone.

Instead it derives transparent presentation metrics from data the dashboard already owns.

### Recovery score
Inputs when available:
- HRV relative to the athlete's preceding observations
- resting HR relative to preceding observations
- sleep score, or sleep duration fallback

The score reweights only the available components.

### Recovery trend
Selected day's recovery score compared with recent recovery observations.

### Sleep consistency
A presentation score based on night-to-night variation in recent sleep duration.
It is not a clinical sleep metric.

### Load balance
7-day load divided by the recent 28-day weekly average:
- < 0.78: lower than recent
- 0.78–1.22: near recent average
- > 1.22: above recent average

This is context, not an injury/readiness prediction.

### Weight trend
Difference between the latest measured weight and the earliest measured weight within the recent lookback.
No synthetic daily weigh-ins are created.

## Design language

- fewer cards
- larger typography
- more whitespace
- one accent color for health/training state
- sport colors used only for workout categories
- deep green/black surfaces
- tab selectors replace repeated chart cards
- bottom navigation remains at five items, the common practical maximum on mobile

## Product principle

Every surface should answer one question:

Today: What matters now?
Health: What are my recovery/body trends?
Training: What training am I absorbing?
Cycling: Am I becoming a stronger, more durable cyclist?
Plan: What is coming next?
