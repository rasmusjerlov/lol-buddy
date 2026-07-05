<template>
  <div class="status-bar" :class="store.status">
    <div class="traffic-light-spacer" />
    <span class="dot" />
    <span class="label">
      <template v-if="store.status === 'connected' && store.summoner">
        <strong>{{ store.summoner.gameName || store.summoner.displayName }}</strong>
        <span class="level">Lv {{ store.summoner.summonerLevel }}</span>
      </template>
      <template v-else-if="store.status === 'connected'">Connecting…</template>
      <template v-else>Waiting for League…</template>
    </span>
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
  gap: 10px;
  height: 42px;
  padding: 0 16px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.traffic-light-spacer {
  width: 68px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-3);
  flex-shrink: 0;
  transition: background 0.3s;
}
.status-bar.connected .dot { background: var(--green); box-shadow: 0 0 6px var(--green); }

.label {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
}

.label strong { font-weight: 600; }

.level {
  font-size: 11px;
  color: var(--text-2);
  font-weight: 400;
}
</style>
