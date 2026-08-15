import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { FeedbackEventV2, LocalFeedbackRecord } from '../src/protocol.js'
import { FeedbackStore } from '../src/storage.js'
import { ExperienceUploader } from '../src/uploader.js'

const servers: Array<ReturnType<typeof createServer>> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
})

function record(): LocalFeedbackRecord {
  const event: FeedbackEventV2 = {
    schemaVersion: 2,
    type: 'feedback.signal',
    eventId: crypto.randomUUID(),
    plugin: { moduleName: 'plugin', version: '1.0.0' },
    health: 'error',
    experience: 'bad',
    source: 'user_confirmed',
  }
  return { event, requestedShare: false }
}

describe('strict local outbox and uploader', () => {
  it('uses private filesystem permissions and creates no stable identity or crash journal', () => {
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const store = new FeedbackStore(join(root, 'data'))
    const value = record()
    store.append(value)
    expect(statSync(store.eventsPath).mode & 0o777).toBe(0o600)
    expect(Object.keys(store).sort()).toEqual([
      'dataDir', 'eventsPath', 'receiptSeenPath', 'receiptsPath', 'shareRequestsPath',
    ])
    const stored = readFileSync(store.eventsPath, 'utf8')
    expect(stored).not.toContain('participant')
    expect(stored).not.toContain('crash')
    expect(store.pending()).toHaveLength(0)
    store.requestShare(value.event.eventId)
    expect(store.pending()).toHaveLength(1)
  })

  it('posts the exact closed packet and persists a report-scoped receipt', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const store = new FeedbackStore(join(root, 'data'))
    const queued = record()
    store.append(queued)
    store.requestShare(queued.event.eventId)
    let received = ''
    const server = createServer((request, response) => {
      if (request.method === 'GET') {
        expect(request.headers['x-omdsh-follow-token']).toBe('follow-secret')
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({
          receiptId: 'receipt-1', status: 'retest-requested', updatedAt: 2,
          recommendedVersion: '0.3.1',
        }))
        return
      }
      expect(request.headers['idempotency-key']).toBe(queued.event.eventId)
      request.setEncoding('utf8')
      request.on('data', chunk => { received += chunk })
      request.on('end', () => {
        response.writeHead(200, { 'content-type': 'application/json' })
        const address = server.address()
        if (address === null || typeof address === 'string') throw new Error('missing test address')
        response.end(JSON.stringify({
          receiptId: 'receipt-1', status: 'clustered', updatedAt: 1,
          similarReports: 7,
          recommendedVersion: '0.3.0',
          followToken: 'follow-secret',
          updatesUrl: `http://127.0.0.1:${address.port}/v1/receipts/receipt-1`,
        }))
      })
    })
    servers.push(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing address')
    const uploader = new ExperienceUploader(store, {
      ingestUrl: `http://127.0.0.1:${address.port}/v1/experience-events`,
      authorizationEnv: 'OMDSH_TEST_TOKEN',
      requestTimeoutMs: 2_000,
    })
    const receipts = await uploader.flushPending(queued.event.eventId)
    expect(receipts.get(queued.event.eventId)).toMatchObject({
      status: 'clustered', similarReports: 7, recommendedVersion: '0.3.0',
    })
    expect(JSON.parse(received)).toEqual(queued.event)
    expect(Buffer.byteLength(received)).toBeLessThan(512)
    expect(store.pending()).toHaveLength(0)
    await expect(uploader.refreshReceipts()).resolves.toMatchObject([
      { status: 'retest-requested', recommendedVersion: '0.3.1' },
    ])
  })
})
