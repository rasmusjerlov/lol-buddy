import { watch, type FSWatcher } from 'chokidar'
import { readFile } from 'fs/promises'
import { dirname, basename } from 'path'
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

    const dir = dirname(lockfilePath)
    const filename = basename(lockfilePath)

    // Watch the parent directory — chokidar v4 doesn't support watching
    // a path that doesn't exist yet; the directory is always present.
    this.watcher = watch(dir, {
      persistent: true,
      ignoreInitial: false,
      depth: 0
    })

    this.watcher.on('add', (p) => {
      if (basename(p) === filename) this.onLockfileAppeared(lockfilePath)
    })
    this.watcher.on('change', (p) => {
      if (basename(p) === filename) this.onLockfileAppeared(lockfilePath)
    })
    this.watcher.on('unlink', (p) => {
      if (basename(p) === filename) this.emit({ type: 'disconnected' })
    })
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
    } catch {
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
