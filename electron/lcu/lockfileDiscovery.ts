import { execFile } from 'child_process'
import { join } from 'path'
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
    // PowerShell CimInstance is reliable on Windows 10/11 regardless of wmic deprecation
    execFile(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "(Get-CimInstance Win32_Process -Filter \"name='LeagueClient.exe'\").CommandLine"
      ],
      { encoding: 'utf8', timeout: 8000, windowsHide: true },
      (_err, stdout) => {
        // Command line looks like: "...\LeagueClient.exe" --install-dir="C:\Riot Games\League of Legends" ...
        const quoted = (stdout ?? '').match(/--install-dir="([^"]+)"/)
        const unquoted = (stdout ?? '').match(/--install-dir=([^\s"]+)/)
        const installDir = quoted?.[1] ?? unquoted?.[1] ?? null
        resolve(installDir ? join(installDir, 'lockfile') : null)
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
 * - Windows: query the running LeagueClient.exe process for its install dir;
 *   fall back to common paths if the process isn't running yet.
 */
export async function findLeagueLockfilePath(): Promise<string | null> {
  if (process.platform !== 'win32') {
    return MACOS_PATH
  }
  const fromProcess = await queryWindowsProcess()
  if (fromProcess) return fromProcess
  return checkFallbackPaths()
}
