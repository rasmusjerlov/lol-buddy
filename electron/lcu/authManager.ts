export interface LcuCredentials {
  pid: number
  port: number
  password: string
  protocol: string
  /** Base64-encoded `riot:<password>` for Basic Auth */
  basicAuth: string
  /** https://127.0.0.1:<port> */
  baseUrl: string
  /** wss://127.0.0.1:<port> */
  wsUrl: string
}

/**
 * Parses the League lockfile format: `LeagueClient:pid:port:password:protocol`
 * Throws if the format is invalid.
 */
export function parseLockfile(content: string): LcuCredentials {
  const parts = content.trim().split(':')
  if (parts.length !== 5) {
    throw new Error(`Invalid lockfile format: expected 5 colon-separated fields, got ${parts.length}`)
  }

  const [, pidStr, portStr, password, protocol] = parts
  const pid = parseInt(pidStr, 10)
  const port = parseInt(portStr, 10)

  if (isNaN(pid) || isNaN(port)) {
    throw new Error(`Invalid lockfile: pid="${pidStr}" port="${portStr}" are not numbers`)
  }

  const basicAuth = Buffer.from(`riot:${password}`).toString('base64')

  return {
    pid,
    port,
    password,
    protocol,
    basicAuth,
    baseUrl: `https://127.0.0.1:${port}`,
    wsUrl: `wss://127.0.0.1:${port}`
  }
}
