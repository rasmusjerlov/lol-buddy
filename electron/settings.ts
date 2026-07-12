import Store from 'electron-store'

interface Settings {
  autoAccept: boolean
  autoAcceptDelay: number
  leaguePath: string
}

const defaults: Settings = {
  autoAccept: false,
  autoAcceptDelay: 0,
  leaguePath: ''
}

const store = new Store<Settings>({ defaults })

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return store.get(key)
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  store.set(key, value)
}
