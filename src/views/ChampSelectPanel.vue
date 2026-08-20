<template>
  <div class="cs-panel">
    <div class="cs-header">
      <span class="cs-title">Champion Select</span>
      <span v-if="cs.totalTime > 0" class="timer-label" :class="{ urgent: cs.timeLeft <= 5 }">
        {{ cs.timeLeft }}s
      </span>
    </div>

    <div v-if="cs.totalTime > 0" class="timer-bar">
      <div
        class="timer-fill"
        :class="{ urgent: cs.timeLeft <= 5 }"
        :style="{ width: timerPercent + '%' }"
      />
    </div>

    <!-- Pool mode: player picks from 2-3 personal options (ARAM Mayhem) -->
    <template v-if="pickPool.length > 0">
      <div class="section-label">Pick Your Champion</div>
      <div class="champ-row">
        <button
          v-for="champ in pickPool"
          :key="champ.id"
          class="champ-cell pick-option"
          :class="{ selected: cs.selectedChampId === champ.id }"
          :title="champ.name"
          @click="cs.hoverChampion(champ.id)"
        >
          <div class="icon-wrap large">
            <img
              :key="champ.squarePortraitPath"
              :src="`lcu://${champ.squarePortraitPath}`"
              :alt="champ.name"
              class="champ-icon"
              @error="onImgError"
              @load="onImgLoad"
            />
          </div>
          <span v-if="champ.name" class="champ-name">{{ champ.name }}</span>
        </button>
      </div>
    </template>

    <!-- Single champion mode: ARAM-assigned or standard pick -->
    <template v-else>
      <div v-if="assignedChampion" class="section-label">Your Champion</div>
      <div v-if="assignedChampion" class="champ-row">
        <button
          class="champ-cell assigned"
          :class="{ selected: cs.selectedChampId === assignedChampion.id }"
          :title="assignedChampion.name"
          @click="cs.hoverChampion(assignedChampion.id)"
        >
          <div class="icon-wrap large">
            <img
              :key="assignedChampion.squarePortraitPath"
              :src="`lcu://${assignedChampion.squarePortraitPath}`"
              :alt="assignedChampion.name"
              class="champ-icon"
              @error="onImgError"
              @load="onImgLoad"
            />
          </div>
          <span v-if="assignedChampion.name" class="champ-name">{{ assignedChampion.name }}</span>
        </button>
      </div>
      <div v-if="!assignedChampion && benchChampions.length === 0" class="status-text">
        Waiting for champion assignment…
      </div>
    </template>

    <!-- Bench champions (shared pool for swapping) -->
    <template v-if="benchChampions.length > 0">
      <div class="section-label">Bench</div>
      <div class="champ-row">
        <button
          v-for="champ in benchChampions"
          :key="champ.id"
          class="champ-cell"
          :title="champ.name"
          @click="cs.swapBenchChamp(champ.id)"
        >
          <div class="icon-wrap">
            <img
              :key="champ.squarePortraitPath"
              :src="`lcu://${champ.squarePortraitPath}`"
              :alt="champ.name"
              class="champ-icon"
              @error="onImgError"
              @load="onImgLoad"
            />
          </div>
          <span v-if="champ.name" class="champ-name">{{ champ.name }}</span>
        </button>
      </div>
    </template>

    <!-- Lock-in -->
    <button
      class="lock-btn"
      :disabled="!cs.canLockIn"
      @click="cs.lockIn()"
    >
      Lock In{{ selectedChampion ? ` — ${selectedChampion.name}` : '' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChampSelectStore } from '../stores/champSelect'

interface ChampDisplay {
  id: number
  name: string
  squarePortraitPath: string
}

const cs = useChampSelectStore()

const timerPercent = computed(() =>
  cs.totalTime > 0 ? (cs.timeLeft / cs.totalTime) * 100 : 0
)

// Resolve by ID; fall back to a predictable LCU icon path so icons show
// even before the champion list has loaded.
function resolveChamp(id: number): ChampDisplay {
  return (
    cs.champions.find(c => c.id === id) ?? {
      id,
      name: '',
      squarePortraitPath: `/lol-game-data/assets/v1/champion-icons/${id}.png`
    }
  )
}

const assignedChampion = computed((): ChampDisplay | null =>
  cs.assignedChampionId > 0 ? resolveChamp(cs.assignedChampionId) : null
)

const pickPool = computed((): ChampDisplay[] =>
  cs.pickableChampionIds.map(id => resolveChamp(id))
)

const benchChampions = computed((): ChampDisplay[] =>
  cs.benchChampionIds.map(id => resolveChamp(id))
)

const selectedChampion = computed((): ChampDisplay | null =>
  cs.selectedChampId > 0 ? resolveChamp(cs.selectedChampId) : null
)

function onImgError(e: Event): void {
  ;(e.target as HTMLImageElement).style.opacity = '0'
}

function onImgLoad(e: Event): void {
  ;(e.target as HTMLImageElement).style.opacity = '1'
}
</script>

<style scoped>
.cs-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.cs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cs-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-1);
}

.timer-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
}
.timer-label.urgent { color: var(--red); }

.timer-bar {
  height: 4px;
  background: var(--bg-4);
  border-radius: 2px;
  overflow: hidden;
}

.timer-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 1s linear, background 0.3s;
}
.timer-fill.urgent { background: var(--red); }

.status-text {
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
  padding: 8px 0;
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
}

.champ-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.champ-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--bg-3);
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: border-color 0.12s, background 0.12s;
  min-width: 56px;
}
.champ-cell:hover { background: var(--bg-4); border-color: var(--bg-4); }
.champ-cell.selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 15%, var(--bg-3)); }
.champ-cell.assigned { flex: 0 0 auto; }
.champ-cell.pick-option { flex: 1 1 0; min-width: 64px; max-width: 100px; }

.icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 3px;
  overflow: hidden;
  background: transparent;
  flex-shrink: 0;
}

.icon-wrap.large {
  width: 64px;
  height: 64px;
}

.champ-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.champ-name {
  font-size: 9px;
  color: var(--text-2);
  text-align: center;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 64px;
  line-height: 1.2;
}

.lock-btn {
  width: 100%;
  padding: 11px 0;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: filter 0.15s, transform 0.1s;
}
.lock-btn:hover:not(:disabled) { filter: brightness(1.15); }
.lock-btn:active:not(:disabled) { transform: scale(0.98); }
.lock-btn:disabled { opacity: 0.4; cursor: default; }
</style>
