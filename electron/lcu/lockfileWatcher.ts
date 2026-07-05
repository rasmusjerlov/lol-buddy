import { watch, type FSWatcher } from 'chokidar'
import { readFile } from 'fs/promises'
import { parseLockfile, type LcuCredentials } from './authManager'

export type LockfileEvent =
  | { type: 'connected'; credentials: LcuCredentials }
  | { type: 'disconnected' }

export type LockfileListener = (event: LockfileEvent) => void

export class LockfileWatcher {
  private watcher: FSWatcher | null = null
  private listeners: LockfileListener[] = []

  /** Starts watching the League lockfile at the given path. */
  start(lockfilePath: string): void {
    if (this.watcher) return

    this.watcher = watch(lockfilePath, {
      persistent: true,
      usePolling: false,
      ignoreInitial: false
    })

    this.watcher.on('add', () => this.onLockfileAppeared(lockfilePath))
    this.watcher.on('change', () => this.onLockfileAppeared(lockfilePath))
    this.watcher.on('unlink', () => this.emit({ type: 'disconnected' }))
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
  }

  on(listener: LockfileListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private async onLockfileAppeared(path: string): Promise<void> {
    try {
      const content = await readFile(path, 'utf8')
      const credentials = parseLockfile(content)
      this.emit({ type: 'connected', credentials })
    } catch (err) {
      // Lockfile disappeared between detection and read — treat as disconnect
      this.emit({ type: 'disconnected' })
    }
  }

  private emit(event: LockfileEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}
