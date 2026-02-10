<template>
  <div class="app">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <img src="/icon.svg" alt="Logo" class="logo" />
        <span v-if="!sidebarCollapsed" class="app-title">Pulse SG</span>
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
        <div class="tab-content-header">
          <h1>System Overview</h1>
          <span class="machine-count">{{ machineIds.length }} machine{{ machineIds.length === 1 ? '' : 's' }}</span>
        </div>
        <div v-if="machineIds.length === 0" class="loading-state">Loading session...</div>
        <template v-else>
          <section
            v-for="machineId in machineIds"
            :key="machineId"
            class="machine-section"
            :class="{ 'machine-section--stale': staleMachineIds[machineId] }"
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
                :value-max="machines[machineId]?.memoryMax ?? 0"
                unit="MB"
                :decimals="0"
                :history="[]"
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

      <!-- Advanced Tab: one section per machine -->
      <div v-if="activeTab === 'advanced'" class="tab-content">
        <h1>Advanced Metrics</h1>
        <div v-if="machineIds.length === 0" class="loading-state">Loading session...</div>
        <template v-else>
          <section
            v-for="machineId in machineIds"
            :key="machineId"
            class="machine-section"
            :class="{ 'machine-section--stale': staleMachineIds[machineId] }"
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

      <!-- Settings Tab: API config -->
      <div v-if="activeTab === 'settings'" class="tab-content">
        <h1>API &amp; Update Config</h1>
        <div class="settings-section">
          <div class="settings-field">
            <label for="api-host">API host</label>
            <input id="api-host" v-model.trim="config.apiHost" type="text" placeholder="e.g. localhost or 10.0.0.1" />
          </div>
          <div class="settings-field">
            <label for="api-port">API port</label>
            <input id="api-port" v-model.number="config.apiPort" type="number" min="1" max="65535" placeholder="80" />
          </div>
          <div class="settings-field">
            <label for="update-rate">Update rate (ms)</label>
            <input id="update-rate" v-model.number="config.updateRateMs" type="number" min="0" max="5000" placeholder="10" />
            <span class="settings-hint">0 = no throttling; 1–5000 = min interval (ms) between updates</span>
          </div>
          <div class="settings-actions">
            <button type="button" class="btn-primary" @click="saveConfig">Save</button>
            <button type="button" class="btn-ghost" @click="resetConfig">Reset to defaults</button>
          </div>
          <p v-if="configSaved" class="config-saved">Config saved. REST API will use the new host/port; refresh the page to reconnect Live Update to a new host.</p>
        </div>
      </div>
    </main>

    <!-- Connection Overlay -->
    <LiveUpdateOverlay :liveUpdate="liveUpdate" />

    <!-- Per-machine Live Update connections for remote machines (actors/understudies). Director uses the single connection above. -->
    <MachineLiveUpdate
      v-for="id in remoteMachineIds"
      :key="id"
      :machine-id="id"
      :machine="machines[id]"
      :director-endpoint="directorEndpoint"
      :update-rate-ms="config.updateRateMs > 0 ? config.updateRateMs : 500"
      :is-stale="!!staleMachineIds[id]"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, reactive } from 'vue'
import { useLiveUpdate, LiveUpdateOverlay } from '@disguise-one/vue-liveupdate'
import MetricCard from './components/MetricCard.vue'
import AlertManager from './components/AlertManager.vue'
import MachineLiveUpdate from './components/MachineLiveUpdate.vue'
import { useMetricsStore } from './stores/metrics'

// API config: load from localStorage or derive from URL/env
const urlParams = new URLSearchParams(window.location.search)
const { hostname, protocol } = window.location

function getDefaultEndpoint() {
  let ep = urlParams.get('director') || null
  if (!ep) {
    const fromEnv = (import.meta.env.VITE_DIRECTOR ?? '').trim()
    if (fromEnv) ep = fromEnv.replace(/^https?:\/\//i, '').trim()
    else {
      if (protocol === 'file:' || !hostname) ep = 'localhost:80'
      else ep = hostname === 'localhost' || hostname === '127.0.0.1' ? 'localhost:80' : `${hostname}:80`
    }
  }
  return ep.replace(/^https?:\/\//i, '').trim()
}

function loadConfig() {
  const defaultEp = getDefaultEndpoint()
  const [defaultHost, defaultPort] = defaultEp.includes(':') ? defaultEp.split(':') : [defaultEp, 80]
  try {
    const raw = localStorage.getItem('pulse_sg_api_config')
    const parsed = raw ? JSON.parse(raw) : null
    const apiHost = (parsed?.apiHost ?? defaultHost).toString().trim() || defaultHost
    const apiPort = Math.min(65535, Math.max(1, Number(parsed?.apiPort) || Number(defaultPort) || 80))
    const updateRateMs = Math.min(5000, Math.max(0, Number(parsed?.updateRateMs) ?? 10))
    return { apiHost, apiPort, updateRateMs }
  } catch {
    return { apiHost: defaultHost, apiPort: Number(defaultPort) || 80, updateRateMs: 10 }
  }
}

const config = reactive(loadConfig())
const directorEndpoint = computed(() => `${config.apiHost}:${config.apiPort}`)
const apiBaseUrl = computed(() => `http://${config.apiHost}:${config.apiPort}`)

// Live Update uses config endpoint (refresh page after changing host/port to apply)
const liveUpdate = useLiveUpdate(`${config.apiHost}:${config.apiPort}`)

// Initialize metrics store
const store = useMetricsStore()

// UI State
const activeTab = ref('overview')
const sidebarCollapsed = ref(false)
const configSaved = ref(false)

function saveConfig() {
  const port = Math.min(65535, Math.max(1, Number(config.apiPort) || 80))
  const updateRateMs = Math.min(5000, Math.max(0, Number(config.updateRateMs) ?? 10))
  config.apiPort = port
  config.updateRateMs = updateRateMs
  localStorage.setItem('pulse_sg_api_config', JSON.stringify({ apiHost: config.apiHost, apiPort: config.apiPort, updateRateMs: config.updateRateMs }))
  store.setUpdateRate(config.updateRateMs)
  stopIntervals()
  startIntervals()
  configSaved.value = true
  setTimeout(() => { configSaved.value = false }, 3000)
}

function resetConfig() {
  const defaultEp = getDefaultEndpoint()
  const [h, p] = defaultEp.includes(':') ? defaultEp.split(':') : [defaultEp, 80]
  config.apiHost = h
  config.apiPort = Number(p) || 80
  config.updateRateMs = 10
  configSaved.value = false
}

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
  },
  { 
    id: 'settings', 
    label: 'Settings',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  }
]

// Computed properties from store (unwrap refs for template)
const machineIds = computed(() => store.machineIds.value)
const machines = computed(() => store.machines.value)
const remoteMachineIds = computed(() => (store.machineIds.value || []).filter(id => store.machines.value[id] && !store.machines.value[id].isLocal))
const alertConfigs = computed(() => store.alertConfigs.value)
const alertCount = computed(() => store.alertCount.value)
const isConnected = computed(() => store.isConnected.value)

// Stale machines: all overview metrics (cpu, gpu, memory, fps) silent for 5s (one stuck value can't keep it live)
const staleTick = ref(0)
const OVERVIEW_KEYS = ['cpuLoad', 'gpuLoad', 'memoryUsage', 'fps']
const staleMachineIds = computed(() => {
  staleTick.value // force dependency so computed re-runs on interval and when metrics change
  const now = Date.now()
  const ids = store.machineIds.value || []
  const mach = store.machines.value
  const stale = {}
  for (const id of ids) {
    const m = mach[id]
    if (!m) continue
    const lastByKey = m.metricLastUpdateAt || {}
    const oldest = Math.min(...OVERVIEW_KEYS.map(k => lastByKey[k] || 0))
    if (oldest === 0 || (now - oldest > 5000)) stale[id] = true
  }
  return stale
})

// When any machine receives new overview data, re-run stale check so "stale" clears immediately when machine comes back
watch(
  () => (store.machineIds.value || []).map(id => {
    const m = store.machines.value[id]
    const last = m?.metricLastUpdateAt || {}
    return OVERVIEW_KEYS.map(k => last[k] || 0).join(',')
  }).join('|'),
  () => { staleTick.value++ }
)

// Per-machine subscription refs (Overview: fps, cpu, gpu, memory; Advanced: diskRead, diskWrite)
const overviewSubscriptions = reactive({})
const advancedSubscriptions = reactive({})

// When machines are set, create Live Update subscriptions only for the director (local) machine.
// Remote machines (actors/understudies) use MachineLiveUpdate: one WebSocket per machine with findLocalMonitor (like the working Pulse plugin).
function objectPathLocal(monitorName) {
  return `subsystem:MonitoringManager.findLocalMonitor("${monitorName}")`
}

watch(
  () => store.machineIds.value,
  (ids) => {
    const currentIds = new Set(ids || [])
    // Clean up director subscriptions for machine IDs no longer in the list
    const allSubKeys = new Set([
      ...Object.keys(overviewSubscriptions),
      ...Object.keys(advancedSubscriptions)
    ])
    for (const machineId of allSubKeys) {
      if (currentIds.has(machineId)) continue
      const ov = overviewSubscriptions[machineId]
      if (ov) {
        Object.values(ov).forEach((sub) => typeof sub?.unsubscribe === 'function' && sub.unsubscribe())
        delete overviewSubscriptions[machineId]
      }
      const adv = advancedSubscriptions[machineId]
      if (adv) {
        Object.values(adv).forEach((sub) => typeof sub?.unsubscribe === 'function' && sub.unsubscribe())
        delete advancedSubscriptions[machineId]
      }
    }
    if (!ids || ids.length === 0) return
    for (const machineId of ids) {
      if (overviewSubscriptions[machineId]) continue
      const machine = store.machines.value[machineId]
      if (!machine || !machine.isLocal) continue

      overviewSubscriptions[machineId] = {
        fps: liveUpdate.subscribe(objectPathLocal('fps'), { value: 'object.seriesAverage("Actual", 1)' }),
        cpuLoad: liveUpdate.subscribe(objectPathLocal('Machine'), { value: 'object.seriesAverage("CPU Time", 1)' }),
        gpuLoad: liveUpdate.subscribe(objectPathLocal('Machine'), { value: 'object.seriesAverage("GPU Time", 1)' }),
        memoryUsage: liveUpdate.subscribe(objectPathLocal('ProcessMemory'), {
          value: 'object.seriesAverage("Usage (MB)", 1)',
          memoryMax: 'object.seriesAverage("Physical Memory (MB)", 1)'
        })
      }
      advancedSubscriptions[machineId] = {
        diskRead: liveUpdate.subscribe(objectPathLocal('Disk'), { value: 'object.seriesAverage("Read (MB/s)", 1)' }),
        diskWrite: liveUpdate.subscribe(objectPathLocal('Disk'), { value: 'object.seriesAverage("Write (MB/s)", 1)' })
      }

      const ov = overviewSubscriptions[machineId]
      const pushOv = (ref, key) => watch(() => ref?.value, (val) => {
        const v = typeof val === 'number' ? val : val?.value
        if (v != null) store.updateMetric(machineId, key, v)
      }, { deep: true })
      pushOv(ov.fps, 'fps')
      pushOv(ov.cpuLoad, 'cpuLoad')
      pushOv(ov.gpuLoad, 'gpuLoad')
      pushOv(ov.memoryUsage, 'memoryUsage')
      watch(ov.memoryUsage.memoryMax, (v) => {
        const n = typeof v === 'number' ? v : v?.value
        if (typeof n === 'number' && n > 0) store.setMemoryMax(machineId, n)
      })
      const adv = advancedSubscriptions[machineId]
      pushOv(adv.diskRead, 'diskRead')
      pushOv(adv.diskWrite, 'diskWrite')
    }
  },
  { immediate: true, deep: true }
)

// Freeze/thaw tab subscriptions: Overview (fps, cpu, gpu, mem); Advanced (disk only)
watch(activeTab, (newTab, oldTab) => {
  if (newTab === 'overview') {
    Object.values(overviewSubscriptions).forEach(s => {
      s?.fps?.thaw?.()
      s?.cpuLoad?.thaw?.()
      s?.gpuLoad?.thaw?.()
      s?.memoryUsage?.thaw?.()
    })
  } else if (oldTab === 'overview') {
    Object.values(overviewSubscriptions).forEach(s => {
      s?.fps?.freeze?.()
      s?.cpuLoad?.freeze?.()
      s?.gpuLoad?.freeze?.()
      s?.memoryUsage?.freeze?.()
    })
  }
  if (newTab === 'advanced') {
    Object.values(advancedSubscriptions).forEach(s => {
      s?.diskRead?.thaw?.()
      s?.diskWrite?.thaw?.()
    })
  } else if (oldTab === 'advanced') {
    Object.values(advancedSubscriptions).forEach(s => {
      s?.diskRead?.freeze?.()
      s?.diskWrite?.freeze?.()
    })
  }
}, { immediate: true })

// Freeze/thaw director (local machine) subscriptions when stale status changes
watch(staleMachineIds, (staleMap, oldStaleMap) => {
  const ids = store.machineIds.value || []
  for (const machineId of ids) {
    const machine = store.machines.value[machineId]
    if (!machine?.isLocal) continue

    const isStale = !!staleMap[machineId]
    const wasStale = !!(oldStaleMap && oldStaleMap[machineId])

    if (isStale && !wasStale) {
      // Freeze director subscriptions
      const ov = overviewSubscriptions[machineId]
      const adv = advancedSubscriptions[machineId]
      ov?.fps?.freeze?.()
      ov?.cpuLoad?.freeze?.()
      ov?.gpuLoad?.freeze?.()
      ov?.memoryUsage?.freeze?.()
      adv?.diskRead?.freeze?.()
      adv?.diskWrite?.freeze?.()
    } else if (!isStale && wasStale) {
      // Thaw director subscriptions
      const ov = overviewSubscriptions[machineId]
      const adv = advancedSubscriptions[machineId]
      ov?.fps?.thaw?.()
      ov?.cpuLoad?.thaw?.()
      ov?.gpuLoad?.thaw?.()
      ov?.memoryUsage?.thaw?.()
      adv?.diskRead?.thaw?.()
      adv?.diskWrite?.thaw?.()
      liveUpdate.reconnect()
    }
  }
}, { deep: true })

// Read subscription value (library may expose number or { value } ref)
function readSubValue(raw) {
  return typeof raw === 'number' ? raw : raw?.value
}

// Poll subscription refs and push to store (library refs may not be Vue-reactive when populated async)
let metricsPollInterval = null
function pollMetricRefs() {
  const ids = store.machineIds.value
  if (ids?.length) {
    for (const machineId of ids) {
      if (activeTab.value === 'overview') {
        const ov = overviewSubscriptions[machineId]
        if (ov) {
          const fps = readSubValue(ov.fps?.value)
          const cpu = readSubValue(ov.cpuLoad?.value)
          const gpu = readSubValue(ov.gpuLoad?.value)
          const mem = readSubValue(ov.memoryUsage?.value)
          const memMax = readSubValue(ov.memoryUsage?.memoryMax)
          if (typeof fps === 'number') store.updateMetric(machineId, 'fps', fps)
          if (typeof cpu === 'number') store.updateMetric(machineId, 'cpuLoad', cpu)
          if (typeof gpu === 'number') store.updateMetric(machineId, 'gpuLoad', gpu)
          if (typeof mem === 'number') store.updateMetric(machineId, 'memoryUsage', mem)
          if (typeof memMax === 'number' && memMax > 0) store.setMemoryMax(machineId, memMax)
        }
      }
      if (activeTab.value !== 'advanced') continue
      const adv = advancedSubscriptions[machineId]
      if (!adv) continue
      const dr = readSubValue(adv.diskRead?.value)
      const dw = readSubValue(adv.diskWrite?.value)
      if (typeof dr === 'number') store.updateMetric(machineId, 'diskRead', dr)
      if (typeof dw === 'number') store.updateMetric(machineId, 'diskWrite', dw)
    }
  }
}

// Fetch session to get director + actors (machine list)
async function fetchSession() {
  try {
    const response = await fetch(`${apiBaseUrl.value}/api/session/status/session`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const result = data.result
    if (!result) return

    let list = []
    if (result.isRunningSolo) {
      const host = directorEndpoint.value.split(':')[0]
      list = [{
        uid: directorEndpoint.value,
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
    const newIds = list.map((m) => m.uid || m.id || m.hostname || '').filter(Boolean)
    const currentIds = store.machineIds.value || []
    const same =
      newIds.length === currentIds.length &&
      newIds.every((id, i) => id === currentIds[i])
    if (!same) store.setMachines(list)
  } catch (error) {
    console.warn('Failed to fetch session:', error.message)
  }
}

// Fetch machine health (for connection status)
async function fetchHealthMetrics() {
  try {
    const response = await fetch(`${apiBaseUrl.value}/api/session/status/health`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await response.json()
    store.setConnected(true)
  } catch (error) {
    console.warn('Failed to fetch health metrics:', error.message)
    store.setConnected(false)
  }
}

const SESSION_POLL_MS = 10_000

let healthPollInterval = null
let sessionPollInterval = null

function getPollMs() {
  return config.updateRateMs > 0 ? config.updateRateMs : 500
}

function startIntervals() {
  if (healthPollInterval) return
  const ms = getPollMs()
  healthPollInterval = setInterval(fetchHealthMetrics, ms)
  metricsPollInterval = setInterval(pollMetricRefs, ms)
  sessionPollInterval = setInterval(fetchSession, SESSION_POLL_MS)
}

function stopIntervals() {
  if (healthPollInterval) {
    clearInterval(healthPollInterval)
    healthPollInterval = null
  }
  if (metricsPollInterval) {
    clearInterval(metricsPollInterval)
    metricsPollInterval = null
  }
  if (sessionPollInterval) {
    clearInterval(sessionPollInterval)
    sessionPollInterval = null
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') startIntervals()
  else stopIntervals()
}

let staleCheckInterval = null
onMounted(() => {
  store.setUpdateRate(config.updateRateMs)
  liveUpdate.reconnect()
  fetchSession()
  fetchHealthMetrics()
  startIntervals()
  document.addEventListener('visibilitychange', onVisibilityChange)
  staleCheckInterval = setInterval(() => { staleTick.value++ }, 5000)
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  stopIntervals()
  if (staleCheckInterval) clearInterval(staleCheckInterval)
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
  padding: 16px;
}

.tab-content-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.tab-content-header h1 {
  margin-bottom: 0;
}

.tab-content h1 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #FFF;
}

.machine-count {
  font-size: 14px;
  font-weight: 500;
  color: #888;
  flex-shrink: 0;
}

.loading-state {
  color: #888;
  padding: 24px 0;
}

.machine-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #333;
}

.machine-section:last-child {
  border-bottom: none;
}

.machine-section--stale {
  background: rgba(255, 82, 82, 0.15);
  border-radius: 8px;
  padding: 12px 12px 16px 12px;
  margin: 0 0 20px 0;
  border-bottom: none;
}

.machine-section--stale:last-child {
  margin-bottom: 0;
}

.machine-section-title {
  font-size: 15px;
  font-weight: 600;
  color: #FFF;
  margin-bottom: 28px;
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
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
  align-items: start;
}

/* Settings tab */
.settings-section {
  max-width: 420px;
  margin-top: 1rem;
  padding: 1.25rem;
  background: var(--card-bg, #1E1E1E);
  border: 1px solid var(--border, #333);
  border-radius: var(--radius, 8px);
}

.settings-field {
  margin-bottom: 1rem;
}

.settings-field label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary, #AAA);
  margin-bottom: 0.35rem;
}

.settings-field input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.9375rem;
  background: #252525;
  border: 1px solid #333;
  border-radius: 6px;
  color: #FFF;
}

.settings-field input:focus {
  outline: none;
  border-color: var(--accent, #6BFFDC);
}

.settings-hint {
  display: block;
  font-size: 0.75rem;
  color: #888;
  margin-top: 0.25rem;
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.settings-actions .btn-primary {
  padding: 0.5rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 6px;
  background: var(--accent, #6BFFDC);
  color: #0d1117;
  transition: background 0.2s, transform 0.1s;
}

.settings-actions .btn-primary:hover {
  background: #8affe8;
  transform: translateY(-1px);
}

.settings-actions .btn-primary:active {
  transform: translateY(0);
}

.settings-actions .btn-ghost {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  border-radius: 6px;
  color: #888;
  background: transparent;
  border: 1px solid #444;
}

.settings-actions .btn-ghost:hover {
  color: #ccc;
  border-color: #555;
  background: #252525;
}

.config-saved {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: var(--accent, #6BFFDC);
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
