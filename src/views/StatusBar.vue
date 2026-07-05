<template>
  <div class="status-bar" :class="store.status">
    <div class="traffic-light-spacer" />
    <span class="indicator" />
    <span v-if="store.status === 'connected' && store.summoner">
      {{ store.summoner.gameName || store.summoner.displayName }} · Lv {{ store.summoner.summonerLevel }}
    </span>
    <span v-else-if="store.status === 'connected'">Connecting…</span>
    <span v-else>Waiting for League Client…</span>
  </div>
</template>

<script setup lang="ts">
import { useConnectionStore } from '../stores/connection'

const store = useConnectionStore()
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  /* full-height draggable titlebar */
  -webkit-app-region: drag;
  height: 40px;
  padding: 0 16px;
  font-size: 13px;
  background: #1a1a2e;
  color: #c8aa6e;
  border-bottom: 1px solid #785a28;
  flex-shrink: 0;
}

/* Reserve space for macOS traffic lights (close/min/max buttons) */
.traffic-light-spacer {
  width: 68px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5b5b5b;
  flex-shrink: 0;
}

.status-bar.connected .indicator {
  background: #00c851;
}
</style>
