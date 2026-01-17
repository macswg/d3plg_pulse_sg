<template>
  <div class="alert-manager">
    <div class="alert-header">
      <h2>Alert Management</h2>
      <p class="alert-description">Configure alerts for each metric by clicking the settings icon on metric cards.</p>
    </div>

    <!-- Active Alerts Section -->
    <div class="active-alerts-section">
      <h3>Active Alerts</h3>
      <div v-if="activeAlerts.length === 0" class="no-alerts">
        <div class="status-card success">
          <span class="status-icon">✓</span>
          All systems normal.
        </div>
      </div>
      <div v-else class="alerts-grid">
        <div 
          v-for="alert in activeAlerts" 
          :key="alert.id"
          class="alert-card"
          :class="alert.severity"
          @click="$emit('view-metric', alert.metricKey)"
        >
          <div class="alert-title">{{ formatMetricName(alert.metricKey) }}</div>
          <div class="alert-message">{{ alert.message }}</div>
          <div class="alert-time">Triggered at {{ formatTime(alert.timestamp) }}</div>
        </div>
      </div>
    </div>

    <!-- Alert Configuration Section -->
    <div class="config-section">
      <h3>Alert Configurations</h3>
      <div class="config-grid">
        <div 
          v-for="(config, key) in alertConfigs" 
          :key="key"
          class="config-card"
        >
          <div class="config-header">
            <span class="config-name">{{ formatMetricName(key) }}</span>
            <label class="toggle">
              <input 
                type="checkbox" 
                :checked="config.enabled"
                @change="toggleAlert(key, $event.target.checked)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div v-if="config.enabled" class="config-thresholds">
            <div class="threshold-row">
              <label>Warning:</label>
              <input 
                type="number" 
                :value="config.warningThreshold"
                @change="updateThreshold(key, 'warningThreshold', $event.target.value)"
              />
              <span class="unit">{{ getMetricUnit(key) }}</span>
            </div>
            <div class="threshold-row">
              <label>Critical:</label>
              <input 
                type="number" 
                :value="config.criticalThreshold"
                @change="updateThreshold(key, 'criticalThreshold', $event.target.value)"
              />
              <span class="unit">{{ getMetricUnit(key) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMetricsStore } from '../stores/metrics'

const store = useMetricsStore()

defineEmits(['view-metric'])

const activeAlerts = computed(() => store.activeAlerts.value)
const alertConfigs = computed(() => store.alertConfigs.value)

const { formatMetricName, getMetricUnit, updateAlertConfig } = store

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString()
}

function toggleAlert(key, enabled) {
  updateAlertConfig(key, { enabled })
}

function updateThreshold(key, thresholdKey, value) {
  updateAlertConfig(key, { [thresholdKey]: parseFloat(value) })
}
</script>

<style scoped>
.alert-manager {
  padding: 20px;
}

.alert-header {
  margin-bottom: 24px;
}

.alert-header h2 {
  margin: 0 0 8px 0;
  color: #FFF;
}

.alert-description {
  color: #888;
  margin: 0;
}

.active-alerts-section {
  margin-bottom: 32px;
}

.active-alerts-section h3,
.config-section h3 {
  color: #FFF;
  margin: 0 0 16px 0;
  font-size: 16px;
}

.no-alerts {
  margin-bottom: 16px;
}

.status-card {
  padding: 12px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-card.success {
  background: rgba(107, 255, 220, 0.1);
  border: 1px solid #6BFFDC;
  color: #6BFFDC;
}

.status-icon {
  font-weight: bold;
}

.alerts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.alert-card {
  padding: 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}

.alert-card:hover {
  transform: translateY(-2px);
}

.alert-card.warning {
  background: rgba(255, 183, 77, 0.15);
  border: 1px solid #FFB74D;
}

.alert-card.critical {
  background: rgba(255, 82, 82, 0.15);
  border: 1px solid #FF5252;
}

.alert-title {
  font-weight: 600;
  color: #FFF;
  margin-bottom: 4px;
}

.alert-message {
  font-size: 13px;
  color: #CCC;
  margin-bottom: 8px;
}

.alert-time {
  font-size: 11px;
  color: #888;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.config-card {
  background: #1E1E1E;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 16px;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.config-name {
  font-weight: 500;
  color: #FFF;
}

/* Toggle switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #333;
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: #666;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle input:checked + .toggle-slider {
  background-color: rgba(107, 255, 220, 0.3);
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(20px);
  background-color: #6BFFDC;
}

.config-thresholds {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.threshold-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.threshold-row label {
  color: #888;
  min-width: 60px;
  font-size: 13px;
}

.threshold-row input {
  background: #252525;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 6px 10px;
  color: #FFF;
  width: 80px;
  font-size: 13px;
}

.threshold-row input:focus {
  outline: none;
  border-color: #FF6DF0;
}

.threshold-row .unit {
  color: #666;
  font-size: 12px;
}
</style>
