import https from 'https'
import WebSocket from 'ws'
import type { LcuCredentials } from './authManager'

export type LcuEventHandler = (data: unknown) => void

export class LcuClient {
  private credentials: LcuCredentials
  // LCU uses a self-signed cert — rejectUnauthorized scoped to this agent only
  private agent = new https.Agent({ rejectUnauthorized: false })
  private ws: WebSocket | null = null
  private subscriptions = new Map<string, Set<LcuEventHandler>>()
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor(credentials: LcuCredentials) {
    this.credentials = credentials
  }

  // --- REST ---

  request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.credentials.baseUrl}${path}`)
      const bodyStr = body !== undefined ? JSON.stringify(body) : undefined
      const headers: Record<string, string> = {
        Authorization: `Basic ${this.credentials.basicAuth}`,
        Accept: 'application/json'
      }
      if (bodyStr !== undefined) {
        headers['Content-Type'] = 'application/json'
        headers['Content-Length'] = String(Buffer.byteLength(bodyStr))
      }

      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method,
          headers,
          agent: this.agent
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8')
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`LCU ${method} ${path} → ${res.statusCode}: ${text}`))
              return
            }
            try {
              resolve(text ? (JSON.parse(text) as T) : (undefined as T))
            } catch {
              reject(new Error(`LCU ${method} ${path} → invalid JSON: ${text}`))
            }
          })
        }
      )

      req.on('error', reject)
      if (bodyStr !== undefined) req.write(bodyStr)
      req.end()
    })
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body)
  }

  delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }

  // --- WebSocket ---

  connectWebSocket(): void {
    if (this.ws) return
    this._openWebSocket()
  }

  private _openWebSocket(): void {
    const ws = new WebSocket(this.credentials.wsUrl, {
      headers: { Authorization: `Basic ${this.credentials.basicAuth}` },
      rejectUnauthorized: false
    })

    ws.on('open', () => {
      // Re-subscribe to all registered events after reconnect
      for (const eventName of this.subscriptions.keys()) {
        ws.send(JSON.stringify([5, eventName]))
      }
    })

    ws.on('message', (data) => {
      try {
        const payload = JSON.parse(data.toString())
        // LCU WS messages: [opcode, eventName, eventData]
        if (!Array.isArray(payload) || payload.length < 3) return
        const [, eventName, eventData] = payload
        const handlers = this.subscriptions.get(eventName)
        handlers?.forEach((h) => h(eventData))
      } catch {
        // Ignore malformed messages
      }
    })

    ws.on('close', () => {
      this.ws = null
      // Reconnect after 2s if there are still subscriptions
      if (this.subscriptions.size > 0) {
        this.reconnectTimer = setTimeout(() => this._openWebSocket(), 2000)
      }
    })

    ws.on('error', () => {
      // 'close' will fire after error; let it handle reconnect
    })

    this.ws = ws
  }

  subscribe(eventName: string, handler: LcuEventHandler): () => void {
    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Set())
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify([5, eventName]))
      }
    }
    this.subscriptions.get(eventName)!.add(handler)

    return () => {
      const handlers = this.subscriptions.get(eventName)
      handlers?.delete(handler)
      if (handlers?.size === 0) {
        this.subscriptions.delete(eventName)
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify([6, eventName]))
        }
      }
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.subscriptions.clear()
  }
}
