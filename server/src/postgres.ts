import type { Pool, PoolClient, QueryResultRow } from 'pg'
import type {
  AcceptedEvent, ClusterRecord, ClusterStatus, ExperienceRepository, ExperienceVerdict, HealthStatus,
  Ingested, PluginEvidence, ReleaseUpdate, StoredReceipt,
} from './types.js'

interface ClusterRow extends QueryResultRow {
  id: string
  cluster_key: string
  plugin_module: string
  plugin_version: string | null
  health: HealthStatus
  experience: ExperienceVerdict
  symptom: string
  status: ClusterStatus
  report_count: number
  github_issue_url: string | null
  recommended_version: string | null
  updated_at: string
}

function cluster(row: ClusterRow): ClusterRecord {
  return {
    id: row.id,
    clusterKey: row.cluster_key,
    pluginModule: row.plugin_module,
    ...row.plugin_version === null ? {} : { pluginVersion: row.plugin_version },
    health: row.health,
    experience: row.experience,
    symptom: row.symptom,
    status: row.status,
    similarReports: row.report_count,
    ...row.github_issue_url === null ? {} : { githubIssueUrl: row.github_issue_url },
    ...row.recommended_version === null ? {} : { recommendedVersion: row.recommended_version },
    updatedAt: Number(row.updated_at),
  }
}

export class PostgresRepository implements ExperienceRepository {
  constructor(private readonly pool: Pool) {}

  async ingest(event: AcceptedEvent, key: string, symptom: string): Promise<Ingested> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await this.receiptForEvent(client, event.eventId)
      if (existing !== undefined) {
        await client.query('COMMIT')
        return { receipt: existing, created: false }
      }
      const now = Date.now()
      const clusterId = crypto.randomUUID()
      await client.query(
        `INSERT INTO feedback_clusters_v2
          (id, cluster_key, plugin_module, plugin_version, health, experience, symptom, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'received', $8)
         ON CONFLICT (cluster_key) DO NOTHING`,
        [clusterId, key, event.pluginModule, event.pluginVersion ?? null, event.health, event.experience, symptom, now],
      )
      const inserted = await client.query(
        `INSERT INTO feedback_events_v2
          (event_id, plugin_module, plugin_version, health, experience, source,
           retest_of_receipt_id, cluster_key, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING event_id`,
        [
          event.eventId, event.pluginModule, event.pluginVersion ?? null, event.health,
          event.experience, event.source, event.retestOfReceiptId ?? null, key, now,
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
        'INSERT INTO follow_receipts_v2 (receipt_id, event_id, created_at) VALUES ($1, $2, $3)',
        [receiptId, event.eventId, now],
      )
      const count = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM feedback_events_v2 WHERE cluster_key = $1',
        [key],
      )
      const reports = Number(count.rows[0]?.count ?? 1)
      const updated = await client.query<ClusterRow>(
        `UPDATE feedback_clusters_v2 SET
           report_count = $2,
           status = CASE WHEN status = 'received' AND $2 > 1 THEN 'clustered' ELSE status END,
           updated_at = $3
         WHERE cluster_key = $1 RETURNING *`,
        [key, reports, now],
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
       FROM follow_receipts_v2 r
       JOIN feedback_events_v2 e ON e.event_id = r.event_id
       JOIN feedback_clusters_v2 c ON c.cluster_key = e.cluster_key
       WHERE r.receipt_id = $1`,
      [receiptId],
    )
    const row = result.rows[0]
    return row === undefined ? undefined : { receiptId: row.receipt_id, eventId: row.event_id, cluster: cluster(row) }
  }

  async markReported(clusterId: string, issueUrl: string): Promise<ClusterRecord> {
    const result = await this.pool.query<ClusterRow>(
      `UPDATE feedback_clusters_v2 SET status = 'reported', github_issue_url = $2, updated_at = $3
       WHERE id = $1 RETURNING *`,
      [clusterId, issueUrl, Date.now()],
    )
    const row = result.rows[0]
    if (row === undefined) throw new Error('cluster not found')
    return cluster(row)
  }

  async release(clusterId: string, update: ReleaseUpdate): Promise<ClusterRecord | undefined> {
    const result = await this.pool.query<ClusterRow>(
      `UPDATE feedback_clusters_v2 SET status = 'retest-requested', recommended_version = $2,
         github_issue_url = COALESCE($3, github_issue_url), updated_at = $4
       WHERE id = $1 RETURNING *`,
      [clusterId, update.recommendedVersion, update.trackingUrl ?? null, Date.now()],
    )
    const row = result.rows[0]
    return row === undefined ? undefined : cluster(row)
  }

  async evidence(pluginModule: string, since: number): Promise<PluginEvidence> {
    const result = await this.pool.query<{
      total: string
      good: string
      mixed: string
      bad: string
      updated_at: string | null
      version: string | null
    }>(
      `SELECT COUNT(*)::text AS total,
         SUM(CASE WHEN experience = 'good' THEN 1 ELSE 0 END)::text AS good,
         SUM(CASE WHEN experience = 'mixed' THEN 1 ELSE 0 END)::text AS mixed,
         SUM(CASE WHEN experience = 'bad' THEN 1 ELSE 0 END)::text AS bad,
         MAX(created_at)::text AS updated_at,
         MAX(plugin_version) FILTER (WHERE experience = 'good') AS version
       FROM feedback_events_v2 WHERE plugin_module = $1 AND created_at >= $2`,
      [pluginModule, since],
    )
    const row = result.rows[0]
    return {
      pluginModule,
      windowDays: 30,
      total: Number(row?.total ?? 0),
      good: Number(row?.good ?? 0),
      mixed: Number(row?.mixed ?? 0),
      bad: Number(row?.bad ?? 0),
      ...row?.version == null ? {} : { latestVerifiedVersion: row.version },
      ...row?.updated_at == null ? {} : { updatedAt: Number(row.updated_at) },
    }
  }

  async verifyRetest(receiptId: string, successful: boolean): Promise<ClusterRecord | undefined> {
    const result = await this.pool.query<ClusterRow>(
      `UPDATE feedback_clusters_v2 SET status = $2, updated_at = $3
       WHERE cluster_key = (
         SELECT e.cluster_key FROM follow_receipts_v2 r
         JOIN feedback_events_v2 e ON e.event_id = r.event_id
         WHERE r.receipt_id = $1
       )
       RETURNING *`,
      [receiptId, successful ? 'verified' : 'confirmed', Date.now()],
    )
    const row = result.rows[0]
    return row === undefined ? undefined : cluster(row)
  }

  private async receiptForEvent(client: PoolClient, eventId: string): Promise<StoredReceipt | undefined> {
    const result = await client.query<ClusterRow & { event_id: string; receipt_id: string }>(
      `SELECT c.*, r.event_id, r.receipt_id
       FROM follow_receipts_v2 r
       JOIN feedback_events_v2 e ON e.event_id = r.event_id
       JOIN feedback_clusters_v2 c ON c.cluster_key = e.cluster_key
       WHERE r.event_id = $1`,
      [eventId],
    )
    const row = result.rows[0]
    return row === undefined ? undefined : { receiptId: row.receipt_id, eventId: row.event_id, cluster: cluster(row) }
  }
}
