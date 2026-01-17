<!-- This handles real-time updates from Designer. This is from the Disguise Developer website https://developer.disguise.one/plugins/getting-started/ -->

<template>
   <div class="playhead-section">
      <h2>Playhead Position</h2>
      <div class="playhead-value">{{ player_tRender !== undefined ? player_tRender.toFixed(2) : '0.00' }}s</div>
   </div>
</template>
  
<script setup>
  // Define the liveUpdate prop
  const props = defineProps({
    liveUpdate: {
      type: Object,
      required: true
    }
  })

  // Auto-subscribe to playhead position
  const { player_tRender } = props.liveUpdate.autoSubscribe('transportManager:default', ['object.player.tRender'])
</script>
  
<style scoped>
  .playhead-section {
    margin: 1rem;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  
  .playhead-value {
    font-size: 1.2rem;
    font-weight: bold;
  }
</style>
