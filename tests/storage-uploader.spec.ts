import { createServer } from 'node:http'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ExperienceEventV1, LocalExperienceRecord } from '../src/protocol.js'
import { ExperienceStore } from '../src/storage.js'
import { ExperienceUploader } from '../src/uploader.js'

const servers: Array<ReturnType<typeof createServer>> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
})

function record(shareNote = false): LocalExperienceRecord {
  const event: ExperienceEventV1 = {
    schemaVersion: 1,
    type: 'feedback.submitted',
    eventId: crypto.randomUUID(),
    occurredAt: Date.now(),
    participantId: crypto.randomUUID(),
    trial: { id: 'trial', plugin: { moduleName: 'plugin' }, startedAt: 1, durationMs: 1 },
    environment: {
      dshVersion: 'v', nodeVersion: 'n', platform: 'darwin', arch: 'arm64', locale: 'zh', profileLabel: 'test',
    },
    signals: {
      loaderHealth: 'active', assistantMessages: 1, turnsStarted: 1, turnsCompleted: 1,
      toolCalls: 0, toolErrors: 0, agentErrors: 0,
    },
    feedback: { outcome: 'worked', retention: 'keep', note: 'private' },
    sharing: { transcript: 'none', noteIncluded: shareNote },
  }
  return { event, requestedShare: true, shareNote }
}

describe('local outbox and uploader', () => {
  it('uses private filesystem permissions and stable plugin-local identity', () => {
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const store = new ExperienceStore(join(root, 'data'))
    const first = store.participantId()
    expect(store.participantId()).toBe(first)
    expect(store.resetParticipantId()).not.toBe(first)
  })

  it('posts a narrow payload, persists the receipt, and clears pending state', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omdsh-plugin-lab-'))
    const store = new ExperienceStore(join(root, 'data'))
    const queued = record(false)
    store.append(queued)
    let received = ''
    const server = createServer((request, response) => {
      if (request.method === 'GET') {
        expect(request.headers['x-omdsh-follow-token']).toBe('follow-secret')
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({
          receiptId: 'receipt-1', status: 'retest-requested', updatedAt: 2,
          recommendedVersion: '0.3.3', message: '请用原任务复测。',
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
          recommendedVersion: '0.3.2',
          followToken: 'follow-secret',
          updatesUrl: `http://127.0.0.1:${address.port}/v1/receipts/receipt-1`,
        }))
      })
    })
    servers.push(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing test address')
    const uploader = new ExperienceUploader(store, {
      ingestUrl: `http://127.0.0.1:${address.port}/v1/experience-events`,
      authorizationEnv: 'OMDSH_TEST_TOKEN',
      requestTimeoutMs: 2_000,
    })
    const receipts = await uploader.flushPending(queued.event.eventId)
    expect(receipts.get(queued.event.eventId)).toMatchObject({
      status: 'clustered', similarReports: 7, recommendedVersion: '0.3.2',
    })
    expect(JSON.parse(received).feedback).toEqual({ outcome: 'worked', retention: 'keep' })
    expect(store.pending()).toHaveLength(0)
    expect(readFileSync(store.receiptsPath, 'utf8')).toContain(queued.event.eventId)
    await expect(uploader.refreshReceipts()).resolves.toMatchObject([
      { status: 'retest-requested', recommendedVersion: '0.3.3' },
    ])
    expect(store.unreadReceipts()).toHaveLength(1)
  })
})
