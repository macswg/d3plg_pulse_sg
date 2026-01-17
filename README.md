# Pulse Plugin for Disguise Designer

A real-time monitoring and control plugin for [Disguise Designer (d3)](https://www.disguise.one/) media server software. Pulse provides operators with live system metrics, alert notifications, and basic timeline control capabilities during live productions.

## Overview

Pulse is designed for live event operators who need to monitor system health while running shows in Disguise Designer. The plugin connects to Designer's live update system to provide real-time feedback on critical performance metrics.

### Key Features

- **Real-Time Playhead Display** - Monitor the current playhead position from Designer's transport manager
- **System Metrics Monitoring** - Track CPU, GPU, memory usage, frame rate, and disk I/O with visual sparkline charts
- **Configurable Alerts** - Set warning and critical thresholds for each metric with visual indicators
- **Timeline Control** - Execute Python scripts in Designer (e.g., add text layers to the timeline)
- **Live Connection Status** - Visual overlay showing connection state to the Designer instance

### Technology Stack

- **Frontend**: Vue 3 with Composition API
- **Build Tool**: Vite
- **Charts**: Chart.js with vue-chartjs
- **Designer Integration**: 
  - `@disguise-one/vue-liveupdate` for real-time data subscriptions
  - `@disguise-one/designer-pythonapi` for Python script execution

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
├── App.vue                      # Main application component
├── components/
│   ├── MetricCard.vue           # Metric display with sparkline chart
│   ├── PlayheadDisplay.vue      # Real-time playhead position
│   └── TextLayerControl.vue     # Python script execution interface
├── stores/
│   └── metrics.js               # Reactive metrics store with alert system
├── hello_world.py               # Example Python script for Designer
└── d3.pyi                       # Python type stubs for Designer API
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

The build output location is controlled by the `.build-target` file at the repo root. Put either an absolute path or a path relative to the repo in that file. During `npm run build` the Vite config reads the file, ensures the directory exists, and writes the production assets there (without clearing it automatically). This allows each plugin to point to its own destination without changing source files.

Tips:

- Check the file into version control with a sensible default (the template uses `dist`).
- When targeting a host path outside the repository, make sure it is available inside Docker. You can add an extra bind mount in `docker-compose.override.yml`, for example:
  ```yaml
  services:
    dev:
      volumes:
        - /path/to/plugin:/plugin-output
  ```
  and then point `.build-target` to `/plugin-output`.

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
