<template>
  <div class="tab-content rs-tab">
    <div class="tab-content-header">
      <h1>RS Graphs</h1>
      <span class="machine-count" v-if="!loading && machines.length">
        {{ machines.length }} machine{{ machines.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <div v-if="loading" class="loading-state">Fetching session machines...</div>
    <div v-else-if="error" class="rs-error">{{ error }}</div>
    <div v-else-if="machines.length === 0" class="loading-state">No machines found in session.</div>

    <template v-else>
      <!-- Discovery table: each machine × each monitor name -->
      <div class="rs-table-label">
        Monitor Discovery — probing {{ PROBE_NAMES.length }} monitor names across {{ machines.length }} machine{{ machines.length !== 1 ? 's' : '' }}
      </div>
      <div class="rs-table-wrapper">
        <table class="rs-table">
          <thead>
            <tr>
              <th>Machine</th>
              <th>Monitor name</th>
              <th>nSeries</th>
              <th>graphDescriptor</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="m in machines" :key="m.id">
              <tr
                v-for="name in PROBE_NAMES"
                :key="name"
                :class="{ 'rs-ok-row': hasData(m.id, name) }"
              >
                <td class="rs-machine">{{ m.name }}<span v-if="m.isLocal" class="rs-local-badge"> (local)</span></td>
                <td class="rs-path-code">{{ name }}</td>
                <td>
                  <span v-if="probeData[m.id]?.[name]?.nSeries == null" class="rs-empty-inline">—</span>
                  <span v-else>{{ probeData[m.id][name].nSeries }}</span>
                </td>
                <td>
                  <span v-if="probeData[m.id]?.[name]?.graphDesc == null" class="rs-empty-inline">—</span>
                  <span v-else-if="isError(probeData[m.id][name].graphDesc)" class="rs-error-inline">
                    {{ probeData[m.id][name].graphDesc?.errorType }}: {{ probeData[m.id][name].graphDesc?.message }}
                  </span>
                  <span v-else>{{ summarise(probeData[m.id][name].graphDesc) }}</span>
                  <div v-if="probeData[m.id]?.[name]?.graphDesc != null && !isError(probeData[m.id][name].graphDesc)" class="rs-raw">
                    {{ JSON.stringify(probeData[m.id][name].graphDesc) }}
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Series values for monitors that returned data -->
      <template v-if="hitEntries.length > 0">
        <div class="rs-table-label">Live Series Values — monitors with data</div>
        <div v-for="entry in hitEntries" :key="entry.machineId + ':' + entry.monitorName" class="rs-table-wrapper">
          <div class="rs-subtable-header">
            {{ entry.machineName }} / <span class="rs-path-code">{{ entry.monitorName }}</span>
          </div>
          <table class="rs-table">
            <thead>
              <tr><th>Series index</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr v-for="i in entry.nSeries" :key="i - 1" :class="{ 'rs-ok-row': seriesData[entry.machineId]?.[entry.monitorName]?.[i - 1] != null }">
                <td class="rs-path-code">idx {{ i - 1 }}</td>
                <td>
                  <span v-if="seriesData[entry.machineId]?.[entry.monitorName]?.[i - 1] == null" class="rs-empty-inline">—</span>
                  <span v-else-if="isError(seriesData[entry.machineId][entry.monitorName][i - 1])" class="rs-error-inline">
                    {{ seriesData[entry.machineId][entry.monitorName][i - 1]?.errorType }}
                  </span>
                  <span v-else>{{ seriesData[entry.machineId][entry.monitorName][i - 1] }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useLiveUpdate } from '@disguise-one/vue-liveupdate'

const props = defineProps({
  directorEndpoint: { type: String, required: true },
  apiBaseUrl: { type: String, required: true }
})

// Monitor names to probe on every machine
const PROBE_NAMES = [
  'renderstream', 'RenderStream',
  'fps', 'Machine', 'ProcessMemory', 'Disk',
  'Renderer', 'renderer',
  'GPU', 'gpu',
  'Network', 'network',
  'System', 'system',
  'Performance', 'performance',
]

const liveUpdate = useLiveUpdate(props.directorEndpoint)

const machines = ref([])   // [{ id, name, hostname, isLocal }]
const loading = ref(true)
const error = ref(null)

// probeData[machineId][monitorName] = { nSeries, graphDesc }
const probeData = reactive({})
// seriesData[machineId][monitorName][index] = value
const seriesData = reactive({})

// Entries where nSeries > 0 — used to render the series values section
const hitEntries = computed(() => {
  const out = []
  for (const m of machines.value) {
    for (const name of PROBE_NAMES) {
      const d = probeData[m.id]?.[name]
      if (d?.nSeries > 0) {
        out.push({ machineId: m.id, machineName: m.name, monitorName: name, nSeries: d.nSeries })
      }
    }
  }
  return out
})

// Build Live Update object path for a machine × monitor combination
function objectPath(machine, monitorName) {
  if (machine.isLocal) {
    return `subsystem:MonitoringManager.findLocalMonitor("${monitorName}")`
  }
  // Use director's findRemoteMonitor for actors/understudies
  return `subsystem:MonitoringManager.findRemoteMonitor("${machine.hostname}", "${monitorName}")`
}

function setupProbes(machine) {
  probeData[machine.id] ??= {}
  seriesData[machine.id] ??= {}

  for (const name of PROBE_NAMES) {
    probeData[machine.id][name] = { nSeries: null, graphDesc: null }

    const sub = liveUpdate.subscribe(objectPath(machine, name), {
      nSeries: 'object.nSeries()',
      graphDesc: 'object.graphDescriptor(false)',
    })

    watch(() => sub.nSeries?.value, (val) => {
      if (!probeData[machine.id][name]) probeData[machine.id][name] = {}
      probeData[machine.id][name].nSeries = val ?? null

      // Once we know nSeries, subscribe to each index
      const count = typeof val === 'number' ? val : val?.value
      if (typeof count === 'number' && count > 0) {
        subscribeSeriesForMonitor(machine, name, count)
      }
    }, { deep: true })

    watch(() => sub.graphDesc?.value, (val) => {
      if (!probeData[machine.id][name]) probeData[machine.id][name] = {}
      probeData[machine.id][name].graphDesc = val ?? null
    }, { deep: true })
  }
}

const subscribedSeries = new Set()

function subscribeSeriesForMonitor(machine, monitorName, count) {
  const key = `${machine.id}:${monitorName}`
  if (subscribedSeries.has(key)) return
  subscribedSeries.add(key)

  seriesData[machine.id][monitorName] ??= {}

  for (let i = 0; i < count; i++) {
    const idx = i
    const sub = liveUpdate.subscribe(objectPath(machine, monitorName), {
      value: `object.seriesAverageByIndex(${idx}, 1)`,
    })
    watch(() => sub.value?.value, (val) => {
      seriesData[machine.id][monitorName][idx] = val ?? null
    }, { deep: true })
  }
}

onMounted(async () => {
  liveUpdate.reconnect()
  try {
    const res = await fetch(`${props.apiBaseUrl}/api/session/status/session`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const list = data?.result?.machines ?? data?.machines ?? (Array.isArray(data) ? data : [])

    machines.value = list.map(m => ({
      id: m.uid ?? m.id ?? m.hostname ?? String(Math.random()),
      name: m.name ?? m.hostname ?? m.uid ?? '?',
      hostname: (m.nodeName ?? m.hostname ?? m.address ?? '').toString().trim(),
      isLocal: !!m.isLocal,
    }))

    for (const machine of machines.value) {
      setupProbes(machine)
    }
  } catch (err) {
    error.value = `Failed to load session: ${err.message}`
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {})

function isError(raw) {
  return raw != null && typeof raw === 'object' && !Array.isArray(raw) && raw.errorType != null
}

function hasData(machineId, monitorName) {
  const d = probeData[machineId]?.[monitorName]
  return d?.nSeries > 0 || (d?.graphDesc != null && !isError(d.graphDesc))
}

function summarise(val) {
  if (val == null) return '—'
  if (Array.isArray(val)) return `[${val.length} items]`
  if (typeof val === 'object') return JSON.stringify(val).slice(0, 120)
  return String(val)
}
</script>

<style scoped>
.rs-tab { padding: 0; }

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
  margin: 16px 0 6px;
}

.rs-subtable-header {
  font-size: 13px;
  font-weight: 600;
  color: #AAA;
  margin: 12px 0 4px;
}

.rs-table-wrapper { overflow-x: auto; margin-bottom: 16px; }

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
  vertical-align: top;
}

.rs-table tr:last-child td { border-bottom: none; }

.rs-ok-row td { background: rgba(107, 255, 220, 0.05); color: #6BFFDC; }

.rs-path-code {
  font-family: monospace;
  font-size: 11px;
  color: #888;
}

.rs-machine { font-size: 12px; white-space: nowrap; }

.rs-local-badge {
  font-size: 10px;
  color: #6BFFDC;
  opacity: 0.7;
}

.rs-empty-inline { color: #444; }
.rs-error-inline { color: #FF5252; font-size: 12px; }

.rs-raw {
  font-family: monospace;
  font-size: 10px;
  color: #555;
  margin-top: 4px;
  word-break: break-all;
}
</style>
