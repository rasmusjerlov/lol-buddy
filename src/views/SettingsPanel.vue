<template>
  <div class="settings">
    <h3 class="section-label">Settings</h3>

    <label class="setting-row">
      <div class="setting-text">
        <span class="setting-name">Auto-accept matches</span>
        <span class="setting-hint">Automatically accepts the ready-check. Use at your own risk.</span>
      </div>
      <button
        class="toggle"
        :class="{ on: autoAccept }"
        role="switch"
        :aria-checked="autoAccept"
        @click="toggle"
      >
        <span class="knob" />
      </button>
    </label>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const autoAccept = ref(false)

onMounted(async () => {
  autoAccept.value = await window.settings.get<boolean>('autoAccept')
})

async function toggle(): Promise<void> {
  autoAccept.value = !autoAccept.value
  await window.settings.set('autoAccept', autoAccept.value)
}
</script>

<style scoped>
.settings { display: flex; flex-direction: column; gap: 12px; }

.section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-2);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}

.setting-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
}

.setting-hint {
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.4;
}

/* Toggle */
.toggle {
  flex-shrink: 0;
  width: 42px;
  height: 24px;
  border-radius: 12px;
  border: none;
  background: var(--bg-4);
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  -webkit-app-region: no-drag;
}

.toggle.on { background: var(--accent); }

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
}

.toggle.on .knob { transform: translateX(18px); }
</style>
