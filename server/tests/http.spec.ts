import { createServer } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { createHandler } from '../src/http.js'
import { MemoryRepository } from '../src/memory.js'
import { FeedbackService } from '../src/service.js'

const servers: Array<ReturnType<typeof createServer>> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
})

async function endpoint(): Promise<string> {
  const service = new FeedbackService(new MemoryRepository(), {
    followSecret: 'follow-secret-long-enough',
    publicBaseUrl: 'https://feedback.example.test',
    githubThreshold: 5,
  })
  const server = createServer(createHandler(service, { adminToken: 'admin-secret-long-enough' }))
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('missing address')
  return `http://127.0.0.1:${address.port}`
}

function packet() {
  return {
    schemaVersion: 3,
    type: 'feedback.signal',
    eventId: crypto.randomUUID(),
    plugin: { moduleName: '@example/plugin', version: '1.0.0' },
    health: 'ok',
    experience: 'good',
    category: 'general',
    source: 'user_confirmed',
  }
}

function packetV4(summary = '插件启动偏慢，但交互仍然清楚。') {
  return {
    ...packet(),
    schemaVersion: 4,
    summary,
    summarySource: 'user_edited',
  }
}

describe('HTTP privacy boundary', () => {
  it('returns a fixed error without echoing rejected content', async () => {
    const base = await endpoint()
    const secret = 'CANARY_PRIVATE_LOG_AND_TOKEN'
    const response = await fetch(`${base}/v1/experience-events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...packet(), log: secret }),
    })
    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).toBe('{"error":"invalid closed packet"}')
    expect(text).not.toContain(secret)
  })

  it('accepts a safe user summary and rejects a sensitive one without echoing it', async () => {
    const base = await endpoint()
    const accepted = await fetch(`${base}/v1/experience-events`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(packetV4()),
    })
    expect(accepted.status).toBe(200)
    const secret = 'token=CANARY_PRIVATE_TOKEN'
    const rejected = await fetch(`${base}/v1/experience-events`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(packetV4(secret)),
    })
    expect(rejected.status).toBe(400)
    expect(await rejected.text()).toBe('{"error":"invalid closed packet"}')
  })

  it('rejects bodies over 2 KiB before accepting their fields', async () => {
    const base = await endpoint()
    const response = await fetch(`${base}/v1/experience-events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...packet(), log: 'S'.repeat(3_000) }),
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid closed packet' })
  })

  it('uses a no-body-detail health response and no-store cache policy', async () => {
    const base = await endpoint()
    const response = await fetch(`${base}/healthz`)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ status: 'ok' })
    const verbose = await fetch(`${base}/healthz?verbose=true&include=logs`)
    expect(await verbose.json()).toEqual({ status: 'ok' })
  })
})
