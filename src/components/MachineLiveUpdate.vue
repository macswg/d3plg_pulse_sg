<template>
  <!-- No UI: this component only manages one Live Update connection per machine and pushes to store -->
  <span aria-hidden="true" style="display: none"></span>
</template>

<script setup>
import { useLiveUpdate } from '@disguise-one/vue-liveupdate'
import { useMetricsStore } from '../stores/metrics'
import { watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  machineId: { type: String, required: true },
  machine: { type: Object, required: true },
  directorEndpoint: { type: String, required: true },
  updateRateMs: { type: Number, default: 10 }
})

const store = useMetricsStore()

// Endpoint for this machine: connect to that machine's host (like the working Pulse plugin).
// For remote machines, append .local if hostname has no dot/colon (mDNS).
function getEndpoint() {
  if (props.machine.isLocal) return props.directorEndpoint
  let host = (props.machine.hostname || '').toString().trim()
  if (!host) return 'localhost:80'
  if (!host.includes('.') && !host.includes(':')) host = `${host}.local`
  const port = props.machine.httpPort ?? 80
  return host.includes(':') ? host : `${host}:${port}`
}

const endpoint = getEndpoint()
const liveUpdate = useLiveUpdate(endpoint)

// Same monitor names and property paths as App.vue (working plugin uses findLocalMonitor only)
const OVERVIEW = [
  { key: 'fps', objectPath: 'subsystem:MonitoringManager.findLocalMonitor("fps")', valuePath: 'object.seriesAverage("Actual", 1)' },
  { key: 'cpuLoad', objectPath: 'subsystem:MonitoringManager.findLocalMonitor("Machine")', valuePath: 'object.seriesAverage("CPU Time", 1)' },
  { key: 'gpuLoad', objectPath: 'subsystem:MonitoringManager.findLocalMonitor("Machine")', valuePath: 'object.seriesAverage("GPU Time", 1)' },
  { key: 'memoryUsage', objectPath: 'subsystem:MonitoringManager.findLocalMonitor("ProcessMemory")', valuePath: 'object.seriesAverage("Usage (MB)", 1)', memoryMaxPath: 'object.seriesAverage("Physical Memory (MB)", 1)' }
]
const ADVANCED = [
  { key: 'diskRead', objectPath: 'subsystem:MonitoringManager.findLocalMonitor("Disk")', valuePath: 'object.seriesAverage("Read (MB/s)", 1)' },
  { key: 'diskWrite', objectPath: 'subsystem:MonitoringManager.findLocalMonitor("Disk")', valuePath: 'object.seriesAverage("Write (MB/s)", 1)' }
]

let overviewSubs = null
let advancedSubs = null
let pollTimer = null

function getPollMs() {
  return props.updateRateMs > 0 ? props.updateRateMs : 500
}

function pushValue(ref, key) {
  const raw = ref?.value
  const v = typeof raw === 'number' ? raw : raw?.value
  if (v != null) store.updateMetric(props.machineId, key, v)
}

function subscribeAll() {
  if (!endpoint) return
  overviewSubs = {}
  OVERVIEW.forEach(({ key, objectPath, valuePath, memoryMaxPath }) => {
    const paths = { value: valuePath }
    if (memoryMaxPath) paths.memoryMax = memoryMaxPath
    const sub = liveUpdate.subscribe(objectPath, paths)
    overviewSubs[key] = sub.value
    watch(sub.value, (val) => pushValue({ value: val }, key))
    if (sub.memoryMax) {
      watch(sub.memoryMax, (v) => {
        const n = typeof v === 'number' ? v : v?.value
        if (typeof n === 'number' && n > 0) store.setMemoryMax(props.machineId, n)
      })
    }
  })
  advancedSubs = {}
  ADVANCED.forEach(({ key, objectPath, valuePath }) => {
    const sub = liveUpdate.subscribe(objectPath, { value: valuePath })
    advancedSubs[key] = sub.value
    watch(sub.value, (val) => pushValue({ value: val }, key))
  })
}

function pollRefs() {
  if (document.visibilityState !== 'visible') return
  if (overviewSubs) {
    OVERVIEW.forEach(({ key }) => {
      const ref = overviewSubs[key]
      pushValue(ref, key)
    })
  }
  if (advancedSubs) {
    ADVANCED.forEach(({ key }) => {
      const ref = advancedSubs[key]
      pushValue(ref, key)
    })
  }
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(pollRefs, getPollMs())
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') startPolling()
  else stopPolling()
}

watch(() => props.updateRateMs, () => {
  if (!pollTimer) return
  stopPolling()
  startPolling()
}, { flush: 'post' })

onMounted(() => {
  if (endpoint) {
    subscribeAll()
    liveUpdate.reconnect()
    startPolling()
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  stopPolling()
})
</script>
