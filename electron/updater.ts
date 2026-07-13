import https from 'https'
import { app } from 'electron'

function isNewer(remote: string, local: string): boolean {
  const r = remote.split('.').map(Number)
  const l = local.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((r[i] ?? 0) > (l[i] ?? 0)) return true
    if ((r[i] ?? 0) < (l[i] ?? 0)) return false
  }
  return false
}

export function checkForUpdate(): Promise<{ version: string; url: string } | null> {
  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: 'api.github.com',
        path: '/repos/rasmusjerlov/lol-buddy/releases/latest',
        headers: { 'User-Agent': 'lol-buddy', Accept: 'application/vnd.github.v3+json' }
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString()) as {
              tag_name?: string
              html_url?: string
            }
            const remote = (data.tag_name ?? '').replace(/^v/, '')
            if (remote && isNewer(remote, app.getVersion())) {
              resolve({ version: remote, url: data.html_url ?? '' })
            } else {
              resolve(null)
            }
          } catch {
            resolve(null)
          }
        })
      }
    )
    req.on('error', () => resolve(null))
    req.setTimeout(5000, () => {
      req.destroy()
      resolve(null)
    })
  })
}
