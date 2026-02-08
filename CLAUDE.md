# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pulse SG is a real-time monitoring plugin for Disguise Designer (d3) media servers. It displays system metrics (CPU, GPU, memory, FPS, disk I/O) for all machines in a d3 session (director, actors, understudies) on a single monitoring page.

**Key concept**: The Vue app runs in a browser on a "monitoring machine" and pulls data from the "d3 machine (director)". All alert logic and UI processing runs on the monitoring machine, not the d3 server.

## Build & Development Commands

```bash
# Start dev server (Docker)
docker compose up

# Run one-off build (Docker)
docker compose run --rm dev npm run build

# Execute commands in running container
docker compose exec dev <command>

# Direct commands (if node_modules installed locally)
npm run dev      # Start Vite dev server
npm run build    # Production build
npm run preview  # Preview production build
```

Dev server runs at http://localhost:5173. Connect to a specific director with `?director=<host:port>`.

## Build Output Configuration

Build output directory is controlled by files at repo root (read in order of priority):
- `.build-target.local` - Local override (gitignored)
- `.build-target.server` - Server path when `BUILD_TARGET=server` (gitignored)
- `.build-target` - Default (committed)
- Falls back to `dist/` if none exist

For Docker builds targeting host paths, create `docker-compose.override.yml` with a bind mount and point the build target to a path inside that mount.

## Architecture

### Data Flow
1. **Session fetch**: `GET /api/session/status/session` retrieves machine list (director + actors + understudies)
2. **Live Update (WebSocket)**: Real-time metrics via `@disguise-one/vue-liveupdate`
   - Director (local): `findLocalMonitor(monitorName)`
   - Actors/understudies: `findRemoteMonitor(hostname, monitorName)`
3. **Polling fallback**: 500ms interval polls subscription refs (library may not be Vue-reactive)

### Key Files
- `src/App.vue` - Main app: session fetch, Live Update subscriptions, tab management
- `src/stores/metrics.js` - Reactive store: per-machine metrics/history, alert configuration, throttling
- `src/components/MachineLiveUpdate.vue` - Per-machine WebSocket connections for remote machines
- `src/components/MetricCard.vue` - Metric display with sparkline and threshold coloring
- `src/director.js` - Director endpoint resolution from URL params, env vars, or defaults

### Live Update Subscription Paths
```javascript
// Local machine (director)
`subsystem:MonitoringManager.findLocalMonitor("${monitorName}")`

// Remote machines (actors/understudies)
`subsystem:MonitoringManager.findRemoteMonitor("${hostname}", "${monitorName}")`
```

Monitor names: `fps`, `Machine` (CPU/GPU), `ProcessMemory`, `Disk`

### Metrics Store
- Throttles updates via `updateRateMs` (0-5000ms, default 10ms)
- Maintains 5-second rolling history per metric
- Alert evaluation runs on each metric update (warning/critical thresholds)
- "Stale" detection: machine marked stale if all overview metrics silent for 5s

## Dependencies

- `@disguise-one/vue-liveupdate` - Real-time data subscriptions to d3
- `@disguise-one/designer-pythonapi` - Python script execution in Designer
- `vue-chartjs` / `chart.js` - Sparkline charts in MetricCard
- Uses `rolldown-vite` as Vite replacement
