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
        <div class="footer-info">
          <div class="connection-status" :class="{ connected: isConnected }">
            <span class="status-dot"></span>
            <span v-if="!sidebarCollapsed">{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
          </div>
          <span v-if="!sidebarCollapsed" class="app-version" :title="`Pulse SG v${appVersion}${gitCommit ? ' · ' + gitCommit : ''}`">
            v{{ appVersion }}<span v-if="gitCommit" class="version-commit"> · {{ gitCommit }}</span>
          </span>
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
          >
            <h2 class="machine-section-title">
              {{ machines[machineId]?.name || machineId }}
              <span v-if="machines[machineId]?.isLocal" class="local-badge">(this machine)</span>
            </h2>
            <div class="metrics-grid">
              <MetricCard
                title="Frame Rate"
                :value="machines[machineId]?.metrics?.fps ?? 0"
                unit="FPS"
                :history="machines[machineId]?.history?.fps ?? []"
                :thresholds="{ warning: 50, critical: 30 }"
                :alertConfig="{ ...alertConfigs.fps, comparison: 'less' }"
                @configure="openAlertConfig('fps')"
              />
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
                class="memory-card"
                :small="true"
                title="Memory Usage"
                :value="machines[machineId]?.metrics?.memoryUsage ?? 0"
                :value-max="machines[machineId]?.memoryMax ?? 0"
                unit="MB"
                :decimals="0"
                :history="[]"
                :thresholds="{ warning: 40000, critical: 80000 }"
                :alertConfig="alertConfigs.memoryUsage"
                @configure="openAlertConfig('memoryUsage')"
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

      <!-- RenderStream Tab -->
      <RenderStreamStatus
        v-show="activeTab === 'renderstream'"
        :director-endpoint="directorEndpoint"
        :api-base-url="apiBaseUrl"
      />

      <!-- RS Graphs Tab -->
      <RenderStreamGraphs
        v-show="activeTab === 'rs-graphs'"
        :director-endpoint="directorEndpoint"
        :api-base-url="apiBaseUrl"
      />

      <!-- Notifications Tab -->
      <div v-if="activeTab === 'notifications'" class="tab-content">
        <div class="tab-content-header">
          <h1>Notifications</h1>
          <button class="notif-fetch-btn" @click="fetchNotifications" :disabled="notifLoading">
            {{ notifLoading ? 'Loading...' : 'Fetch Notifications' }}
          </button>
        </div>
        <div v-if="notifError" class="notif-error">{{ notifError }}</div>
        <div v-else-if="notifGroups === null" class="loading-state">Press the button to load notifications.</div>
        <div v-else-if="notifGroups.length === 0" class="loading-state">No notifications found.</div>
        <div v-else class="notif-groups">
          <div v-for="group in notifGroups" :key="group.machine?.uid" class="notif-group">
            <div class="notif-machine-header">{{ group.machine?.hostname ?? group.machine?.name }}</div>
            <div class="notif-list">
              <div v-for="(n, i) in group.notifications" :key="i" class="notif-card">
                <div class="notif-summary">{{ n.summary }}</div>
                <pre v-if="n.detail && n.detail.trim()" class="notif-detail">{{ n.detail.trim() }}</pre>
              </div>
            </div>
          </div>
        </div>
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
            <input id="update-rate" v-model.number="config.updateRateMs" type="number" min="0" max="5000" placeholder="250" />
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, reactive } from 'vue'
import { useLiveUpdate, LiveUpdateOverlay } from '@disguise-one/vue-liveupdate'
import MetricCard from './components/MetricCard.vue'
import AlertManager from './components/AlertManager.vue'
import RenderStreamStatus from './components/RenderStreamStatus.vue'
import RenderStreamGraphs from './components/RenderStreamGraphs.vue'
import { useMetricsStore } from './stores/metrics'

// API config: load from localStorage or derive from URL/env
const urlParams = new URLSearchParams(window.location.search)
const { hostname, protocol } = window.location

// Default UI update rate. This throttles how often metrics are pushed into the
// store (history + alert evaluation); the health monitors in d3 poll at ~1s, so
// a sub-second UI rate is plenty smooth without thrashing sparklines.
const DEFAULT_UPDATE_RATE_MS = 250
// How often we re-fetch the session machine list to detect actors joining/leaving.
const SESSION_REFRESH_MS = 10000

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
    const rawRate = Number(parsed?.updateRateMs)
    const updateRateMs = Math.min(5000, Math.max(0, Number.isFinite(rawRate) ? rawRate : DEFAULT_UPDATE_RATE_MS))
    return { apiHost, apiPort, updateRateMs }
  } catch {
    return { apiHost: defaultHost, apiPort: Number(defaultPort) || 80, updateRateMs: DEFAULT_UPDATE_RATE_MS }
  }
}

const config = reactive(loadConfig())

// When director is localhost in dev mode, route via Vite proxy to avoid CORS (local Designer)
function getEffectiveEndpoint() {
  const host = config.apiHost
  const port = config.apiPort
  const isLocal = host === 'localhost' || host === '127.0.0.1'
  if (isLocal && import.meta.env.DEV) return window.location.host
  return `${host}:${port}`
}
const useProxyForLocal = computed(() => {
  const host = config.apiHost
  return (host === 'localhost' || host === '127.0.0.1') && import.meta.env.DEV
})
const directorEndpoint = computed(() =>
  useProxyForLocal.value ? window.location.host : `${config.apiHost}:${config.apiPort}`
)
const apiBaseUrl = computed(() =>
  useProxyForLocal.value ? '' : `http://${config.apiHost}:${config.apiPort}`
)

// Live Update uses effective endpoint (refresh page after changing host/port to apply)
const liveUpdate = useLiveUpdate(getEffectiveEndpoint())

// Initialize metrics store
const store = useMetricsStore()

// UI State
const activeTab = ref('overview')

// Notifications
const notifGroups = ref(null)
const notifLoading = ref(false)
const notifError = ref(null)

async function fetchNotifications() {
  notifLoading.value = true
  notifError.value = null
  try {
    const res = await fetch(`${apiBaseUrl.value}/api/session/status/notifications`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const list = data?.result ?? (Array.isArray(data) ? data : [data])
    notifGroups.value = list.filter(item => item?.notifications?.length > 0)
  } catch (err) {
    notifError.value = `Failed to load notifications: ${err.message}`
  } finally {
    notifLoading.value = false
  }
}
const sidebarCollapsed = ref(false)
const configSaved = ref(false)

// Build version info (injected by Vite from package.json + git short hash)
const appVersion = __APP_VERSION__
const gitCommit = __GIT_COMMIT__

function saveConfig() {
  const port = Math.min(65535, Math.max(1, Number(config.apiPort) || 80))
  const rawRate = Number(config.updateRateMs)
  const updateRateMs = Math.min(5000, Math.max(0, Number.isFinite(rawRate) ? rawRate : DEFAULT_UPDATE_RATE_MS))
  config.apiPort = port
  config.updateRateMs = updateRateMs
  localStorage.setItem('pulse_sg_api_config', JSON.stringify({ apiHost: config.apiHost, apiPort: config.apiPort, updateRateMs: config.updateRateMs }))
  store.setUpdateRate(config.updateRateMs)
  configSaved.value = true
  setTimeout(() => { configSaved.value = false }, 3000)
}

function resetConfig() {
  const defaultEp = getDefaultEndpoint()
  const [h, p] = defaultEp.includes(':') ? defaultEp.split(':') : [defaultEp, 80]
  config.apiHost = h
  config.apiPort = Number(p) || 80
  config.updateRateMs = DEFAULT_UPDATE_RATE_MS
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
    id: 'renderstream',
    label: 'RenderStream',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/><line x1="2" y1="10" x2="22" y2="10"/></svg>'
  },
  {
    id: 'rs-graphs',
    label: 'RS Graphs',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><line x1="12" y1="2" x2="12" y2="4"/></svg>'
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
const alertConfigs = computed(() => store.alertConfigs.value)
const alertCount = computed(() => store.alertCount.value)
const isConnected = computed(() => store.isConnected.value)

// ── Live Update subscriptions ───────────────────────────────────────────────
// One WebSocket to the director (created above) serves every machine in the
// session. The director already aggregates remote machines' monitors, so we
// subscribe to all of them here instead of opening a socket per machine:
//   - director (local):  findLocalMonitor("<monitor>")
//   - actors/understudies: findRemoteMonitor("<host>:d3", "<monitor>")
// The library's subscription values are reactive computed refs, so a plain
// watch pushes each change into the store — no polling required.

// All metrics for one machine, grouped by monitor object so each object path is
// a single subscription carrying multiple series.
const MONITORS = [
  { monitor: 'Machine', paths: { cpuLoad: 'object.seriesAverage("CPU Time", 1)', gpuLoad: 'object.seriesAverage("GPU Time", 1)' } },
  { monitor: 'fps', paths: { fps: 'object.seriesAverage("Actual", 1)' } },
  { monitor: 'ProcessMemory', paths: { memoryUsage: 'object.seriesAverage("Usage (MB)", 1)', memoryMax: 'object.seriesAverage("Physical Memory (MB)", 1)' } },
  { monitor: 'Disk', paths: { diskRead: 'object.seriesAverage("Read (MB/s)", 1)', diskWrite: 'object.seriesAverage("Write (MB/s)", 1)' } }
]
const METRIC_KEYS = ['cpuLoad', 'gpuLoad', 'fps', 'memoryUsage', 'diskRead', 'diskWrite']

function monitorObjectPath(machine, monitorName) {
  if (machine.isLocal) return `subsystem:MonitoringManager.findLocalMonitor("${monitorName}")`
  // Remote node name is the machine's hostname suffixed with the d3 service tag.
  const node = `${machine.hostname}:d3`
  return `subsystem:MonitoringManager.findRemoteMonitor("${node}", "${monitorName}")`
}

// machineId -> { refs: { metricKey|memoryMax -> SubscriptionValue }, stops: [stopWatch] }
const machineSubs = new Map()

function subscribeMachine(machineId) {
  const machine = store.machines.value[machineId]
  if (!machine || machineSubs.has(machineId)) return

  const refs = {}
  for (const { monitor, paths } of MONITORS) {
    Object.assign(refs, liveUpdate.subscribe(monitorObjectPath(machine, monitor), paths))
  }

  const toNumber = (v) => (typeof v === 'number' ? v : v?.value)
  const stops = METRIC_KEYS.map((key) =>
    watch(refs[key], (v) => {
      const n = toNumber(v)
      if (typeof n === 'number') store.updateMetric(machineId, key, n)
    }, { immediate: true })
  )
  stops.push(watch(refs.memoryMax, (v) => {
    const n = toNumber(v)
    if (typeof n === 'number' && n > 0) store.setMemoryMax(machineId, n)
  }, { immediate: true }))

  machineSubs.set(machineId, { refs, stops })
}

function unsubscribeMachine(machineId) {
  const entry = machineSubs.get(machineId)
  if (!entry) return
  entry.stops.forEach((stop) => stop())
  // freeze() unsubscribes on the director side (releasing it of the work).
  Object.values(entry.refs).forEach((r) => r?.freeze?.())
  machineSubs.delete(machineId)
}

function setSubscriptionsActive(active) {
  for (const { refs } of machineSubs.values()) {
    Object.values(refs).forEach((r) => (active ? r?.thaw?.() : r?.freeze?.()))
  }
}

// Add/remove subscriptions as machines join or leave the session.
watch(
  () => store.machineIds.value,
  (ids) => {
    const current = new Set(ids || [])
    for (const id of [...machineSubs.keys()]) {
      if (!current.has(id)) unsubscribeMachine(id)
    }
    if (document.visibilityState !== 'visible') return
    for (const id of ids || []) subscribeMachine(id)
  },
  { immediate: true }
)

// Connection status is reported by Live Update itself — no REST health polling.
watch(
  () => liveUpdate.status.value,
  (s) => store.setConnected(s === 'OPEN'),
  { immediate: true }
)

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

// Slow REST poll, only to detect machines joining/leaving the session. All live
// metrics come over the Live Update WebSocket, not REST.
let sessionRefreshTimer = null

// When the page is hidden, freeze every subscription so an unwatched monitor
// puts ~zero load on the Disguise servers; thaw (and re-subscribe) when visible.
function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    for (const id of store.machineIds.value || []) subscribeMachine(id)
    setSubscriptionsActive(true)
    fetchSession()
  } else {
    setSubscriptionsActive(false)
  }
}

onMounted(() => {
  store.setUpdateRate(config.updateRateMs)
  liveUpdate.reconnect()
  fetchSession()
  sessionRefreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') fetchSession()
  }, SESSION_REFRESH_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  if (sessionRefreshTimer) clearInterval(sessionRefreshTimer)
  for (const id of [...machineSubs.keys()]) unsubscribeMachine(id)
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

.footer-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #888;
}

.app-version {
  font-size: 11px;
  color: #555;
  white-space: nowrap;
  padding-left: 16px;
}

.version-commit {
  color: #444;
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

  align-items: stretch;
}



/* Notifications tab */
.notif-fetch-btn {
  background: #2A2A2A;
  border: 1px solid #444;
  color: #CCC;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.notif-fetch-btn:hover:not(:disabled) { background: #333; }
.notif-fetch-btn:disabled { opacity: 0.5; cursor: default; }

.notif-error { color: #FF5252; padding: 12px 0; }

.notif-groups {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.notif-group {}

.notif-machine-header {
  font-size: 14px;
  font-weight: 700;
  color: #6BFFDC;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.notif-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notif-card {
  background: #1E1E1E;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 12px 16px;
}

.notif-summary {
  font-size: 14px;
  font-weight: 600;
  color: #DDD;
  line-height: 1.4;
  margin-bottom: 8px;
}

.notif-detail {
  font-family: monospace;
  font-size: 12px;
  color: #888;
  background: #161616;
  border: 1px solid #2A2A2A;
  border-radius: 6px;
  padding: 10px 12px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
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
