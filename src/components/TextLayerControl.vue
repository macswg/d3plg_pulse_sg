<!-- This file handles Python execution in d3. This is from the d3 template at the developer website. https://developer.disguise.one/plugins/getting-started/ -->

<template>
  <div class="text-layer-section">
    <h2>Text Layer Control</h2>
    <button @click="handleAddTextLayer">Add Hello World</button>
  </div>
</template>

<script setup>
import { hello_world } from '../hello_world.py'

// Extract the director endpoint from the URL query parameters
// Supports localhost, Tailscale, and explicit director parameter
const urlParams = new URLSearchParams(window.location.search)
const { hostname } = window.location
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
// Use current hostname (works for Tailscale if accessed via Tailscale hostname)
// For localhost, use localhost; otherwise use the current hostname (Tailscale or otherwise)
const defaultDirector = isLocalhost ? 'localhost:80' : `${hostname}:80`
const directorEndpoint = urlParams.get('director') || defaultDirector

// Initialize the Python bindings composable
const module = hello_world(directorEndpoint)

// Feedback about registration
module.registration.then((reg) => {
  console.log('Hello World module registered', reg)
}).catch((error) => {
  console.error('Error registering Hello World module:', error)
})

async function handleAddTextLayer() {
  try {
    await module.addTextLayer()
  } catch (error) {
    console.error('Error:', error)
  }
}
</script>

<style scoped>
.text-layer-section {
  margin: 1rem;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
}
</style>
