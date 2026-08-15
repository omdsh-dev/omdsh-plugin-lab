import type { Pool, PoolClient, QueryResultRow } from 'pg'
import type {
  AcceptedEvent, ClusterRecord, ClusterStatus, ExperienceRepository, Ingested, PluginEvidence,
  ReleaseUpdate, StoredReceipt,
} from './types.js'

interface ClusterRow extends QueryResultRow {
  id: string
  cluster_key: string
  plugin_module: string
  plugin_version: string | null
  task_id: string | null
  symptom: string
  status: ClusterStatus
  similar_reports: number
  github_issue_url: string | null
  recommended_version: string | null
  message: string | null
  updated_at: string
}

function cluster(row: ClusterRow): ClusterRecord {
  return {
    id: row.id,
    clusterKey: row.cluster_key,
    pluginModule: row.plugin_module,
    ...row.plugin_version === null ? {} : { pluginVersion: row.plugin_version },
    ...row.task_id === null ? {} : { taskId: row.task_id },
    symptom: row.symptom,
    status: row.status,
    similarReports: row.similar_reports,
    ...row.github_issue_url === null ? {} : { githubIssueUrl: row.github_issue_url },
    ...row.recommended_version === null ? {} : { recommendedVersion: row.recommended_version },
    ...row.message === null ? {} : { message: row.message },
    updatedAt: Number(row.updated_at),
  }
}

export class PostgresRepository implements ExperienceRepository {
  constructor(private readonly pool: Pool) {}

  async ingest(event: AcceptedEvent, participantHash: string, key: string, symptom: string): Promise<Ingested> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await this.receiptForEvent(client, event.eventId)
      if (existing !== undefined) {
        await client.query('COMMIT')
        return { receipt: existing, created: false }
      }
      const now = Date.now()
      await client.query(
        'UPDATE experience_events SET note = NULL, note_expires_at = NULL WHERE note_expires_at < $1',
        [now],
      )
      const clusterId = crypto.randomUUID()
      await client.query(
        `INSERT INTO issue_clusters
          (id, cluster_key, plugin_module, plugin_version, task_id, symptom, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'received', $7)
         ON CONFLICT (cluster_key) DO NOTHING`,
        [clusterId, key, event.pluginModule, event.pluginVersion ?? null, event.taskId ?? null, symptom, now],
      )
      const inserted = await client.query(
        `INSERT INTO experience_events
          (event_id, participant_hash, trial_id, plugin_module, plugin_version, task_id,
           retest_of_receipt_id, dsh_version, outcome, retention, loader_health,
           assistant_messages, tool_errors, agent_errors, process_crashes, crash_signatures,
           duration_ms, first_reply_ms,
           note, note_expires_at, cluster_key, occurred_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING event_id`,
        [
          event.eventId, participantHash, event.trialId, event.pluginModule, event.pluginVersion ?? null,
          event.taskId ?? null, event.retestOfReceiptId ?? null, event.dshVersion, event.outcome,
          event.retention, event.loaderHealth, event.assistantMessages, event.toolErrors,
          event.agentErrors, event.processCrashes, JSON.stringify(event.crashes),
          event.durationMs, event.firstReplyMs ?? null, event.note ?? null,
          event.note === undefined ? null : now + 30 * 24 * 60 * 60 * 1_000,
          key, event.occurredAt, now,
        ],
      )
      if (inserted.rowCount === 0) {
        const raced = await this.receiptForEvent(client, event.eventId)
        if (raced === undefined) throw new Error('idempotent event exists without receipt')
        await client.query('COMMIT')
        return { receipt: raced, created: false }
      }
      const receiptId = crypto.randomUUID()
      await client.query(
        'INSERT INTO follow_receipts (receipt_id, event_id, created_at) VALUES ($1, $2, $3)',
        [receiptId, event.eventId, now],
      )
      const count = await client.query<{ count: string }>(
        'SELECT COUNT(DISTINCT participant_hash)::text AS count FROM experience_events WHERE cluster_key = $1',
        [key],
      )
      const reporters = Number(count.rows[0]?.count ?? 1)
      const updated = await client.query<ClusterRow>(
        `UPDATE issue_clusters SET
           similar_reports = $2,
           status = CASE WHEN status = 'received' AND $2 > 1 THEN 'clustered' ELSE status END,
           updated_at = $3
         WHERE cluster_key = $1 RETURNING *`,
        [key, reporters, now],
      )
      const row = updated.rows[0]
      if (row === undefined) throw new Error('cluster disappeared during ingest')
      await client.query('COMMIT')
      return { receipt: { receiptId, eventId: event.eventId, cluster: cluster(row) }, created: true }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async receipt(receiptId: string): Promise<StoredReceipt | undefined> {
    const result = await this.pool.query<ClusterRow & { event_id: string; receipt_id: string }>(
      `SELECT c.*, r.event_id, r.receipt_id
       FROM follow_receipts r
       JOIN experience_events e ON e.event_id = r.event_id
       JOIN issue_clusters c ON c.cluster_key = e.cluster_key
       WHERE r.receipt_id = $1`,
      [receiptId],
    )
    const row = result.rows[0]
    return row === undefined ? undefined : { receiptId: row.receipt_id, eventId: row.event_id, cluster: cluster(row) }
  }

  async markReported(clusterId: string, issueUrl: string): Promise<ClusterRecord> {
    const result = await this.pool.query<ClusterRow>(
      `UPDATE issue_clusters SET status = 'reported', github_issue_url = $2, updated_at = $3
       WHERE id = $1 RETURNING *`,
      [clusterId, issueUrl, Date.now()],
    )
    const row = result.rows[0]
    if (row === undefined) throw new Error('cluster not found')
    return cluster(row)
  }

  async release(clusterId: string, update: ReleaseUpdate): Promise<ClusterRecord | undefined> {
    const result = await this.pool.query<ClusterRow>(
      `UPDATE issue_clusters SET status = 'retest-requested', recommended_version = $2,
         message = $3, github_issue_url = COALESCE($4, github_issue_url), updated_at = $5
       WHERE id = $1 RETURNING *`,
      [clusterId, update.recommendedVersion, update.message, update.trackingUrl ?? null, Date.now()],
    )
    const row = result.rows[0]
    return row === undefined ? undefined : cluster(row)
  }

  async evidence(pluginModule: string, since: number): Promise<PluginEvidence> {
    const result = await this.pool.query<{
      total: string; worked: string; partial: string; failed: string; updated_at: string | null; version: string | null
    }>(
      `SELECT COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE outcome = 'worked')::text AS worked,
         COUNT(*) FILTER (WHERE outcome = 'partial')::text AS partial,
         COUNT(*) FILTER (WHERE outcome = 'failed')::text AS failed,
         MAX(occurred_at)::text AS updated_at,
         MAX(plugin_version) FILTER (WHERE outcome = 'worked') AS version
       FROM experience_events WHERE plugin_module = $1 AND occurred_at >= $2`,
      [pluginModule, since],
    )
    const row = result.rows[0]
    return {
      pluginModule, windowDays: 30, total: Number(row?.total ?? 0), worked: Number(row?.worked ?? 0),
      partial: Number(row?.partial ?? 0), failed: Number(row?.failed ?? 0),
      ...row?.version == null ? {} : { latestVerifiedVersion: row.version },
      ...row?.updated_at == null ? {} : { updatedAt: Number(row.updated_at) },
    }
  }

  async verifyRetest(receiptId: string, worked: boolean): Promise<ClusterRecord | undefined> {
    const result = await this.pool.query<ClusterRow>(
      `UPDATE issue_clusters SET status = $2, message = $3, updated_at = $4
       WHERE cluster_key = (
         SELECT e.cluster_key FROM follow_receipts r
         JOIN experience_events e ON e.event_id = r.event_id
         WHERE r.receipt_id = $1
       )
       RETURNING *`,
      [
        receiptId,
        worked ? 'verified' : 'confirmed',
        worked ? '已有用户使用原任务确认修复。' : '复测仍未通过，问题已重新确认。',
        Date.now(),
      ],
    )
    const row = result.rows[0]
    return row === undefined ? undefined : cluster(row)
  }

  private async receiptForEvent(client: PoolClient, eventId: string): Promise<StoredReceipt | undefined> {
    const result = await client.query<ClusterRow & { event_id: string; receipt_id: string }>(
      `SELECT c.*, r.event_id, r.receipt_id
       FROM follow_receipts r
       JOIN experience_events e ON e.event_id = r.event_id
       JOIN issue_clusters c ON c.cluster_key = e.cluster_key
       WHERE r.event_id = $1`,
      [eventId],
    )
    const row = result.rows[0]
    return row === undefined ? undefined : { receiptId: row.receipt_id, eventId: row.event_id, cluster: cluster(row) }
  }
}
