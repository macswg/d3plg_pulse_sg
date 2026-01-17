import { reactive, computed } from 'vue'

// Reactive metrics store
const state = reactive({
  // Current metric values
  metrics: {
    cpuLoad: 0,
    gpuLoad: 0,
    memoryUsage: 0,
    fps: 0,
    diskRead: 0,
    diskWrite: 0
  },
  
  // History for charts (last 60 data points)
  history: {
    cpuLoad: [],
    gpuLoad: [],
    memoryUsage: [],
    fps: [],
    diskRead: [],
    diskWrite: []
  },
  
  // Alert configurations
  alerts: {
    cpuLoad: { enabled: false, warningThreshold: 80, criticalThreshold: 90 },
    gpuLoad: { enabled: false, warningThreshold: 80, criticalThreshold: 90 },
    memoryUsage: { enabled: false, warningThreshold: 4000, criticalThreshold: 8000 },
    fps: { enabled: false, warningThreshold: 50, criticalThreshold: 30, comparison: 'less' }
  },
  
  // Active alerts
  activeAlerts: [],
  
  // Connection status
  connected: false,
  selectedMachine: null,
  
  // Max history length
  maxHistoryLength: 60
})

// Update a metric value and add to history
function updateMetric(key, value) {
  if (state.metrics[key] !== undefined) {
    state.metrics[key] = value
    
    // Add to history with timestamp
    const historyEntry = {
      value,
      timestamp: Date.now()
    }
    
    state.history[key].push(historyEntry)
    
    // Keep history within max length
    if (state.history[key].length > state.maxHistoryLength) {
      state.history[key].shift()
    }
    
    // Check for alerts
    checkAlert(key, value)
  }
}

// Check if value triggers an alert
function checkAlert(key, value) {
  const alertConfig = state.alerts[key]
  if (!alertConfig || !alertConfig.enabled) return
  
  const comparison = alertConfig.comparison || 'greater'
  let severity = null
  
  if (comparison === 'greater') {
    if (value >= alertConfig.criticalThreshold) {
      severity = 'critical'
    } else if (value >= alertConfig.warningThreshold) {
      severity = 'warning'
    }
  } else {
    // 'less' comparison (for FPS)
    if (value <= alertConfig.criticalThreshold) {
      severity = 'critical'
    } else if (value <= alertConfig.warningThreshold) {
      severity = 'warning'
    }
  }
  
  if (severity) {
    addAlert(key, value, severity)
  } else {
    // Remove any existing alert for this metric
    removeAlert(key)
  }
}

// Add an alert
function addAlert(metricKey, value, severity) {
  const existingIndex = state.activeAlerts.findIndex(a => a.metricKey === metricKey)
  
  const alert = {
    id: `${metricKey}-${Date.now()}`,
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

// Remove an alert
function removeAlert(metricKey) {
  const index = state.activeAlerts.findIndex(a => a.metricKey === metricKey)
  if (index >= 0) {
    state.activeAlerts.splice(index, 1)
  }
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

// Set selected machine
function setSelectedMachine(machine) {
  state.selectedMachine = machine
}

// Clear all history
function clearHistory() {
  Object.keys(state.history).forEach(key => {
    state.history[key] = []
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
  currentMetrics: computed(() => state.metrics),
  metricHistory: computed(() => state.history),
  alertConfigs: computed(() => state.alerts),
  activeAlerts: computed(() => state.activeAlerts),
  isConnected: computed(() => state.connected),
  selectedMachine: computed(() => state.selectedMachine),
  alertCount: computed(() => state.activeAlerts.length)
}

// Export store
export const useMetricsStore = () => ({
  state,
  ...getters,
  updateMetric,
  updateAlertConfig,
  setConnected,
  setSelectedMachine,
  clearHistory,
  formatMetricName,
  getMetricUnit,
  addAlert,
  removeAlert
})

export default useMetricsStore
