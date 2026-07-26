# F3 Pace Race Director

A mobile-first installable web app for controlling a live F3 pace race in real time.

## What it does now

- Pre-race setup for total distance, checkpoint spacing, team count, names, colors, and pace bounds
- Live race director dashboard with per-team pace controls (+/-), pause/resume, reset, and manual checkpoint correction
- Continuous race telemetry per team:
  - current distance (miles + feet)
  - checkpoint index
  - distance remaining
  - estimated finish time
  - gap ahead/behind
  - average pace
  - cumulative time gained/lost from pace changes
- Horizontal course visualization with quarter-mile style checkpoints, turnaround marker, and animated team markers
- Secondary watch display that tracks the current leader pace
- Supabase-ready race state shape with `session_id`, `device_id`, and `event_log`

## Architecture

- `js/app.js` - Entry point and bootstrap
- `js/engine/race-engine.js` - Real-time race loop, pace transitions, checkpoints, and projections
- `js/engine/race-state.js` - Serializable race state and event-ready structure
- `js/ui/ui-controller.js` - Screen orchestration and component wiring
- `js/ui/setup-screen.js` - Pre-race configuration form
- `js/ui/race-director-dashboard.js` - Team controls and live stat panels
- `js/ui/course-visualization.js` - Course map markers and animation updates
- `js/utils/calculations.js` - Distance/checkpoint/gap math helpers
- `js/utils/time-utils.js` - Pace and time formatting helpers
- `css/styles.css` - Race Director layout and dark/cyan visual theme

## Run locally

Because the app uses a service worker, serve over HTTP rather than opening `index.html` directly.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Future expansion readiness

The race state object is intentionally JSON-serializable and includes identifiers + event history so future PRs can add:

- room-code multiplayer syncing (Supabase)
- multi-device control handoff
- GPS telemetry ingestion
- QR code join flows
- race history/replay storage
