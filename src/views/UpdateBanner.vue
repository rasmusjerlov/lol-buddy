<template>
  <Transition name="banner">
    <div v-if="visible" class="update-banner">
      <span class="banner-text">
        <span class="new-pill">NEW</span>
        v{{ version }} available
      </span>
      <div class="banner-actions">
        <a :href="url" target="_blank" class="download-link">Download →</a>
        <button class="dismiss-btn" aria-label="Dismiss" @click="visible = false">✕</button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ version: string; url: string }>()
const visible = ref(true)
</script>

<style scoped>
.update-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 14px;
  background: color-mix(in srgb, var(--gold) 12%, var(--bg-2));
  border-bottom: 1px solid color-mix(in srgb, var(--gold) 30%, transparent);
  flex-shrink: 0;
}

.banner-text {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text-1);
}

.new-pill {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--gold);
  color: #000;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.download-link {
  font-size: 12px;
  font-weight: 600;
  color: var(--gold);
  text-decoration: none;
  -webkit-app-region: no-drag;
}
.download-link:hover { text-decoration: underline; }

.dismiss-btn {
  background: none;
  border: none;
  color: var(--text-3);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  -webkit-app-region: no-drag;
  line-height: 1;
}
.dismiss-btn:hover { color: var(--text-1); }

.banner-enter-active { transition: all 0.2s ease-out; }
.banner-leave-active { transition: all 0.15s ease-in; }
.banner-enter-from, .banner-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
