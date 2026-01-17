<template>
  <div class="app">
    <h1>Designer Plugin</h1>
    
    <!-- Text Layer Control Component -->
    <TextLayerControl />
    
    <!-- Playhead Display Component -->
    <PlayheadDisplay :liveUpdate="liveUpdate" />
    
    <!-- Display connection status -->
    <LiveUpdateOverlay :liveUpdate="liveUpdate" />
  </div>
</template>

<script setup>
import { useLiveUpdate, LiveUpdateOverlay } from '@disguise-one/vue-liveupdate'
import TextLayerControl from './components/TextLayerControl.vue'
import PlayheadDisplay from './components/PlayheadDisplay.vue'


// Extract the director endpoint from the URL query parameters
// Supports localhost, Tailscale, and explicit director parameter
const urlParams = new URLSearchParams(window.location.search)
const { hostname, protocol } = window.location
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
// Use current hostname (works for Tailscale if accessed via Tailscale hostname)
// For localhost, use localhost; otherwise use the current hostname (Tailscale or otherwise)
const defaultDirector = isLocalhost ? 'localhost:80' : `${hostname}:80`
const directorEndpoint = urlParams.get('director') || defaultDirector


// Initialize the live update composable for the overlay
const liveUpdate = useLiveUpdate(directorEndpoint)
</script>

<style>
.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}
</style>
