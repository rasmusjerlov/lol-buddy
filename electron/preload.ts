import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from './ipc/channels'

export type LcuEventPayload = {
  eventName: string
  data: unknown
}

const lcuApi = {
  getStatus: (): Promise<{ connected: boolean; port?: number }> =>
    ipcRenderer.invoke(IPC.LCU_GET_STATUS),
  get: <T = unknown>(path: string): Promise<T> => ipcRenderer.invoke(IPC.LCU_GET, path),
  post: <T = unknown>(path: string, body?: unknown): Promise<T> =>
    ipcRenderer.invoke(IPC.LCU_POST, path, body),
  patch: <T = unknown>(path: string, body?: unknown): Promise<T> =>
    ipcRenderer.invoke(IPC.LCU_PATCH, path, body),
  delete: <T = unknown>(path: string): Promise<T> => ipcRenderer.invoke(IPC.LCU_DELETE, path),

  onConnected: (cb: (info: { port: number }) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, info: { port: number }): void => cb(info)
    ipcRenderer.on(IPC.LCU_CONNECTED, listener)
    return () => ipcRenderer.removeListener(IPC.LCU_CONNECTED, listener)
  },

  onDisconnected: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.LCU_DISCONNECTED, listener)
    return () => ipcRenderer.removeListener(IPC.LCU_DISCONNECTED, listener)
  },

  onEvent: (cb: (payload: LcuEventPayload) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: LcuEventPayload): void => cb(payload)
    ipcRenderer.on(IPC.LCU_EVENT, listener)
    return () => ipcRenderer.removeListener(IPC.LCU_EVENT, listener)
  }
}

const settingsApi = {
  get: <T>(key: string): Promise<T> => ipcRenderer.invoke(IPC.SETTINGS_GET, key),
  set: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, key, value)
}

contextBridge.exposeInMainWorld('lcu', lcuApi)
contextBridge.exposeInMainWorld('settings', settingsApi)

declare global {
  interface Window {
    lcu: typeof lcuApi
    settings: typeof settingsApi
  }
}
