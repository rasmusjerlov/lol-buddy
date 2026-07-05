<template>
  <div class="settings">
    <h2 class="heading">Settings</h2>

    <label class="row">
      <span class="label-text">
        Auto-accept matches
        <span class="hint">Accepts the ready-check automatically. Use at your own risk.</span>
      </span>
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
.settings {
  padding: 20px 24px;
  width: 100%;
}

.heading {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #5b5b7a;
  margin-bottom: 16px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}

.label-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hint {
  font-size: 11px;
  color: #5b5b7a;
}

/* Toggle switch */
.toggle {
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  background: #2a2a44;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  -webkit-app-region: no-drag;
}

.toggle.on { background: #1ea448; }

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}

.toggle.on .knob { transform: translateX(18px); }
</style>
