# Pulse Plugin for Disguise Designer

This is a fork of the [Pulse Plugin](https://help.disguise.one/designer/plugins/plugin-gallery) from the Designer Plugin Gallery, extended so that **all session machines (director, actors, and understudies) are shown on a single page**. It is designed to be run from a **separate monitoring machine** that connects to the director, giving you one dashboard for the whole session.

A real-time monitoring and control plugin for [Disguise Designer (d3)](https://www.disguise.one/) media server software. Pulse provides operators with live system metrics, alert notifications, and basic timeline control capabilities during live productions.

## Overview

Pulse is designed for live event operators who need to monitor system health while running shows in Disguise Designer. The plugin connects to Designer's Live Update API and session REST API to provide real-time feedback on critical performance metrics for every machine in the session (director, actors, and understudies).

### Key Features

- **Per-machine metrics** – One section per machine (director, actors, understudies). The local/director machine is labeled “(this machine)”.
- **Overview tab** – CPU load, GPU load, memory usage, and frame rate with sparkline history for each machine.
- **Advanced tab** – Disk read/write and session playhead position. Disk and playhead subscriptions are frozen when the tab is inactive to reduce load.
- **Configurable alerts** – Set warning and critical thresholds per metric; alerts show machine name and link to the relevant tab/metric.
- **Live connection status** – Overlay shows connection state to the director.

### How the plugin works

- **Session and machine list** – On load, the plugin calls `GET /api/session/status/session`. From the response it builds the machine list: in solo mode a single “Local Machine”; otherwise director (marked local) + actors + understudies. The list is fetched once when the plugin opens; it is not refreshed periodically.
- **Live Update subscriptions** – For each machine, metrics come from Disguise’s MonitoringManager. The **local machine** (director) uses `findLocalMonitor(monitorName)`; **remote machines** use `findRemoteMonitor(hostname, monitorName)` with hostname lowercased. Subscriptions are created for fps, Machine (CPU/GPU), ProcessMemory, and Disk; values are read via `object.seriesAverage(...)` and pushed into the store by watchers and an 800 ms polling fallback (so updates work even if the library populates refs asynchronously).
- **Playhead** – Subscribes to `transportManager:default` for `object.player.tRender` and is frozen when the Advanced tab is not active.

### Technology Stack

- **Frontend**: Vue 3 with Composition API
- **Build Tool**: Vite
- **Charts**: Chart.js with vue-chartjs
- **Designer Integration**: 
  - `@disguise-one/vue-liveupdate` for real-time data subscriptions
  - `@disguise-one/designer-pythonapi` for Python script execution (e.g. TextLayerControl)

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A running Disguise Designer instance (for live connection features)

### Installation

1. Clone the repository
2. Start the development container:
   ```sh
   docker compose up
   ```
3. Access the plugin at http://localhost:5173

### Connecting to Designer

The plugin automatically connects to Designer using the hostname from the URL. You can also specify the director endpoint explicitly:

```
http://localhost:5173?director=192.168.1.100:80
```

## Project Structure

```
src/
├── App.vue                      # Main app: session fetch, per-machine subscriptions, tabs
├── components/
│   ├── MetricCard.vue           # Metric value + sparkline; threshold colours
│   ├── AlertManager.vue        # Active alerts list + per-metric alert config
│   ├── PlayheadDisplay.vue     # Real-time playhead (optional use)
│   └── TextLayerControl.vue    # Python script execution interface
├── stores/
│   └── metrics.js               # Per-machine metrics, history, alerts, playhead
├── main.js
└── hello_world.py               # Example Python script for Designer
```

## Docker Development Workflow

1. Start the dev container:
   ```sh
   docker compose up
   ```
   The Vite dev server is exposed on http://localhost:5173. The working tree is bind-mounted so any edits on your host are immediately reflected in the container. `node_modules` lives in a named Docker volume so dependency installs stay fast between runs.

2. To run arbitrary commands inside the container, use:
   ```sh
   docker compose exec dev <command>
   ```
   For example, `docker compose exec dev npm run build`.

### Building to a plugin-specific directory

Build output is controlled by a *build target* file at the repo root. Vite reads the target path from `.build-target`; if `.build-target.local` exists it overrides that (and is gitignored so you can point to a local plugin folder without committing). Put one line in the file: either an absolute path or a path relative to the repo. `npm run build` ensures the directory exists and writes production assets there (it does not clear the directory first).

- Commit `.build-target` with a sensible default (e.g. `dist`).
- Use `.build-target.local` for a machine-specific path (e.g. your Designer plugins folder).
- When targeting a path outside the repo, ensure it is available inside Docker (e.g. add a bind mount in `docker-compose.override.yml` and point the build target to a path inside that mount).

### Targeting a path outside the repo on Windows

1. Create `docker-compose.override.yml` (ignored by git) and mount the host folder that contains all plugin build outputs:
- Note: Use forward slashes or escape the back slashes if using windows paths (should look like the exmple below).
   ```yaml
   services:
     dev:
       volumes:
         - "C:/path/to/d3/plugins/folder:/host-plugins"
   ```
   Adjust the Windows path for your plugin directory; the right side (`/host-plugins`) is how the container sees it.
2. Edit `.build-target` so it points to a subfolder within that mount, e.g. `/host-plugins/<plugin-name>`.
3. Run `docker compose build` (or `--no-cache` if you changed the Dockerfile) followed by `docker compose up`.

4. Build the plugin from scratch without starting the dev server by running:
   ```
   docker compose run --rm dev npm run build
   ```
   This runs `npm run build` inside the dev container once and exits, writing the output straight into your host plugin folder.

## Python Type Stubs

The `src/d3.pyi` file provides type hints, autocomplete, and code analysis for the d3 module in your IDE. This stub file enables:

- **Type checking**: Catch type errors before runtime
- **Autocomplete**: Get intelligent code completion for d3 API calls
- **Code analysis**: Better refactoring and navigation support

Most modern Python IDEs (VS Code with Pylance, PyCharm, etc.) will automatically detect and use this stub file when you have `src/` in your Python path. The stub file is already included in the codebase and should work out of the box.

To ensure your IDE recognizes the stub file:
- Make sure `src/` is included in your Python path/workspace
- If using VS Code, the Python extension should automatically detect `.pyi` files in your workspace
- If using PyCharm, it will automatically use stub files in your project directory

## Metrics and Alerting

The metrics store (`src/stores/metrics.js`) provides a reactive system for monitoring performance:

### Tracked Metrics
| Metric | Unit | Default Warning | Default Critical |
|--------|------|-----------------|------------------|
| CPU Load | % | 80% | 90% |
| GPU Load | % | 80% | 90% |
| Memory Usage | MB | 4000 MB | 8000 MB |
| Frame Rate | FPS | < 50 | < 30 |
| Disk Read | MB/s | - | - |
| Disk Write | MB/s | - | - |

### Alert Configuration

Each metric can be configured with:
- **Warning threshold** - Triggers an amber visual indicator
- **Critical threshold** - Triggers a red pulsing indicator
- **Comparison mode** - `greater` (alert when above) or `less` (alert when below, used for FPS)

## License

This plugin is intended for use with Disguise Designer. See the [Disguise Developer Portal](https://developer.disguise.one/) for more information on plugin development.
