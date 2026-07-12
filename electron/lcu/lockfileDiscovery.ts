import { execFile } from 'child_process'
import { dirname, join } from 'path'
import { access } from 'fs/promises'

const MACOS_PATH = '/Applications/League of Legends.app/Contents/LoL/lockfile'

const WINDOWS_FALLBACK_PATHS = [
  'C:\\Riot Games\\League of Legends\\lockfile',
  'D:\\Riot Games\\League of Legends\\lockfile',
  'C:\\Program Files\\Riot Games\\League of Legends\\lockfile',
  'D:\\Program Files\\Riot Games\\League of Legends\\lockfile',
]

function queryWindowsProcess(): Promise<string | null> {
  return new Promise((resolve) => {
    // Get the exe path directly — LeagueClient.exe lives in the same dir as the lockfile.
    // Using Get-Process .Path is more reliable than parsing CommandLine args.
    execFile(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "(Get-Process -Name LeagueClient -ErrorAction SilentlyContinue | Select-Object -First 1).Path"
      ],
      { encoding: 'utf8', timeout: 8000, windowsHide: true },
      (_err, stdout) => {
        const exePath = (stdout ?? '').trim()
        resolve(exePath ? join(dirname(exePath), 'lockfile') : null)
      }
    )
  })
}

async function checkFallbackPaths(): Promise<string | null> {
  for (const p of WINDOWS_FALLBACK_PATHS) {
    try {
      await access(p)
      return p
    } catch {
      // not found at this path
    }
  }
  return null
}

/**
 * Returns the lockfile path to watch.
 * - macOS: fixed well-known path (always returned; watcher handles detection)
 * - Windows: read LeagueClient.exe's path from the running process;
 *   fall back to common install paths if League isn't running yet.
 */
export async function findLeagueLockfilePath(): Promise<string | null> {
  if (process.platform !== 'win32') {
    return MACOS_PATH
  }
  const fromProcess = await queryWindowsProcess()
  if (fromProcess) return fromProcess
  return checkFallbackPaths()
}
