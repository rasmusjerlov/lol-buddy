import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from './channels'
import type { LcuClient } from '../lcu/lcuClient'
import type { LcuCredentials } from '../lcu/authManager'

let activeClient: LcuClient | null = null
let activeCredentials: LcuCredentials | null = null

export function setActiveClient(client: LcuClient | null, credentials: LcuCredentials | null): void {
  activeClient = client
  activeCredentials = credentials
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.LCU_GET_STATUS, () => {
    if (activeCredentials) {
      return { connected: true, port: activeCredentials.port }
    }
    return { connected: false }
  })

  ipcMain.handle(IPC.LCU_GET, async (_event, path: string) => {
    if (!activeClient) throw new Error('LCU not connected')
    return activeClient.get(path)
  })

  ipcMain.handle(IPC.LCU_POST, async (_event, path: string, body?: unknown) => {
    if (!activeClient) throw new Error('LCU not connected')
    return activeClient.post(path, body)
  })

  ipcMain.handle(IPC.LCU_PATCH, async (_event, path: string, body?: unknown) => {
    if (!activeClient) throw new Error('LCU not connected')
    return activeClient.patch(path, body)
  })

  ipcMain.handle(IPC.LCU_DELETE, async (_event, path: string) => {
    if (!activeClient) throw new Error('LCU not connected')
    return activeClient.delete(path)
  })
}

export function broadcastToRenderer(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, ...args)
  })
}
