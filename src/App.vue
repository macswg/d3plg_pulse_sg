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
      <!-- Overview Tab: one section per machine -->
      <div v-if="activeTab === 'overview'" class="tab-content">
        <h1>System Overview</h1>
        <div v-if="machineIds.length === 0" class="loading-state">Loading session...</div>
        <template v-else>
          <section
            v-for="machineId in machineIds"
            :key="machineId"
            class="machine-section"
          >
            <h2 class="machine-section-title">
              {{ machines[machineId]?.name || machineId }}
              <span v-if="machines[machineId]?.isLocal" class="local-badge">(this machine)</span>
            </h2>
            <div class="metrics-grid">
              <MetricCard
                title="CPU Load"
                :value="machines[machineId]?.metrics?.cpuLoad ?? 0"
                unit="%"
                :history="machines[machineId]?.history?.cpuLoad ?? []"
                :thresholds="{ warning: 80, critical: 90 }"
                :alertConfig="alertConfigs.cpuLoad"
                @configure="openAlertConfig('cpuLoad')"
              />
              <MetricCard
                title="GPU Load"
                :value="machines[machineId]?.metrics?.gpuLoad ?? 0"
                unit="%"
                :history="machines[machineId]?.history?.gpuLoad ?? []"
                :thresholds="{ warning: 80, critical: 90 }"
                :alertConfig="alertConfigs.gpuLoad"
                @configure="openAlertConfig('gpuLoad')"
              />
              <MetricCard
                title="Memory Usage"
                :value="machines[machineId]?.metrics?.memoryUsage ?? 0"
                unit="MB"
                :decimals="0"
                :history="machines[machineId]?.history?.memoryUsage ?? []"
                :thresholds="{ warning: 4000, critical: 8000 }"
                :alertConfig="alertConfigs.memoryUsage"
                @configure="openAlertConfig('memoryUsage')"
              />
              <MetricCard
                title="Frame Rate"
                :value="machines[machineId]?.metrics?.fps ?? 0"
                unit="FPS"
                :history="machines[machineId]?.history?.fps ?? []"
                :thresholds="{ warning: 50, critical: 30 }"
                :alertConfig="{ ...alertConfigs.fps, comparison: 'less' }"
                @configure="openAlertConfig('fps')"
              />
            </div>
          </section>
        </template>
      </div>

      <!-- Advanced Tab: one section per machine + playhead -->
      <div v-if="activeTab === 'advanced'" class="tab-content">
        <h1>Advanced Metrics</h1>
        <!-- Playhead (session-wide) -->
        <div class="playhead-section">
          <h2>Playhead Position</h2>
          <div class="playhead-value">{{ playheadTRender.toFixed(2) }}s</div>
        </div>
        <div v-if="machineIds.length === 0" class="loading-state">Loading session...</div>
        <template v-else>
          <section
            v-for="machineId in machineIds"
            :key="machineId"
            class="machine-section"
          >
            <h2 class="machine-section-title">
              {{ machines[machineId]?.name || machineId }}
              <span v-if="machines[machineId]?.isLocal" class="local-badge">(this machine)</span>
            </h2>
            <div class="metrics-grid">
              <MetricCard
                title="Disk Read"
                :value="machines[machineId]?.metrics?.diskRead ?? 0"
                unit="MB/s"
                :decimals="2"
                :history="machines[machineId]?.history?.diskRead ?? []"
                @configure="openAlertConfig('diskRead')"
              />
              <MetricCard
                title="Disk Write"
                :value="machines[machineId]?.metrics?.diskWrite ?? 0"
                unit="MB/s"
                :decimals="2"
                :history="machines[machineId]?.history?.diskWrite ?? []"
                @configure="openAlertConfig('diskWrite')"
              />
            </div>
          </section>
        </template>
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
import { ref, computed, watch, onMounted, onUnmounted, reactive } from 'vue'
import { useLiveUpdate, LiveUpdateOverlay } from '@disguise-one/vue-liveupdate'
import MetricCard from './components/MetricCard.vue'
import AlertManager from './components/AlertManager.vue'
import { useMetricsStore } from './stores/metrics'

// Extract the director endpoint for Live Update and REST API
// When running in Disguise Designer the plugin may be loaded from file:// (built output),
// so we must not rely on window.location.protocol or hostname for the director.
const urlParams = new URLSearchParams(window.location.search)
const { hostname, protocol } = window.location

// Director: prefer query param (Designer injects this), then sensible defaults
let directorEndpoint = urlParams.get('director') || null
if (!directorEndpoint) {
  // file:// or empty hostname => same machine as Designer => localhost
  if (protocol === 'file:' || !hostname) {
    directorEndpoint = 'localhost:80'
  } else {
    directorEndpoint = hostname === 'localhost' || hostname === '127.0.0.1'
      ? 'localhost:80'
      : `${hostname}:80`
  }
}

// Strip any protocol the param might contain (e.g. "http://localhost:80" -> "localhost:80")
directorEndpoint = directorEndpoint.replace(/^https?:\/\//i, '').trim()

// REST API base URL: always use http when talking to the director (never file:)
const apiBaseUrl = `http://${directorEndpoint}`

// Initialize live update (uses ws:// with this host:port)
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

// Computed properties from store (unwrap refs for template)
const machineIds = computed(() => store.machineIds.value)
const machines = computed(() => store.machines.value)
const alertConfigs = computed(() => store.alertConfigs.value)
const alertCount = computed(() => store.alertCount.value)
const isConnected = computed(() => store.isConnected.value)
const playheadTRender = computed(() => store.playheadTRender.value ?? 0)

// Session-wide playhead (Advanced tab)
const playheadMonitor = liveUpdate.subscribe(
  'transportManager:default',
  { tRender: 'object.player.tRender' }
)

// Per-machine subscription refs (Overview: fps, cpu, gpu, memory; Advanced: diskRead, diskWrite)
const overviewSubscriptions = reactive({})
const advancedSubscriptions = reactive({})

function objectPath(machine, monitorName) {
  if (machine.isLocal) {
    return `subsystem:MonitoringManager.findLocalMonitor("${monitorName}")`
  }
  const host = (machine.hostname || 'localhost').toString().toLowerCase()
  return `subsystem:MonitoringManager.findRemoteMonitor("${host}", "${monitorName}")`
}

// When machines are set, create Live Update subscriptions per machine
watch(
  () => store.machineIds.value,
  (ids) => {
    if (!ids || ids.length === 0) return
    for (const machineId of ids) {
      if (overviewSubscriptions[machineId]) continue
      const machine = store.machines.value[machineId]
      if (!machine) continue

      const obj = (name) => objectPath(machine, name)
      overviewSubscriptions[machineId] = {
        fps: liveUpdate.subscribe(obj('fps'), { value: 'object.seriesAverage("Actual", 1)' }),
        cpuLoad: liveUpdate.subscribe(obj('Machine'), { value: 'object.seriesAverage("CPU Time", 1)' }),
        gpuLoad: liveUpdate.subscribe(obj('Machine'), { value: 'object.seriesAverage("GPU Time", 1)' }),
        memoryUsage: liveUpdate.subscribe(obj('ProcessMemory'), { value: 'object.seriesAverage("Usage (MB)", 1)' })
      }
      advancedSubscriptions[machineId] = {
        diskRead: liveUpdate.subscribe(obj('Disk'), { value: 'object.seriesAverage("Read (MB/s)", 1)' }),
        diskWrite: liveUpdate.subscribe(obj('Disk'), { value: 'object.seriesAverage("Write (MB/s)", 1)' })
      }

      // Watchers: push subscription values to store (ref may be populated async)
      const ov = overviewSubscriptions[machineId]
      const pushOv = (ref, key) => watch(() => ref?.value, (val) => {
        const v = typeof val === 'number' ? val : val?.value
        if (v != null) store.updateMetric(machineId, key, v)
      }, { deep: true })
      pushOv(ov.fps, 'fps')
      pushOv(ov.cpuLoad, 'cpuLoad')
      pushOv(ov.gpuLoad, 'gpuLoad')
      pushOv(ov.memoryUsage, 'memoryUsage')
      const adv = advancedSubscriptions[machineId]
      pushOv(adv.diskRead, 'diskRead')
      pushOv(adv.diskWrite, 'diskWrite')
    }
  },
  { immediate: true, deep: true }
)

// Playhead: update store and freeze when not on Advanced
watch(() => playheadMonitor.tRender?.value, (v) => {
  if (v != null) store.setPlayheadTRender(v)
}, { deep: true })
playheadMonitor.tRender?.freeze?.()

// Freeze/thaw Advanced tab subscriptions (disk per machine + playhead)
watch(activeTab, (newTab, oldTab) => {
  if (newTab === 'advanced') {
    Object.values(advancedSubscriptions).forEach(s => {
      s?.diskRead?.thaw?.()
      s?.diskWrite?.thaw?.()
    })
    playheadMonitor.tRender?.thaw?.()
  } else if (oldTab === 'advanced') {
    Object.values(advancedSubscriptions).forEach(s => {
      s?.diskRead?.freeze?.()
      s?.diskWrite?.freeze?.()
    })
    playheadMonitor.tRender?.freeze?.()
  }
}, { immediate: true })

// Read subscription value (library may expose number or { value } ref)
function readSubValue(raw) {
  return typeof raw === 'number' ? raw : raw?.value
}

// Poll subscription refs and push to store (library refs may not be Vue-reactive when populated async)
let metricsPollInterval = null
function pollMetricRefs() {
  const ids = store.machineIds.value
  if (!ids?.length) return
  for (const machineId of ids) {
    const ov = overviewSubscriptions[machineId]
    if (!ov) continue
    const fps = readSubValue(ov.fps?.value)
    const cpu = readSubValue(ov.cpuLoad?.value)
    const gpu = readSubValue(ov.gpuLoad?.value)
    const mem = readSubValue(ov.memoryUsage?.value)
    if (typeof fps === 'number') store.updateMetric(machineId, 'fps', fps)
    if (typeof cpu === 'number') store.updateMetric(machineId, 'cpuLoad', cpu)
    if (typeof gpu === 'number') store.updateMetric(machineId, 'gpuLoad', gpu)
    if (typeof mem === 'number') store.updateMetric(machineId, 'memoryUsage', mem)
    if (activeTab.value !== 'advanced') continue
    const adv = advancedSubscriptions[machineId]
    if (!adv) continue
    const dr = readSubValue(adv.diskRead?.value)
    const dw = readSubValue(adv.diskWrite?.value)
    if (typeof dr === 'number') store.updateMetric(machineId, 'diskRead', dr)
    if (typeof dw === 'number') store.updateMetric(machineId, 'diskWrite', dw)
  }
}

// Fetch session to get director + actors (machine list)
async function fetchSession() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/session/status/session`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const result = data.result
    if (!result) return

    let list = []
    if (result.isRunningSolo) {
      const host = directorEndpoint.split(':')[0]
      list = [{
        uid: directorEndpoint,
        name: 'Local Machine',
        hostname: host || 'localhost',
        isLocal: true
      }]
    } else {
      const director = result.director
      const actors = result.actors || []
      const understudies = result.understudies || []
      list = [
        { ...director, uid: director?.uid || director?.hostname || 'director', isLocal: true },
        ...actors.map(a => ({ ...a, uid: a?.uid || a?.hostname, isLocal: false })),
        ...understudies.map(u => ({ ...u, uid: u?.uid || u?.hostname, isLocal: false }))
      ]
    }
    store.setMachines(list)
  } catch (error) {
    console.warn('Failed to fetch session:', error.message)
  }
}

// Fetch machine health (for connection status)
async function fetchHealthMetrics() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/session/status/health`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await response.json()
    store.setConnected(true)
  } catch (error) {
    console.warn('Failed to fetch health metrics:', error.message)
    store.setConnected(false)
  }
}

let healthPollInterval = null

onMounted(() => {
  fetchSession()
  fetchHealthMetrics()
  healthPollInterval = setInterval(() => {
    fetchHealthMetrics()
  }, 1000)
  metricsPollInterval = setInterval(pollMetricRefs, 800)
})

// Cleanup on unmount
onUnmounted(() => {
  if (healthPollInterval) {
    clearInterval(healthPollInterval)
  }
  if (metricsPollInterval) {
    clearInterval(metricsPollInterval)
  }
})

// Actions
function openAlertConfig(metricKey) {
  // For now, just switch to alerts tab
  activeTab.value = 'alerts'
}

function viewMetric(payload) {
  // Payload can be metricKey (string) or { machineId, metricKey } from AlertManager
  const metricKey = typeof payload === 'string' ? payload : payload?.metricKey
  if (!metricKey) return
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

.loading-state {
  color: #888;
  padding: 24px 0;
}

.machine-section {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #333;
}

.machine-section:last-child {
  border-bottom: none;
}

.machine-section-title {
  font-size: 18px;
  font-weight: 600;
  color: #FFF;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.local-badge {
  font-size: 12px;
  font-weight: 400;
  color: #6BFFDC;
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
