import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ConnectionStatus = 'disconnected' | 'connected'

export interface Summoner {
  displayName: string
  gameName: string
  tagLine: string
  summonerLevel: number
  profileIconId: number
}

export const useConnectionStore = defineStore('connection', () => {
  const status = ref<ConnectionStatus>('disconnected')
  const port = ref<number | null>(null)
  const summoner = ref<Summoner | null>(null)
  const error = ref<string | null>(null)

  async function onConnected(info: { port: number }): Promise<void> {
    status.value = 'connected'
    port.value = info.port
    error.value = null
    summoner.value = null

    try {
      summoner.value = await window.lcu.get<Summoner>('/lol-summoner/v1/current-summoner')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch summoner'
    }
  }

  function onDisconnected(): void {
    status.value = 'disconnected'
    port.value = null
    summoner.value = null
  }

  return { status, port, summoner, error, onConnected, onDisconnected }
})
