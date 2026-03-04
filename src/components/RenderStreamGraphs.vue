<template>
  <div class="tab-content rs-tab">
    <div class="tab-content-header">
      <h1>RS Graphs</h1>
    </div>

    <template v-for="(source, idx) in sources" :key="idx">
      <div class="rs-table-label">{{ source.label }} — findLocalMonitor</div>
      <div class="rs-table-wrapper">
        <table class="rs-table">
          <thead>
            <tr><th>Monitor name</th><th>Value</th><th>Raw</th></tr>
          </thead>
          <tbody>
            <tr
              v-for="name in MONITOR_NAMES"
              :key="name"
              :class="{ 'rs-ok-row': isGoodValue(source.values[name]) }"
            >
              <td class="rs-path-code">{{ name }}</td>
              <td>
                <span v-if="source.values[name] == null" class="rs-empty-inline">—</span>
                <span v-else-if="isError(source.values[name])" class="rs-error-inline">
                  {{ source.values[name]?.errorType }}: {{ source.values[name]?.message }}
                </span>
                <span v-else>{{ summarise(source.values[name]) }}</span>
              </td>
              <td class="rs-path-code">{{ JSON.stringify(source.values[name] ?? null) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { reactive, watch, onMounted, onUnmounted } from 'vue'
import { useLiveUpdate } from '@disguise-one/vue-liveupdate'

const props = defineProps({
  directorEndpoint: { type: String, required: true },
  apiBaseUrl: { type: String, required: true }
})

const directorValues = reactive({})
const liveUpdate = useLiveUpdate(props.directorEndpoint)
const sources = [
  { label: 'Director (' + props.directorEndpoint + ')', values: directorValues },
]

const MONITOR_NAMES = [
  'fps', 'Machine', 'ProcessMemory', 'Disk',
  'RenderStream', 'renderstream', 'Render', 'render',
  'Renderer', 'renderer', 'GPU', 'gpu',
  'Network', 'network', 'System', 'system',
  'Audio', 'audio', 'Video', 'video',
  'Performance', 'performance', 'Process', 'process',
]

function isError(raw) {
  return raw != null && typeof raw === 'object' && !Array.isArray(raw) && raw.errorType != null
}

function isGoodValue(raw) {
  if (raw == null || isError(raw)) return false
  const v = typeof raw === 'number' ? raw : raw?.value
  return typeof v === 'number'
}

function summarise(val) {
  if (val == null) return '—'
  if (Array.isArray(val)) return '[' + val.length + '] ' + JSON.stringify(val).slice(0, 120)
  if (typeof val === 'object') return JSON.stringify(val).slice(0, 120)
  return String(val)
}

onMounted(() => {
  liveUpdate.reconnect()
  for (const name of MONITOR_NAMES) {
    const sub = liveUpdate.subscribe(
      'subsystem:MonitoringManager.findLocalMonitor("' + name + '")',
      { value: 'object.seriesAverage("Actual", 1)' }
    )
    watch(sub.value, (val) => { directorValues[name] = val }, { deep: true })
  }
})

onUnmounted(() => {})
</script>

<style scoped>
.rs-tab { padding: 0; }

.rs-table-label {
  font-size: 12px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 12px 0 6px;
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
  color: #666;
  word-break: break-all;
}

.rs-empty-inline { color: #444; }
.rs-error-inline { color: #FF5252; font-size: 12px; }
</style>
