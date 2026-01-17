<template>
  <div class="app">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <img src="/icon.svg" alt="Logo" class="logo" />
        <span v-if="!sidebarCollapsed" class="app-title">Pulse Monitor</span>
      </div>
      
      <nav class="nav-tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          class="nav-tab"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <span class="tab-icon" v-html="tab.icon"></span>
          <span v-if="!sidebarCollapsed" class="tab-label">{{ tab.label }}</span>
          <span v-if="tab.id === 'alerts' && alertCount > 0" class="badge">{{ alertCount }}</span>
        </button>
      </nav>
      
      <div class="sidebar-footer">
        <div class="connection-status" :class="{ connected: isConnected }">
          <span class="status-dot"></span>
          <span v-if="!sidebarCollapsed">{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
        </div>
        <button class="collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline :points="sidebarCollapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6'"></polyline>
          </svg>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'" class="tab-content">
        <h1>System Overview</h1>
        <div class="metrics-grid">
          <MetricCard
            title="CPU Load"
            :value="metrics.cpuLoad"
            unit="%"
            :history="history.cpuLoad"
            :thresholds="{ warning: 80, critical: 90 }"
            :alertConfig="alertConfigs.cpuLoad"
            @configure="openAlertConfig('cpuLoad')"
          />
          <MetricCard
            title="GPU Load"
            :value="metrics.gpuLoad"
            unit="%"
            :history="history.gpuLoad"
            :thresholds="{ warning: 80, critical: 90 }"
            :alertConfig="alertConfigs.gpuLoad"
            @configure="openAlertConfig('gpuLoad')"
          />
          <MetricCard
            title="Memory Usage"
            :value="metrics.memoryUsage"
            unit="MB"
            :decimals="0"
            :history="history.memoryUsage"
            :thresholds="{ warning: 4000, critical: 8000 }"
            :alertConfig="alertConfigs.memoryUsage"
            @configure="openAlertConfig('memoryUsage')"
          />
          <MetricCard
            title="Frame Rate"
            :value="metrics.fps"
            unit="FPS"
            :history="history.fps"
            :thresholds="{ warning: 50, critical: 30 }"
            :alertConfig="{ ...alertConfigs.fps, comparison: 'less' }"
            @configure="openAlertConfig('fps')"
          />
        </div>
      </div>

      <!-- Advanced Tab -->
      <div v-if="activeTab === 'advanced'" class="tab-content">
        <h1>Advanced Metrics</h1>
        <div class="metrics-grid">
          <MetricCard
            title="Disk Read"
            :value="metrics.diskRead"
            unit="MB/s"
            :decimals="2"
            :history="history.diskRead"
            @configure="openAlertConfig('diskRead')"
          />
          <MetricCard
            title="Disk Write"
            :value="metrics.diskWrite"
            unit="MB/s"
            :decimals="2"
            :history="history.diskWrite"
            @configure="openAlertConfig('diskWrite')"
          />
        </div>
        
        <!-- Playhead Display -->
        <div class="playhead-section">
          <h2>Playhead Position</h2>
          <div class="playhead-value">{{ player_tRender !== undefined ? player_tRender.toFixed(2) : '0.00' }}s</div>
        </div>
      </div>

      <!-- Alerts Tab -->
      <div v-if="activeTab === 'alerts'" class="tab-content">
        <AlertManager @view-metric="viewMetric" />
      </div>
    </main>

    <!-- Connection Overlay -->
    <LiveUpdateOverlay :liveUpdate="liveUpdate" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useLiveUpdate, LiveUpdateOverlay } from '@disguise-one/vue-liveupdate'
import MetricCard from './components/MetricCard.vue'
import AlertManager from './components/AlertManager.vue'
import { useMetricsStore } from './stores/metrics'

// Extract the director endpoint from the URL query parameters
const urlParams = new URLSearchParams(window.location.search)
const { hostname, protocol } = window.location
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
const defaultDirector = isLocalhost ? 'localhost:80' : `${hostname}:80`
const directorEndpoint = urlParams.get('director') || defaultDirector

// Build the REST API base URL
const apiBaseUrl = `${protocol}//${directorEndpoint}`

// Initialize live update
const liveUpdate = useLiveUpdate(directorEndpoint)

// Initialize metrics store
const store = useMetricsStore()

// UI State
const activeTab = ref('overview')
const sidebarCollapsed = ref(false)

// Navigation tabs
const tabs = [
  { 
    id: 'overview', 
    label: 'Overview',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>'
  },
  { 
    id: 'advanced', 
    label: 'Advanced',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>'
  },
  { 
    id: 'alerts', 
    label: 'Alerts',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>'
  }
]

// Computed properties from store
const metrics = computed(() => store.currentMetrics.value)
const history = computed(() => store.metricHistory.value)
const alertConfigs = computed(() => store.alertConfigs.value)
const alertCount = computed(() => store.alertCount.value)
const isConnected = computed(() => store.isConnected.value)

// Subscribe to playhead via Live Update
const { player_tRender } = liveUpdate.autoSubscribe('transportManager:default', ['object.player.tRender'])

// Subscribe to monitoring graphs via MonitoringManager subsystem
// Using findLocalMonitor to get local machine metrics
// The seriesAverage("<series>", 1) method returns the latest value from the specified series
// See: https://developer.disguise.one/api/session/liveupdate/
//
// Monitor names and series discovered from reference Pulse plugin:
// - Machine monitor: "CPU Time", "GPU Time" series
// - fps monitor: "Actual" series
// - ProcessMemory monitor: "Usage (MB)" series
//
// IMPORTANT: Using subscribe() instead of autoSubscribe() because the property path
// contains special characters (parentheses, quotes). subscribe() allows us to specify
// a custom local name for the property.

// FPS graph - monitor: "fps", series: "Actual"
const fpsMonitor = liveUpdate.subscribe(
  'subsystem:MonitoringManager.findLocalMonitor("fps")',
  { value: 'object.seriesAverage("Actual", 1)' }
)

// CPU Load graph - monitor: "Machine", series: "CPU Time"
const cpuMonitor = liveUpdate.subscribe(
  'subsystem:MonitoringManager.findLocalMonitor("Machine")',
  { value: 'object.seriesAverage("CPU Time", 1)' }
)

// GPU Load graph - monitor: "Machine", series: "GPU Time"
const gpuMonitor = liveUpdate.subscribe(
  'subsystem:MonitoringManager.findLocalMonitor("Machine")',
  { value: 'object.seriesAverage("GPU Time", 1)' }
)

// Process Memory graph - monitor: "ProcessMemory", series: "Usage (MB)"
const memoryMonitor = liveUpdate.subscribe(
  'subsystem:MonitoringManager.findLocalMonitor("ProcessMemory")',
  { value: 'object.seriesAverage("Usage (MB)", 1)' }
)

// Debug: Log monitor subscription values to console
watch([fpsMonitor.value, cpuMonitor.value, gpuMonitor.value, memoryMonitor.value], ([fps, cpu, gpu, mem]) => {
  console.log('Monitor values:', { fps, cpu, gpu, memory: mem })
}, { immediate: true })

// Watch for Live Update metric changes and push to store
// With subscribe(), we used { value: ... } so the property is accessed as monitor.value
watch(() => fpsMonitor.value?.value, (val) => {
  if (val !== undefined && val !== null) {
    store.updateMetric('fps', val)
  }
}, { deep: true })

watch(() => cpuMonitor.value?.value, (val) => {
  if (val !== undefined && val !== null) {
    store.updateMetric('cpuLoad', val)
  }
}, { deep: true })

watch(() => gpuMonitor.value?.value, (val) => {
  if (val !== undefined && val !== null) {
    store.updateMetric('gpuLoad', val)
  }
}, { deep: true })

watch(() => memoryMonitor.value?.value, (val) => {
  if (val !== undefined && val !== null) {
    store.updateMetric('memoryUsage', val)
  }
}, { deep: true })

// Poll interval reference for cleanup
let healthPollInterval = null

// Fetch machine health metrics from REST API
async function fetchHealthMetrics() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/session/status/health`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    store.setConnected(true)
    
    // Process health data for all machines in the session
    if (data.result && Array.isArray(data.result)) {
      let totalFPS = 0
      let droppedFrames = 0
      let missedFrames = 0
      let machineCount = 0
      
      for (const machineHealth of data.result) {
        if (machineHealth.status) {
          // Get FPS from health endpoint (this works reliably)
          if (machineHealth.status.averageFPS !== undefined) {
            totalFPS += machineHealth.status.averageFPS
            machineCount++
          }
          if (machineHealth.status.videoDroppedFrames !== undefined) {
            droppedFrames += machineHealth.status.videoDroppedFrames
          }
          if (machineHealth.status.videoMissedFrames !== undefined) {
            missedFrames += machineHealth.status.videoMissedFrames
          }
        }
      }
      
      // Update FPS from health endpoint (average across machines)
      if (machineCount > 0) {
        store.updateMetric('fps', totalFPS / machineCount)
      }
      
      // Use dropped/missed frames for disk activity indicators
      store.updateMetric('diskRead', droppedFrames)
      store.updateMetric('diskWrite', missedFrames)
    }
  } catch (error) {
    console.warn('Failed to fetch health metrics:', error.message)
    store.setConnected(false)
  }
}

// Start polling for health metrics
onMounted(() => {
  // Initial fetch
  fetchHealthMetrics()
  
  // Poll health metrics every 1 second
  healthPollInterval = setInterval(() => {
    fetchHealthMetrics()
  }, 1000)
})

// Cleanup on unmount
onUnmounted(() => {
  if (healthPollInterval) {
    clearInterval(healthPollInterval)
  }
})

// Actions
function openAlertConfig(metricKey) {
  // For now, just switch to alerts tab
  activeTab.value = 'alerts'
}

function viewMetric(metricKey) {
  // Switch to overview or advanced based on metric
  if (['diskRead', 'diskWrite'].includes(metricKey)) {
    activeTab.value = 'advanced'
  } else {
    activeTab.value = 'overview'
  }
}
</script>

<style>
/* Global styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #121212;
  color: #FFFFFF;
  overflow: hidden;
}

.app {
  display: flex;
  height: 100vh;
  width: 100vw;
}

/* Sidebar */
.sidebar {
  width: 240px;
  background: #1A1A1A;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
}

.sidebar.collapsed {
  width: 60px;
}

.sidebar-header {
  padding: 20px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #333;
}

.logo {
  width: 24px;
  height: 24px;
}

.app-title {
  font-weight: 600;
  font-size: 16px;
  color: #FFF;
  white-space: nowrap;
}

.nav-tabs {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #888;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  position: relative;
}

.nav-tab:hover {
  background: #252525;
  color: #FFF;
}

.nav-tab.active {
  background: rgba(107, 255, 220, 0.1);
  color: #6BFFDC;
}

.nav-tab.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 24px;
  background: #6BFFDC;
  border-radius: 0 2px 2px 0;
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-label {
  font-size: 14px;
  white-space: nowrap;
}

.badge {
  background: #FF5252;
  color: #FFF;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: auto;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #888;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #FF5252;
}

.connection-status.connected .status-dot {
  background: #6BFFDC;
}

.collapse-btn {
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.collapse-btn:hover {
  color: #FFF;
  background: #333;
}

/* Main Content */
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.tab-content h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #FFF;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

/* Playhead Section */
.playhead-section {
  background: #1E1E1E;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 20px;
  margin-top: 24px;
}

.playhead-section h2 {
  font-size: 16px;
  color: #AAA;
  margin-bottom: 8px;
}

.playhead-value {
  font-size: 36px;
  font-weight: 700;
  color: #FF6DF0;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1A1A1A;
}

::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #444;
}
</style>
