import { default as Store } from 'electron-store'

interface Settings {
  autoAccept: boolean
}

const defaults: Settings = {
  autoAccept: false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _store = new Store<Settings>({ defaults }) as any

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return (_store.store as Settings)[key] ?? defaults[key]
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  _store.store = { ...(_store.store as Settings), [key]: value }
}
