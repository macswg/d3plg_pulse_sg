import { reactive, computed } from 'vue'

const METRIC_KEYS = ['cpuLoad', 'gpuLoad', 'memoryUsage', 'fps', 'diskRead', 'diskWrite']
const METRIC_KEYS_SET = new Set(METRIC_KEYS)

function createEmptyMetrics() {
  return {
    cpuLoad: 0,
    gpuLoad: 0,
    memoryUsage: 0,
    fps: 0,
    diskRead: 0,
    diskWrite: 0
  }
}

function createEmptyHistory() {
  return {
    cpuLoad: [],
    gpuLoad: [],
    memoryUsage: [],
    fps: [],
    diskRead: [],
    diskWrite: []
  }
}

// Reactive metrics store
const state = reactive({
  // Per-machine data: { [machineId]: { id, name, hostname, isLocal, metrics, history } }
  machines: {},
  machineIds: [],

  // Alert configurations (one per metric, applied to all machines)
  alerts: {
    cpuLoad: { enabled: false, warningThreshold: 80, criticalThreshold: 90 },
    gpuLoad: { enabled: false, warningThreshold: 80, criticalThreshold: 90 },
    memoryUsage: { enabled: false, warningThreshold: 4000, criticalThreshold: 8000 },
    fps: { enabled: false, warningThreshold: 50, criticalThreshold: 30, comparison: 'less' },
    diskRead: { enabled: false, warningThreshold: 2500, criticalThreshold: 3000 },
    diskWrite: { enabled: false, warningThreshold: 2500, criticalThreshold: 3000 }
  },

  // Active alerts: each has machineId, machineName, metricKey, value, severity, message, timestamp
  activeAlerts: [],

  // Connection status
  connected: false,

  // Max history length (safety cap); entries older than 5s are pruned
  maxHistoryLength: 100,

  // Update rate (ms): 0 = no throttling, 1–5000 = min interval between metric updates
  updateRateMs: 10
})

// Set machine list from session API
function setMachines(machinesList) {
  const nextIds = []
  const nextMachines = {}

  for (const m of machinesList) {
    const id = m.uid || m.id || m.hostname || String(Math.random())
    nextIds.push(id)
    const prev = state.machines[id]
    // Hostname for Live Update findRemoteMonitor: director expects nodeName (d3 API); API may also use hostname, address, ip
    const hostname = (m.nodeName || m.hostname || m.address || m.ip || m.IP_address || '').toString().trim()
    nextMachines[id] = {
      id,
      name: m.name || m.hostname || hostname || id,
      hostname: hostname || '',
      isLocal: !!m.isLocal,
      httpPort: m.httpPort ?? 80,
      memoryMax: prev?.memoryMax ?? 0,
      metricLastUpdateAt: prev?.metricLastUpdateAt ? { ...prev.metricLastUpdateAt } : {},
      metrics: prev?.metrics ? { ...prev.metrics } : createEmptyMetrics(),
      history: prev?.history ? { ...prev.history } : createEmptyHistory()
    }
  }

  state.machineIds = nextIds
  state.machines = nextMachines
}

// Set max memory (MB) for a machine (from ProcessMemory "Physical Memory (MB)")
function setMemoryMax(machineId, value) {
  const machine = state.machines[machineId]
  if (!machine) return
  const num = typeof value === 'number' && value > 0 ? value : 0
  if (machine.memoryMax === num) return
  machine.memoryMax = num
}

// Throttle rapid updates per (machineId, key) when updateRateMs > 0
const lastUpdateAt = {}

// Set update rate (0 = no throttling, 1–5000 = min ms between updates)
function setUpdateRate(ms) {
  const n = typeof ms === 'number' ? Math.max(0, Math.min(5000, ms)) : 10
  state.updateRateMs = n
}

// Update a metric value for a specific machine (always update value and history for graphs)
function updateMetric(machineId, key, value) {
  const machine = state.machines[machineId]
  if (!machine || !METRIC_KEYS_SET.has(key)) return

  const throttleKey = `${machineId}:${key}`
  const now = Date.now()
  const throttleMs = state.updateRateMs
  if (throttleMs > 0 && lastUpdateAt[throttleKey] != null && now - lastUpdateAt[throttleKey] < throttleMs) return
  lastUpdateAt[throttleKey] = now

  machine.metrics[key] = value
  if (!machine.metricLastUpdateAt) machine.metricLastUpdateAt = {}
  machine.metricLastUpdateAt[key] = now

  const history = machine.history[key]
  history.push({ value, timestamp: now })

  // Prune old entries efficiently with a single slice
  const fiveSecondsAgo = now - 5000
  let pruneIndex = 0
  while (pruneIndex < history.length && history[pruneIndex].timestamp < fiveSecondsAgo) {
    pruneIndex++
  }
  if (pruneIndex > 0 || history.length > state.maxHistoryLength) {
    const start = Math.max(pruneIndex, history.length - state.maxHistoryLength)
    machine.history[key] = history.slice(start)
  }

  checkAlert(machineId, machine.name, key, value)
}

// Check if value triggers an alert (per machine)
function checkAlert(machineId, machineName, key, value) {
  const alertConfig = state.alerts[key]
  if (!alertConfig || !alertConfig.enabled) return

  const comparison = alertConfig.comparison || 'greater'
  let severity = null

  if (comparison === 'greater') {
    if (value >= alertConfig.criticalThreshold) severity = 'critical'
    else if (value >= alertConfig.warningThreshold) severity = 'warning'
  } else {
    if (value <= alertConfig.criticalThreshold) severity = 'critical'
    else if (value <= alertConfig.warningThreshold) severity = 'warning'
  }

  if (severity) {
    addAlert(machineId, machineName, key, value, severity)
  } else {
    removeAlert(machineId, key)
  }
}

// Add an alert (keyed by machineId + metricKey)
function addAlert(machineId, machineName, metricKey, value, severity) {
  const id = `${machineId}-${metricKey}`
  const existingIndex = state.activeAlerts.findIndex(a => a.machineId === machineId && a.metricKey === metricKey)

  const alert = {
    id: `${id}-${Date.now()}`,
    machineId,
    machineName,
    metricKey,
    value,
    severity,
    timestamp: Date.now(),
    message: `${formatMetricName(metricKey)} is ${severity}: ${value.toFixed(1)}${getMetricUnit(metricKey)}`
  }

  if (existingIndex >= 0) {
    state.activeAlerts[existingIndex] = alert
  } else {
    state.activeAlerts.push(alert)
  }
}

// Remove an alert for a (machine, metric)
function removeAlert(machineId, metricKey) {
  const index = state.activeAlerts.findIndex(a => a.machineId === machineId && a.metricKey === metricKey)
  if (index >= 0) state.activeAlerts.splice(index, 1)
}

// Update alert configuration
function updateAlertConfig(metricKey, config) {
  if (state.alerts[metricKey]) {
    state.alerts[metricKey] = { ...state.alerts[metricKey], ...config }
  }
}

// Set connection status
function setConnected(connected) {
  state.connected = connected
}

// Clear all history (all machines)
function clearHistory() {
  state.machineIds.forEach(id => {
    const m = state.machines[id]
    if (m) METRIC_KEYS.forEach(key => { m.history[key] = [] })
  })
}

// Helper functions
function formatMetricName(key) {
  const names = {
    cpuLoad: 'CPU Load',
    gpuLoad: 'GPU Load',
    memoryUsage: 'Memory Usage',
    fps: 'Frame Rate',
    diskRead: 'Disk Read',
    diskWrite: 'Disk Write'
  }
  return names[key] || key
}

function getMetricUnit(key) {
  const units = {
    cpuLoad: '%',
    gpuLoad: '%',
    memoryUsage: 'MB',
    fps: 'FPS',
    diskRead: 'MB/s',
    diskWrite: 'MB/s'
  }
  return units[key] || ''
}

// Computed getters
const getters = {
  machines: computed(() => state.machines),
  machineIds: computed(() => state.machineIds),
  alertConfigs: computed(() => state.alerts),
  activeAlerts: computed(() => state.activeAlerts),
  isConnected: computed(() => state.connected),
  alertCount: computed(() => state.activeAlerts.length),
  // Backward compat: first machine's metrics/history for any single-machine UI
  currentMetrics: computed(() => {
    const id = state.machineIds[0]
    return id && state.machines[id] ? state.machines[id].metrics : createEmptyMetrics()
  }),
  metricHistory: computed(() => {
    const id = state.machineIds[0]
    return id && state.machines[id] ? state.machines[id].history : createEmptyHistory()
  })
}

export const useMetricsStore = () => ({
  state,
  ...getters,
  setMachines,
  updateMetric,
  setMemoryMax,
  setUpdateRate,
  updateAlertConfig,
  setConnected,
  clearHistory,
  formatMetricName,
  getMetricUnit,
  addAlert,
  removeAlert
})

export default useMetricsStore
