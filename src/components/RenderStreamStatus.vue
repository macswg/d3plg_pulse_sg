<template>
  <div class="tab-content rs-tab">
    <div class="tab-content-header">
      <h1>RenderStream Status</h1>
      <span class="machine-count" v-if="!loading && !error">{{ layers.length }} layer{{ layers.length === 1 ? '' : 's' }}</span>
    </div>

    <div v-if="loading" class="loading-state">Loading RenderStream layers...</div>
    <div v-else-if="error" class="rs-error">{{ error }}</div>
    <div v-else-if="layers.length === 0" class="loading-state">No RenderStream layers found.</div>

    <template v-else>
      <section
        v-for="layer in layers"
        :key="layer.uid"
        class="machine-section"
      >
        <h2 class="machine-section-title">{{ layer.name }}</h2>

        <!-- Instance Health (from layerstatus REST) -->
        <div class="rs-table-label">Instance Health</div>
        <div class="rs-table-wrapper">
          <table class="rs-table" v-if="getInstances(layer.uid).length > 0">
            <thead>
              <tr>
                <th>Machine</th>
                <th>State</th>
                <th>Health</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(inst, i) in getInstances(layer.uid)"
                :key="i"
                :class="instanceRowClass(inst)"
              >
                <td>{{ inst.machineName || inst.machineUid || '—' }}</td>
                <td><span class="rs-badge" :class="instanceBadgeClass(inst)">{{ inst.state || '—' }}</span></td>
                <td :class="{ 'rs-warn': inst.healthMessage && !isErrorState(inst) }">{{ inst.healthMessage || '—' }}</td>
                <td class="rs-error-cell">{{ inst.healthDetails || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="rs-empty">{{ layerStatuses[layer.uid] ? 'No instances running.' : 'Loading...' }}</div>
        </div>

        <!-- Stream Status -->
        <div class="rs-table-label">Stream Status</div>
        <div class="rs-table-wrapper">
          <table class="rs-table" v-if="getStreams(layer.uid).length > 0">
            <thead>
              <tr>
                <th>Stream</th>
                <th>Source → Receiver</th>
                <th>Subscribed</th>
                <th v-if="hasLiveUpdateStreams(layer.uid)">Latency (ms)</th>
                <th v-if="hasLiveUpdateStreams(layer.uid)">Frames Recv'd</th>
                <th v-if="hasLiveUpdateStreams(layer.uid)">Frames Sent</th>
                <th v-else>Status</th>
                <th v-if="!hasLiveUpdateStreams(layer.uid)">Last Error</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(s, i) in getStreams(layer.uid)"
                :key="i"
                :class="streamRowClass(s, layer.uid)"
              >
                <td>{{ s.name || i }}</td>
                <td class="rs-route">{{ streamRoute(s, layer.uid) }}</td>
                <td>{{ streamSubscribed(s, layer.uid) }}</td>
                <!-- Live Update data columns -->
                <template v-if="hasLiveUpdateStreams(layer.uid)">
                  <td :class="{ 'rs-warn': isHighLatency(s) }">{{ s.activeLatency != null ? s.activeLatency : '—' }}</td>
                  <td>{{ s.recentReceived ?? '—' }}</td>
                  <td>{{ s.recentSent ?? '—' }}</td>
                </template>
                <!-- REST data columns -->
                <template v-else>
                  <td>{{ s.statusString || '—' }}</td>
                  <td class="rs-error-cell">{{ s.status?.lastErrorMessage || '—' }}</td>
                </template>
              </tr>
            </tbody>
          </table>
          <div v-else class="rs-empty">{{ layerStatuses[layer.uid] ? 'No streams configured.' : 'Loading...' }}</div>
        </div>

        <!-- Asset errors -->
        <div v-if="getAssetErrors(layer.uid).length > 0" class="rs-asset-errors">
          <div class="rs-table-label">Asset Errors</div>
          <ul class="rs-error-list">
            <li v-for="(e, i) in getAssetErrors(layer.uid)" :key="i">{{ e }}</li>
          </ul>
        </div>

        <!-- Debug panel -->
        <details class="rs-debug">
          <summary>Debug</summary>
          <div class="rs-debug-block">
            <div class="rs-debug-label">Layer UID</div>
            <pre>{{ layer.uid }}</pre>
            <div class="rs-debug-label">Workload UID (from layerstatus)</div>
            <pre>{{ layerStatuses[layer.uid]?.workload?.uid ?? '—' }}</pre>
            <div class="rs-debug-label">Streams (REST)</div>
            <pre>{{ JSON.stringify(layerStatuses[layer.uid]?.streams?.map(s => ({ uid: s.uid, name: s.name, source: s.sourceMachine, receiver: s.receiverMachine })) ?? [], null, 2) }}</pre>
            <div class="rs-debug-label">Stream Receive Statuses (Live Update)</div>
            <pre>{{ JSON.stringify(statusLists[layer.uid] ?? null, null, 2) }}</pre>
          </div>
        </details>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useLiveUpdate } from '@disguise-one/vue-liveupdate'

const props = defineProps({
  directorEndpoint: { type: String, required: true },
  apiBaseUrl: { type: String, required: true }
})

// Layer list from REST /layers
const layers = ref([])
// Full layerstatus REST response per layer uid: { workload, streams, assetErrors }
const layerStatuses = reactive({})
// Live Update stream receive statuses (richer: has activeLatency, recentReceived, recentSent)
const statusLists = reactive({})

const loading = ref(true)
const error = ref(null)

const liveUpdate = useLiveUpdate(props.directorEndpoint)
// Track which workload UIDs we've already subscribed
const subscribedWorkloads = new Set()

// ── Live Update subscription ──────────────────────────────────────────────────

function subscribeReceiveStatuses(layerUid, workloadUid) {
  if (subscribedWorkloads.has(workloadUid)) return
  subscribedWorkloads.add(workloadUid)

  const statusSub = liveUpdate.subscribe(
    'subsystem:RenderStreamSystem',
    { value: `object.getWorkloadReceiveStatuses(${workloadUid})` }
  )

  watch(statusSub.value, (val) => {
    const arr = coerceArray(val)
    if (arr.length > 0) statusLists[layerUid] = arr
  }, { deep: true })
}

// ── REST fetch ────────────────────────────────────────────────────────────────

async function fetchLayers() {
  try {
    const res = await fetch(`${props.apiBaseUrl}/api/session/renderstream/layers`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const list = Array.isArray(data) ? data : (data?.result ?? [])
    layers.value = list.map(l => ({ uid: l.uid ?? l.id, name: l.name ?? l.uid ?? l.id }))
  } catch (err) {
    error.value = `Failed to load layers: ${err.message}`
  } finally {
    loading.value = false
  }
}

async function fetchLayerStatus(layerUid) {
  try {
    const res = await fetch(`${props.apiBaseUrl}/api/session/renderstream/layerstatus?uid=${layerUid}`)
    if (!res.ok) return
    const data = await res.json()
    const result = data?.result
    if (!result) return
    layerStatuses[layerUid] = result

    // Use workload.uid for Live Update (may differ from layer uid)
    const workloadUid = result.workload?.uid
    if (workloadUid) {
      subscribeReceiveStatuses(layerUid, workloadUid)
    }
  } catch {
    // silent — polling will retry
  }
}

async function refreshAll() {
  if (document.visibilityState !== 'visible') return
  for (const layer of layers.value) {
    await fetchLayerStatus(layer.uid)
  }
}

// ── Polling ───────────────────────────────────────────────────────────────────

let pollTimer = null

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(refreshAll, 2000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') startPolling()
  else stopPolling()
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  liveUpdate.reconnect()
  await fetchLayers()
  await refreshAll()
  startPolling()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  stopPolling()
})

// ── Template helpers ──────────────────────────────────────────────────────────

function coerceArray(val) {
  if (Array.isArray(val)) return val
  if (val == null) return []
  if (Array.isArray(val?.value)) return val.value
  return []
}

function getInstances(layerUid) {
  return layerStatuses[layerUid]?.workload?.instances ?? []
}

function getStreams(layerUid) {
  // Prefer Live Update data (has activeLatency, recentReceived, recentSent)
  const luStreams = statusLists[layerUid]
  if (luStreams && luStreams.length > 0) return luStreams
  return layerStatuses[layerUid]?.streams ?? []
}

function hasLiveUpdateStreams(layerUid) {
  const luStreams = statusLists[layerUid]
  return luStreams && luStreams.length > 0
}

function getAssetErrors(layerUid) {
  return (layerStatuses[layerUid]?.assetErrors ?? []).filter(Boolean)
}

function isErrorState(inst) {
  const s = (inst.state ?? '').toLowerCase()
  return s === 'error' || s === 'failed'
}

function instanceBadgeClass(inst) {
  if (isErrorState(inst) || inst.healthDetails) return 'rs-badge-error'
  const s = (inst.state ?? '').toLowerCase()
  if (s === 'running' || s === 'ok' || s === 'active') return 'rs-badge-ok'
  if (inst.healthMessage) return 'rs-badge-warn'
  return ''
}

function instanceRowClass(inst) {
  if (isErrorState(inst) || inst.healthDetails) return 'rs-error-row'
  if (inst.healthMessage) return 'rs-warn-row'
  return ''
}

// Works for both REST stream objects and Live Update SubscribedStreamStatus objects
function streamSubscribed(s, layerUid) {
  // Live Update SubscribedStreamStatus
  if (s.subscribeSuccessful != null) return s.subscribeSuccessful ? 'Yes' : 'No'
  // REST stream
  if (s.status?.subscribeSuccessful != null) return s.status.subscribeSuccessful ? 'Yes' : 'No'
  return '—'
}

function streamRoute(s, layerUid) {
  if (s.sourceMachine && s.receiverMachine) return `${s.sourceMachine} → ${s.receiverMachine}`
  return '—'
}

function streamRowClass(s, layerUid) {
  const subscribed = s.subscribeSuccessful ?? s.status?.subscribeSuccessful
  if (subscribed === false) return 'rs-warn-row'
  if (hasLiveUpdateStreams(layerUid) && isHighLatency(s)) return 'rs-warn-row'
  return ''
}

function isHighLatency(s) {
  return typeof s.activeLatency === 'number' && s.activeLatency > 50
}
</script>

<style scoped>
.rs-tab {
  padding: 0;
}

.rs-error {
  color: #FF5252;
  padding: 12px 0;
}

.rs-table-label {
  font-size: 12px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 12px 0 6px;
}

.rs-table-wrapper {
  overflow-x: auto;
  margin-bottom: 16px;
}

.rs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: #1E1E1E;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
}

.rs-table th {
  text-align: left;
  padding: 8px 12px;
  background: #252525;
  color: #888;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid #333;
}

.rs-table td {
  padding: 8px 12px;
  color: #CCC;
  border-bottom: 1px solid #2A2A2A;
}

.rs-table tr:last-child td {
  border-bottom: none;
}

.rs-table tr:hover td {
  background: #252525;
}

.rs-warn-row td {
  background: rgba(255, 165, 0, 0.05);
}

.rs-error-row td {
  background: rgba(255, 82, 82, 0.07);
}

.rs-warn {
  color: #FFA500;
}

.rs-error-cell {
  color: #FF5252;
  font-size: 12px;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rs-route {
  color: #888;
  font-size: 12px;
}

.rs-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background: #333;
  color: #888;
}

.rs-badge-ok {
  background: rgba(107, 255, 220, 0.15);
  color: #6BFFDC;
}

.rs-badge-warn {
  background: rgba(255, 165, 0, 0.15);
  color: #FFA500;
}

.rs-badge-error {
  background: rgba(255, 82, 82, 0.15);
  color: #FF5252;
}

.rs-empty {
  color: #666;
  font-size: 13px;
  padding: 10px 0;
}

.rs-asset-errors {
  margin-bottom: 16px;
}

.rs-error-list {
  margin: 0;
  padding: 0 0 0 16px;
  color: #FF5252;
  font-size: 12px;
}

.rs-error-list li {
  padding: 2px 0;
}
</style>
