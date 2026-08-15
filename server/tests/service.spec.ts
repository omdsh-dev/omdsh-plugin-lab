import { describe, expect, it } from 'vitest'
import { clusterKey } from '../src/fingerprint.js'
import { MemoryRepository } from '../src/memory.js'
import { FeedbackService } from '../src/service.js'

function event(participantId = crypto.randomUUID(), eventId = crypto.randomUUID(), outcome = 'failed') {
  return {
    schemaVersion: 1,
    type: 'feedback.submitted',
    eventId,
    occurredAt: Date.now(),
    participantId,
    trial: {
      id: crypto.randomUUID(), plugin: { moduleName: '@example/search', version: '1.0.0' },
      taskId: 'repo-search', startedAt: Date.now() - 1_000, durationMs: 1_000,
    },
    environment: {
      dshVersion: '0.1.0-rc.6', nodeVersion: 'v24', platform: 'darwin', arch: 'arm64', locale: 'zh', profileLabel: 'test',
    },
    signals: {
      loaderHealth: 'active', assistantMessages: 1, turnsStarted: 1, turnsCompleted: 1,
      toolCalls: 1, toolErrors: 1, agentErrors: 0,
    },
    feedback: { outcome, retention: outcome === 'worked' ? 'keep' : 'remove' },
    sharing: { transcript: 'none', noteIncluded: false },
  }
}

function service(repository = new MemoryRepository()) {
  return new FeedbackService(repository, {
    privacyHashSecret: 'privacy-secret-long-enough',
    followSecret: 'follow-secret-long-enough',
    publicBaseUrl: 'https://feedback.example.test',
    githubThreshold: 3,
  })
}

describe('feedback flywheel service', () => {
  it('is idempotent and returns a followable receipt without storing transcript content', async () => {
    const api = service()
    const input = event()
    const first = await api.ingest(input)
    const second = await api.ingest(input)
    expect(second.receiptId).toBe(first.receiptId)
    expect(first.followToken).toBeTruthy()
    await expect(api.follow(first.receiptId, first.followToken ?? '')).resolves.toMatchObject({ status: 'received' })
    await expect(api.follow(first.receiptId, 'wrong')).resolves.toBeUndefined()
  })

  it('counts independent installations, releases a fix, and closes the loop through a retest', async () => {
    const repository = new MemoryRepository()
    const api = service(repository)
    const first = await api.ingest(event())
    const second = await api.ingest(event())
    expect(second.similarReports).toBe(2)
    expect(second.status).toBe('clustered')
    const original = await repository.receipt(first.receiptId)
    if (original === undefined) throw new Error('missing receipt')
    await api.release(original.cluster.id, { recommendedVersion: '1.0.1', message: '修复已发布，请复测。' })
    const invitation = await api.follow(first.receiptId, first.followToken ?? '')
    expect(invitation).toMatchObject({ status: 'retest-requested', recommendedVersion: '1.0.1' })
    const retest = event(crypto.randomUUID(), crypto.randomUUID(), 'worked')
    retest.trial.retestOfReceiptId = first.receiptId
    retest.signals.toolErrors = 0
    await api.ingest(retest)
    await expect(api.follow(first.receiptId, first.followToken ?? '')).resolves.toMatchObject({ status: 'verified' })
  })

  it('uses task, version, DSH version and symptom in the cluster fingerprint', () => {
    const accepted = {
      eventId: crypto.randomUUID(), participantId: crypto.randomUUID(), occurredAt: 1, trialId: 'trial',
      pluginModule: 'plugin', pluginVersion: '1', taskId: 'search', dshVersion: 'dsh',
      outcome: 'failed' as const, retention: 'remove' as const, loaderHealth: 'active',
      assistantMessages: 1, toolErrors: 1, agentErrors: 0, durationMs: 1,
    }
    expect(clusterKey({ ...accepted, taskId: 'other' })).not.toBe(clusterKey(accepted))
  })
})
