import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ChampSelectAction {
  id: number
  actorCellId: number
  type: 'pick' | 'ban' | 'ten_bans_reveal' | 'vote'
  championId: number
  completed: boolean
  isInProgress: boolean
}

export interface ChampSelectTeamMember {
  cellId: number
  championId: number
  championPickIntent: number
  assignedPosition: string
  summonerId: number
  puuid: string
}

export interface ChampSelectSession {
  actions: ChampSelectAction[][]
  localPlayerCellId: number
  myTeam: ChampSelectTeamMember[]
  theirTeam: ChampSelectTeamMember[]
  timer: {
    adjustedTimeLeftInPhase: number
    totalTimeInPhase: number
    phase: string
    isInfinite: boolean
  }
  bans: { myTeamBans: number[]; theirTeamBans: number[] }
  benchChampions?: Array<{ championId: number; isPriority: boolean }>
  benchEnabled?: boolean
}

export interface ChampionSummary {
  id: number
  name: string
  alias: string
  squarePortraitPath: string
  roles: string[]
}

export interface ChampSelectEventPayload {
  data: ChampSelectSession
  eventType: 'Create' | 'Update' | 'Delete'
  uri: string
}

export const useChampSelectStore = defineStore('champSelect', () => {
  const active = ref(false)
  const localPlayerCellId = ref(0)
  const myAction = ref<ChampSelectAction | null>(null)
  const phase = ref('')
  const timeLeft = ref(0)
  const totalTime = ref(0)
  const myTeam = ref<ChampSelectTeamMember[]>([])
  const theirTeam = ref<ChampSelectTeamMember[]>([])
  const allBans = ref<number[]>([])
  const champions = ref<ChampionSummary[]>([])
  const loadingChampions = ref(false)
  const selectedChampId = ref(0)
  const assignedChampionId = ref(0)
  const benchChampionIds = ref<number[]>([])

  let tickInterval: ReturnType<typeof setInterval> | null = null

  const isMyTurn = computed(() => myAction.value?.isInProgress === true)

  const canLockIn = computed(() => isMyTurn.value && selectedChampId.value > 0)

  function startTick(seconds: number): void {
    stopTick()
    timeLeft.value = Math.ceil(seconds)
    tickInterval = setInterval(() => {
      if (timeLeft.value > 0) timeLeft.value--
      else stopTick()
    }, 1000)
  }

  function stopTick(): void {
    if (tickInterval !== null) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  }

  async function loadChampions(): Promise<void> {
    if (champions.value.length > 0 || loadingChampions.value) return
    loadingChampions.value = true
    try {
      const list = await window.lcu.get<ChampionSummary[]>('/lol-game-data/assets/v1/champion-summary')
      champions.value = list.filter((c) => c.id > 0).sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      // Will retry on next champ select
    } finally {
      loadingChampions.value = false
    }
  }

  function handleLcuEvent(payload: ChampSelectEventPayload): void {
    if (payload.eventType === 'Delete') {
      reset()
      return
    }

    const session = payload.data
    if (!session) return

    active.value = true
    localPlayerCellId.value = session.localPlayerCellId

    const flatActions = session.actions.flat()

    // Prefer in-progress pick; fall back to any upcoming pick (for pre-selection)
    myAction.value =
      flatActions.find(
        (a) =>
          a.actorCellId === session.localPlayerCellId &&
          a.type === 'pick' &&
          !a.completed &&
          a.isInProgress
      ) ??
      flatActions.find(
        (a) =>
          a.actorCellId === session.localPlayerCellId && a.type === 'pick' && !a.completed
      ) ??
      null

    // Sync selected champ from LCU state if user hasn't made a choice yet.
    // In ARAM the assigned champion lives in myTeam, not in the action.
    const localMember = (session.myTeam ?? []).find(m => m.cellId === session.localPlayerCellId)
    // Use || so a zero champion id (not yet assigned) falls through to the action's championId
    const assignedId = localMember?.championId || myAction.value?.championId || 0
    if (assignedId !== 0) {
      assignedChampionId.value = assignedId
      if (selectedChampId.value === 0) selectedChampId.value = assignedId
    }

    benchChampionIds.value = (session.benchChampions ?? [])
      .map(b => b.championId)
      .filter(id => id > 0)

    const t = session.timer
    phase.value = t.phase
    if (!t.isInfinite) {
      startTick(t.adjustedTimeLeftInPhase / 1000)
      totalTime.value = t.totalTimeInPhase / 1000
    }

    myTeam.value = session.myTeam ?? []
    theirTeam.value = session.theirTeam ?? []
    allBans.value = [
      ...(session.bans?.myTeamBans ?? []),
      ...(session.bans?.theirTeamBans ?? [])
    ].filter(Boolean)

    if (champions.value.length === 0) {
      loadChampions()
    }
  }

  async function hoverChampion(championId: number): Promise<void> {
    selectedChampId.value = championId
    if (!myAction.value) return
    try {
      await window.lcu.patch(`/lol-champ-select/v1/session/actions/${myAction.value.id}`, {
        championId
      })
    } catch {
      // Action may not yet be patchable — local selection is still stored
    }
  }

  async function swapBenchChamp(championId: number): Promise<void> {
    try {
      await window.lcu.post(`/lol-champ-select/v1/session/bench/swap/${championId}`)
      // Optimistically update; the LCU event will correct us if it differs
      assignedChampionId.value = championId
      selectedChampId.value = championId
    } catch {
      // Session update will sync correct state
    }
  }

  async function lockIn(): Promise<void> {
    if (!myAction.value || selectedChampId.value === 0) return
    try {
      await window.lcu.patch(`/lol-champ-select/v1/session/actions/${myAction.value.id}`, {
        championId: selectedChampId.value
      })
      await window.lcu.post(`/lol-champ-select/v1/session/actions/${myAction.value.id}/complete`)
    } catch {
      // Ignore — LCU may return 500 on success
    }
  }

  function reset(): void {
    active.value = false
    localPlayerCellId.value = 0
    myAction.value = null
    phase.value = ''
    timeLeft.value = 0
    totalTime.value = 0
    myTeam.value = []
    theirTeam.value = []
    allBans.value = []
    selectedChampId.value = 0
    assignedChampionId.value = 0
    benchChampionIds.value = []
    stopTick()
    // Keep champions cached — they don't change between sessions
  }

  return {
    active,
    localPlayerCellId,
    myAction,
    phase,
    timeLeft,
    totalTime,
    myTeam,
    theirTeam,
    allBans,
    champions,
    loadingChampions,
    selectedChampId,
    assignedChampionId,
    benchChampionIds,
    isMyTurn,
    canLockIn,
    handleLcuEvent,
    hoverChampion,
    swapBenchChamp,
    lockIn,
    loadChampions,
    reset
  }
})
