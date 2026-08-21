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
              :src="champ.iconUrl"
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

    <!-- Standard pick mode: searchable champion grid when it's the player's turn -->
    <template v-else-if="cs.isMyTurn">
      <div class="section-label-row">
        <span class="section-label">Pick a Champion</span>
        <span v-if="cs.selectedChampId > 0" class="selected-hint">{{ selectedChampion?.name }}</span>
      </div>
      <input
        v-model="champSearch"
        type="text"
        placeholder="Search…"
        class="champ-search"
        @click.stop
      />
      <div class="champ-grid-scroll">
        <div class="champ-grid">
          <button
            v-for="champ in filteredChampions"
            :key="champ.id"
            class="grid-cell"
            :class="{
              selected: cs.selectedChampId === champ.id,
              unpickable: cs.allPickableChampIds.length > 0 && !cs.allPickableChampIds.includes(champ.id)
            }"
            :title="champ.name"
            @click="cs.hoverChampion(champ.id)"
          >
            <img
              :src="champ.iconUrl"
              :alt="champ.name"
              class="grid-icon"
              @error="onImgError"
              @load="onImgLoad"
            />
          </button>
        </div>
      </div>
    </template>

    <!-- Single champion mode: ARAM-assigned or standard (waiting / not my turn) -->
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
              :src="assignedChampion.iconUrl"
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
              :src="champ.iconUrl"
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

    <!-- Teammates + trade requests -->
    <template v-if="teammates.length > 0">
      <div class="section-label">Team</div>
      <div class="teammate-list">
        <div v-for="mate in teammates" :key="mate.cellId" class="teammate-row">
          <div class="mate-avatar">
            <img
              v-if="mate.championId > 0"
              :src="champIconUrl(mate.championId)"
              class="mate-icon"
              @error="onImgError"
            />
            <div v-else class="mate-icon-empty" />
          </div>
          <span class="mate-pos">{{ mate.position }}</span>

          <template v-if="mate.trade">
            <template v-if="mate.trade.state === 'RECEIVED'">
              <button class="trade-btn accept" @click="cs.acceptTrade(mate.trade.id)">Accept</button>
              <button class="trade-btn decline" @click="cs.declineTrade(mate.trade.id)">Decline</button>
            </template>
            <button
              v-else-if="mate.trade.state === 'AVAILABLE'"
              class="trade-btn"
              @click="cs.requestTrade(mate.trade.id)"
            >Trade</button>
            <span v-else-if="mate.trade.state === 'SENT'" class="trade-sent">Sent…</span>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChampSelectStore } from '../stores/champSelect'

interface ChampDisplay {
  id: number
  name: string
  iconUrl: string
}

interface TeammateDisplay {
  cellId: number
  championId: number
  position: string
  trade: { id: number; state: string } | null
}

const cs = useChampSelectStore()
const champSearch = ref('')

const timerPercent = computed(() =>
  cs.totalTime > 0 ? (cs.timeLeft / cs.totalTime) * 100 : 0
)

function champIconUrl(id: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`
}

function resolveChamp(id: number): ChampDisplay {
  const champion = cs.champions.find(c => c.id === id)
  return { id, name: champion?.name ?? '', iconUrl: champIconUrl(id) }
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

const filteredChampions = computed((): ChampDisplay[] => {
  const search = champSearch.value.toLowerCase().trim()
  return cs.champions
    .filter(c => {
      if (cs.allBans.includes(c.id)) return false
      if (search && !c.name.toLowerCase().includes(search) && !c.alias.toLowerCase().includes(search)) return false
      return true
    })
    .map(c => resolveChamp(c.id))
})

const teammates = computed((): TeammateDisplay[] =>
  cs.myTeam
    .filter(m => m.cellId !== cs.localPlayerCellId)
    .map(m => {
      const trade = cs.trades.find(t => t.cellId === m.cellId) ?? null
      return {
        cellId: m.cellId,
        championId: m.championId,
        position: m.assignedPosition || '?',
        trade: trade ? { id: trade.id, state: trade.state } : null
      }
    })
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

.section-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.selected-hint {
  font-size: 11px;
  color: var(--accent);
  font-weight: 600;
}

/* Champion search input */
.champ-search {
  width: 100%;
  padding: 6px 10px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-1);
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
  -webkit-app-region: no-drag;
}
.champ-search:focus {
  border-color: var(--accent);
}
.champ-search::placeholder {
  color: var(--text-3);
}

/* Scrollable champion grid */
.champ-grid-scroll {
  max-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  border-radius: var(--radius-sm);
}
.champ-grid-scroll::-webkit-scrollbar { width: 4px; }
.champ-grid-scroll::-webkit-scrollbar-track { background: transparent; }
.champ-grid-scroll::-webkit-scrollbar-thumb { background: var(--bg-4); border-radius: 2px; }

.champ-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 3px;
}

.grid-cell {
  aspect-ratio: 1;
  border: 2px solid transparent;
  border-radius: 3px;
  overflow: hidden;
  background: var(--bg-3);
  cursor: pointer;
  padding: 0;
  -webkit-app-region: no-drag;
  transition: border-color 0.1s, opacity 0.1s;
}
.grid-cell:hover { border-color: var(--bg-4); }
.grid-cell.selected { border-color: var(--accent); }
.grid-cell.unpickable { opacity: 0.35; }

.grid-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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

/* Teammate rows */
.teammate-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.teammate-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mate-avatar {
  flex-shrink: 0;
}

.mate-icon {
  width: 32px;
  height: 32px;
  border-radius: 3px;
  display: block;
  object-fit: cover;
}

.mate-icon-empty {
  width: 32px;
  height: 32px;
  border-radius: 3px;
  background: var(--bg-3);
}

.mate-pos {
  flex: 1;
  font-size: 11px;
  color: var(--text-3);
  text-transform: capitalize;
}

.trade-btn {
  padding: 4px 10px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: background 0.12s, color 0.12s;
}
.trade-btn:hover { background: var(--accent); color: #fff; }
.trade-btn.accept { border-color: var(--green, #3fa26b); color: var(--green, #3fa26b); }
.trade-btn.accept:hover { background: var(--green, #3fa26b); color: #fff; }
.trade-btn.decline { border-color: var(--red); color: var(--red); }
.trade-btn.decline:hover { background: var(--red); color: #fff; }

.trade-sent {
  font-size: 11px;
  color: var(--text-3);
  font-style: italic;
}
</style>
