import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Pool as PgPool } from 'pg'
import { newDb } from 'pg-mem'
import { describe, expect, it } from 'vitest'
import { PostgresRepository } from '../src/postgres.js'
import type { AcceptedEvent } from '../src/types.js'

function accepted(eventId = crypto.randomUUID(), participant = 'participant'): AcceptedEvent {
  return {
    eventId, participantId: crypto.randomUUID(), occurredAt: Date.now(), trialId: crypto.randomUUID(),
    pluginModule: '@example/search', pluginVersion: '1.0.0', taskId: 'repo-search',
    dshVersion: '0.1.0-rc.6', outcome: 'failed', retention: 'remove', loaderHealth: 'active',
    assistantMessages: 1, toolErrors: 1, agentErrors: 0, durationMs: 100, note: participant,
  }
}

describe('PostgreSQL repository', () => {
  it('runs the migration and persists the idempotent receipt lifecycle', async () => {
    const database = newDb()
    database.public.none(readFileSync(resolve('server/migrations/001_initial.sql'), 'utf8'))
    const adapter = database.adapters.createPg()
    const pool = new adapter.Pool() as unknown as PgPool
    const repository = new PostgresRepository(pool)
    const event = accepted()
    const first = await repository.ingest(event, 'hash-a', 'cluster-key', 'tool-error')
    const duplicate = await repository.ingest(event, 'hash-a', 'cluster-key', 'tool-error')
    expect(duplicate.receipt.receiptId).toBe(first.receipt.receiptId)
    await repository.ingest(accepted(), 'hash-b', 'cluster-key', 'tool-error')
    await expect(repository.receipt(first.receipt.receiptId)).resolves.toMatchObject({
      cluster: { status: 'clustered', similarReports: 2 },
    })
    const released = await repository.release(first.receipt.cluster.id, {
      recommendedVersion: '1.0.1', message: '请复测。',
    })
    expect(released).toMatchObject({ status: 'retest-requested', recommendedVersion: '1.0.1' })
    await repository.verifyRetest(first.receipt.receiptId, true)
    await expect(repository.receipt(first.receipt.receiptId)).resolves.toMatchObject({
      cluster: { status: 'verified' },
    })
    await expect(repository.evidence('@example/search', 0)).resolves.toMatchObject({ total: 2, failed: 2 })
    await pool.end()
  })
})
