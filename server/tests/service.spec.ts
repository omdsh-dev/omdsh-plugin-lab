import { describe, expect, it, vi } from 'vitest'
import { clusterKey } from '../src/fingerprint.js'
import { MemoryRepository } from '../src/memory.js'
import { FeedbackService } from '../src/service.js'
import { acceptEvent } from '../src/validation.js'

function event(experience: 'good' | 'mixed' | 'bad' = 'bad', eventId = crypto.randomUUID()) {
  return {
    schemaVersion: 3,
    type: 'feedback.signal',
    eventId,
    plugin: { moduleName: '@example/search', version: '1.0.0' },
    health: 'ok',
    experience,
    category: 'reliability',
    source: 'user_confirmed',
  } as const
}

function service(repository = new MemoryRepository(), publisher?: { publish: (cluster: never) => Promise<string> }) {
  return new FeedbackService(repository, {
    followSecret: 'follow-secret-long-enough',
    publicBaseUrl: 'https://feedback.example.test',
    githubThreshold: 3,
  }, publisher)
}

describe('task-agnostic summary feedback flywheel service', () => {
  it('is idempotent and returns a report-scoped follow receipt', async () => {
    const api = service()
    const input = event()
    const first = await api.ingest(input)
    const second = await api.ingest(input)
    expect(second.receiptId).toBe(first.receiptId)
    expect(first.followToken).toBeTruthy()
    await expect(api.follow(first.receiptId, first.followToken ?? '')).resolves.toMatchObject({ status: 'received' })
    await expect(api.follow(first.receiptId, 'wrong')).resolves.toBeUndefined()
  })

  it('counts reports without a stable user id and closes the loop through explicit retest', async () => {
    const repository = new MemoryRepository()
    const api = service(repository)
    const first = await api.ingest(event('bad'))
    const second = await api.ingest(event('bad'))
    expect(second.similarReports).toBe(2)
    expect(second.status).toBe('clustered')
    const original = await repository.receipt(first.receiptId)
    if (original === undefined) throw new Error('missing receipt')
    await api.release(original.cluster.id, { recommendedVersion: '1.0.1' })
    await expect(api.follow(first.receiptId, first.followToken ?? '')).resolves.toMatchObject({
      status: 'retest-requested', recommendedVersion: '1.0.1',
    })
    await api.ingest({ ...event('good'), retestOfReceiptId: first.receiptId })
    await expect(api.follow(first.receiptId, first.followToken ?? '')).resolves.toMatchObject({ status: 'verified' })
  })

  it('clusters only public plugin coordinates and finite signals', () => {
    const accepted = acceptEvent(event('bad'))
    expect(clusterKey({ ...accepted, experience: 'good' })).not.toBe(clusterKey(accepted))
    expect(clusterKey({ ...accepted, health: 'error' })).not.toBe(clusterKey(accepted))
    expect(clusterKey({ ...accepted, category: 'performance' })).not.toBe(clusterKey(accepted))
  })

  it('rejects old telemetry, log-derived fields, free text and unknown fields fail closed', () => {
    const attempts = [
      { ...event(), note: 'CANARY_SECRET' },
      { ...event(), summary: 'CANARY_PRIVATE_TASK' },
      { ...event(), log: 'CANARY_SECRET' },
      { ...event(), stack: '/Users/alice/private.ts' },
      { ...event(), participantId: crypto.randomUUID() },
      { ...event(), occurredAt: Date.now() },
      { ...event(), signals: { toolErrors: 1 } },
      { ...event(), environment: { platform: 'darwin' } },
    ]
    for (const attempt of attempts) expect(() => acceptEvent(attempt)).toThrow('unsupported fields')
    expect(() => acceptEvent({ ...event(), schemaVersion: 2 })).toThrow('unsupported event schema')
    expect(() => acceptEvent({ ...event(), category: 'private-task-summary' })).toThrow('category is invalid')
    expect(() => acceptEvent({ ...event(), source: 'agent_inferred' })).toThrow('source is invalid')
  })

  it('publishes only an aggregate after the configured threshold', async () => {
    const publish = vi.fn(async () => 'https://github.example/issues/1')
    const api = service(new MemoryRepository(), { publish: publish as never })
    await api.ingest(event('bad'))
    await api.ingest(event('bad'))
    expect(publish).not.toHaveBeenCalled()
    const third = await api.ingest(event('bad'))
    expect(publish).toHaveBeenCalledOnce()
    expect(third).toMatchObject({ status: 'reported', similarReports: 3 })
  })
})
