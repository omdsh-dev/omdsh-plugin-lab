import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FeedbackService } from './service.js'

export interface HttpConfig {
  readonly ingestToken?: string
  readonly adminToken: string
}

export function createHandler(service: FeedbackService, config: HttpConfig) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (request.method === 'GET' && url.pathname === '/healthz') return json(response, 200, { status: 'ok' })
      if (request.method === 'POST' && url.pathname === '/v1/experience-events') {
        if (config.ingestToken !== undefined && bearer(request) !== config.ingestToken) return json(response, 401, { error: 'unauthorized' })
        return json(response, 200, await service.ingest(await body(request)))
      }
      const receipt = url.pathname.match(/^\/v1\/receipts\/([0-9a-f-]+)$/iu)
      if (request.method === 'GET' && receipt !== null) {
        const token = request.headers['x-omdsh-follow-token']
        if (typeof token !== 'string') return json(response, 401, { error: 'missing follow token' })
        const value = await service.follow(receipt[1] ?? '', token)
        return value === undefined ? json(response, 404, { error: 'not found' }) : json(response, 200, value)
      }
      const release = url.pathname.match(/^\/v1\/admin\/clusters\/([0-9a-f-]+)\/release$/iu)
      if (request.method === 'POST' && release !== null) {
        if (bearer(request) !== config.adminToken) return json(response, 401, { error: 'unauthorized' })
        const input = await body(request) as Record<string, unknown>
        const value = await service.release(release[1] ?? '', {
          recommendedVersion: typeof input.recommendedVersion === 'string' ? input.recommendedVersion : '',
          ...typeof input.trackingUrl === 'string' ? { trackingUrl: input.trackingUrl } : {},
        })
        return value === undefined ? json(response, 404, { error: 'cluster not found' }) : json(response, 200, value)
      }
      const evidence = url.pathname.match(/^\/v1\/plugins\/(.+)\/evidence$/u)
      if (request.method === 'GET' && evidence !== null) {
        return json(response, 200, await service.evidence(decodeURIComponent(evidence[1] ?? '')))
      }
      return json(response, 404, { error: 'not found' })
    } catch (error: unknown) {
      const status = error instanceof TypeError ? 400 : 500
      return json(response, status, { error: status === 400 ? 'invalid closed packet' : 'internal error' })
    }
  }
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1_024) throw new TypeError('request body exceeds 1 KiB')
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new TypeError('invalid JSON body')
  }
}

function bearer(request: IncomingMessage): string | undefined {
  const value = request.headers.authorization
  return value?.startsWith('Bearer ') === true ? value.slice(7) : undefined
}

function json(response: ServerResponse, status: number, value: unknown): void {
  const payload = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  })
  response.end(payload)
}
