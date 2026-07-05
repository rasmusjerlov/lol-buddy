import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface ReadyCheckPayload {
  data: {
    state: string
    timer: number
    playerResponse: 'None' | 'Accepted' | 'Declined'
    decliningMe: boolean
    dodgeWarning: string
  }
  eventType: string
  uri: string
}

export const useMatchmakingStore = defineStore('matchmaking', () => {
  const state = ref<string>('None')
  const countdown = ref<number>(0)
  const playerResponse = ref<'None' | 'Accepted' | 'Declined'>('None')

  let tickInterval: ReturnType<typeof setInterval> | null = null

  const isActive = computed(() => state.value === 'InProgress')

  function startTick(initialSeconds: number): void {
    stopTick()
    countdown.value = Math.ceil(initialSeconds)
    tickInterval = setInterval(() => {
      if (countdown.value > 0) {
        countdown.value--
      } else {
        stopTick()
      }
    }, 1000)
  }

  function stopTick(): void {
    if (tickInterval !== null) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  }

  async function handleLcuEvent(payload: ReadyCheckPayload): Promise<void> {
    const { state: newState, timer, playerResponse: response } = payload.data
    state.value = newState
    playerResponse.value = response as 'None' | 'Accepted' | 'Declined'

    if (newState === 'InProgress') {
      startTick(timer)
      const autoAccept = await window.settings.get<boolean>('autoAccept')
      if (autoAccept) {
        await accept()
      }
    } else {
      stopTick()
      countdown.value = 0
    }
  }

  async function accept(): Promise<void> {
    await window.lcu.post('/lol-matchmaking/v1/ready-check/accept')
  }

  async function decline(): Promise<void> {
    await window.lcu.post('/lol-matchmaking/v1/ready-check/decline')
  }

  function reset(): void {
    state.value = 'None'
    playerResponse.value = 'None'
    countdown.value = 0
    stopTick()
  }

  return { state, countdown, playerResponse, isActive, handleLcuEvent, accept, decline, reset }
})
