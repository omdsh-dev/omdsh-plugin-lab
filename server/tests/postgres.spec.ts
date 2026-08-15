import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Pool as PgPool } from 'pg'
import { newDb } from 'pg-mem'
import { describe, expect, it } from 'vitest'
import { PostgresRepository } from '../src/postgres.js'
import type { AcceptedEvent } from '../src/types.js'

function accepted(eventId = crypto.randomUUID()): AcceptedEvent {
  return {
    eventId,
    pluginModule: '@example/search',
    pluginVersion: '1.0.0',
    health: 'error',
    experience: 'bad',
    category: 'reliability',
    source: 'user_confirmed',
  }
}

describe('PostgreSQL strict v3 repository', () => {
  it('persists only finite v3 category summaries and an idempotent receipt lifecycle', async () => {
    const database = newDb()
    for (const file of readdirSync(resolve('server/migrations')).filter(file => file.endsWith('.sql')).sort()) {
      database.public.none(readFileSync(resolve('server/migrations', file), 'utf8'))
    }
    const adapter = database.adapters.createPg()
    const pool = new adapter.Pool() as unknown as PgPool
    const repository = new PostgresRepository(pool)
    const event = accepted()
    const first = await repository.ingest(event, 'cluster-key', 'health-error')
    const duplicate = await repository.ingest(event, 'cluster-key', 'health-error')
    expect(duplicate.receipt.receiptId).toBe(first.receipt.receiptId)
    await repository.ingest(accepted(), 'cluster-key', 'health-error')
    await expect(repository.receipt(first.receipt.receiptId)).resolves.toMatchObject({
      cluster: {
        status: 'clustered', similarReports: 2, health: 'error',
        experience: 'bad', category: 'reliability',
      },
    })
    const released = await repository.release(first.receipt.cluster.id, { recommendedVersion: '1.0.1' })
    expect(released).toMatchObject({ status: 'retest-requested', recommendedVersion: '1.0.1' })
    await repository.verifyRetest(first.receipt.receiptId, true)
    await expect(repository.receipt(first.receipt.receiptId)).resolves.toMatchObject({
      cluster: { status: 'verified' },
    })
    await expect(repository.evidence('@example/search', 0)).resolves.toMatchObject({
      total: 2, good: 0, mixed: 0, bad: 2,
    })

    const columns = database.public.many(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'feedback_events_v3'
    `).map(row => row.column_name)
    expect(columns).not.toEqual(expect.arrayContaining([
      'participant_id', 'occurred_at', 'task_id', 'note', 'crash_signatures', 'environment',
    ]))
    await pool.end()
  })
})
