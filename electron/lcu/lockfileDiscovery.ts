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

/**
 * Try Get-Process.Path first, then WMI ExecutablePath as fallback.
 * Uses a single PowerShell call to minimise overhead.
 */
function queryWindowsProcess(): Promise<string | null> {
  return new Promise((resolve) => {
    // Two independent methods in one script; first non-empty result wins.
    const script =
      '$p=(Get-Process -Name LeagueClient -EA SilentlyContinue|Select-Object -First 1).Path;' +
      'if(!$p){$p=(Get-CimInstance Win32_Process -Filter "name=\'LeagueClient.exe\'" -EA SilentlyContinue|Select-Object -First 1).ExecutablePath};' +
      '$p'

    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', timeout: 8000, windowsHide: true },
      (_err, stdout) => {
        const exePath = (stdout ?? '').trim()
        resolve(exePath ? join(dirname(exePath), 'lockfile') : null)
      }
    )
  })
}

/**
 * Read the League install directory from the Windows registry.
 * Riot writes this during installation — works even before League starts.
 */
function queryRegistry(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'reg',
      [
        'query',
        'HKLM\\SOFTWARE\\WOW6432Node\\Riot Games, Inc\\League of Legends',
        '/v',
        'Install Dir'
      ],
      { encoding: 'utf8', timeout: 5000, windowsHide: true },
      (_err, stdout) => {
        const match = (stdout ?? '').match(/Install Dir\s+REG_SZ\s+(.+)/)
        const installDir = match?.[1]?.trim() ?? null
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
      // not at this path
    }
  }
  return null
}

/**
 * Returns the lockfile path to watch.
 * - macOS: fixed well-known path (watcher handles detection)
 * - Windows: tries process query → registry → common install paths
 */
export async function findLeagueLockfilePath(): Promise<string | null> {
  if (process.platform !== 'win32') {
    return MACOS_PATH
  }

  const fromProcess = await queryWindowsProcess()
  if (fromProcess) return fromProcess

  const fromRegistry = await queryRegistry()
  if (fromRegistry) return fromRegistry

  return checkFallbackPaths()
}
