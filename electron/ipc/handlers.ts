import { ipcMain, BrowserWindow, dialog } from 'electron'
import { IPC } from './channels'
import type { LcuClient } from '../lcu/lcuClient'
import type { LcuCredentials } from '../lcu/authManager'
import { getSetting, setSetting } from '../settings'

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

  ipcMain.handle(IPC.SETTINGS_GET, (_event, key: string) => {
    return getSetting(key as 'autoAccept' | 'leaguePath')
  })

  ipcMain.handle(IPC.SETTINGS_SET, (_event, key: string, value: unknown) => {
    setSetting(key as 'autoAccept' | 'leaguePath', value as boolean & string)
  })

  ipcMain.handle(IPC.DIALOG_PICK_LEAGUE_PATH, async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select League of Legends install folder',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}

export function broadcastToRenderer(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, ...args)
  })
}
