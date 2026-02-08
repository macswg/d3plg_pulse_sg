<template>
  <div class="metric-card" :class="alertClass" @click="$emit('click')">
    <div class="metric-header">
      <div class="metric-header-top">
        <div class="metric-header-row">
          <h3 class="metric-title">{{ title }}</h3>
          <div v-if="!valueBelowTitle" class="metric-value" :style="{ color: valueColor }">
            {{ formattedValue }} <span class="metric-unit">{{ unit }}</span>
          </div>
        </div>
        <div v-if="valueBelowTitle" class="metric-value-below" :style="{ color: valueColor }">
          {{ formattedValue }} <span class="metric-unit">{{ unit }}</span>
        </div>
      </div>
      <button class="settings-btn" @click.stop="$emit('configure')" title="Configure alerts">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
    
    <div class="metric-body">
      <div class="metric-chart">
        <Line v-if="chartData" :data="chartData" :options="chartOptions" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler
} from 'chart.js'

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler)

const props = defineProps({
  title: { type: String, required: true },
  value: { type: Number, default: 0 },
  valueMax: { type: Number, default: null },
  unit: { type: String, default: '' },
  decimals: { type: Number, default: 1 },
  history: { type: Array, default: () => [] },
  thresholds: { type: Object, default: null },
  alertConfig: { type: Object, default: null }
})

defineEmits(['click', 'configure'])

// When valueMax is set (e.g. Memory Usage), show value below the title
const valueBelowTitle = computed(() => props.valueMax != null && props.valueMax > 0)

// Format the current value (or "used / max" when valueMax is set)
const formattedValue = computed(() => {
  const used = props.value.toFixed(props.decimals)
  if (props.valueMax != null && props.valueMax > 0) {
    const max = Number(props.valueMax).toFixed(props.decimals)
    return `${used} / ${max}`
  }
  return used
})

// Determine value color based on thresholds
const valueColor = computed(() => {
  if (!props.thresholds) return '#FFFFFF'
  
  const comparison = props.alertConfig?.comparison || 'greater'
  
  if (comparison === 'greater') {
    if (props.value >= props.thresholds.critical) return '#FF5252'
    if (props.value >= props.thresholds.warning) return '#FFB74D'
    return '#6BFFDC'
  } else {
    if (props.value <= props.thresholds.critical) return '#FF5252'
    if (props.value <= props.thresholds.warning) return '#FFB74D'
    return '#6BFFDC'
  }
})

// Alert class for card styling
const alertClass = computed(() => {
  if (!props.thresholds || !props.alertConfig?.enabled) return ''
  
  const comparison = props.alertConfig?.comparison || 'greater'
  
  if (comparison === 'greater') {
    if (props.value >= props.thresholds.critical) return 'alert-critical'
    if (props.value >= props.thresholds.warning) return 'alert-warning'
  } else {
    if (props.value <= props.thresholds.critical) return 'alert-critical'
    if (props.value <= props.thresholds.warning) return 'alert-warning'
  }
  return ''
})

// Chart data
const chartData = computed(() => {
  if (!props.history || props.history.length === 0) return null
  const values = props.history.map(h => h.value)
  const color = valueColor.value
  return {
    labels: values.map((_, i) => i),
    datasets: [{
      data: values,
      borderColor: color,
      backgroundColor: `${color}20`,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2
    }]
  }
})

// Chart options - minimal sparkline style (low DPR and no animation to reduce CPU)
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  devicePixelRatio: 1,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false }
  },
  scales: {
    x: { display: false },
    y: {
      display: false,
      beginAtZero: false
    }
  },
  elements: {
    line: { borderWidth: 2 }
  },
  animation: false,
  transitions: false
}
</script>

<style scoped>
.metric-card {
  background: #1E1E1E;
  border-radius: 6px;
  padding: 10px 12px 0 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #333;
}

.metric-card:hover {
  background: #252525;
  transform: translateY(-1px);
}

.metric-card.alert-warning {
  border-color: #FFB74D;
  box-shadow: 0 0 10px rgba(255, 183, 77, 0.3);
}

.metric-card.alert-critical {
  border-color: #FF5252;
  box-shadow: 0 0 10px rgba(255, 82, 82, 0.3);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(255, 82, 82, 0.3); }
  50% { box-shadow: 0 0 20px rgba(255, 82, 82, 0.5); }
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.metric-header-top {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.metric-header-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-width: 0;
}

.metric-value-below {
  font-size: 20px;
  font-weight: 600;
  white-space: nowrap;
}

.metric-title {
  font-size: 16px;
  font-weight: 600;
  color: #AAA;
  margin: 0;
  flex-shrink: 0;
}

.settings-btn {
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: color 0.2s;
}

.settings-btn:hover {
  color: #FF6DF0;
}

.metric-body {
  min-height: 0;
  margin-bottom: -4px;
}

.metric-value {
  font-size: 20px;
  font-weight: 600;
  flex-shrink: 0;
  white-space: nowrap;
}

.metric-unit {
  font-size: 14px;
  font-weight: 400;
  opacity: 0.7;
}

.metric-chart {
  flex: 1;
  min-width: 0;
  height: 44px;
}
</style>
