import type {
  AcceptedEvent, ClusterRecord, ExperienceRepository, Ingested, PluginEvidence, ReleaseUpdate, StoredReceipt,
} from './types.js'

export class MemoryRepository implements ExperienceRepository {
  private readonly clusters = new Map<string, ClusterRecord>()
  private readonly events = new Map<string, { event: AcceptedEvent; participantHash: string; receiptId: string; clusterKey: string }>()
  private readonly receipts = new Map<string, string>()

  async ingest(event: AcceptedEvent, participantHash: string, key: string, symptom: string): Promise<Ingested> {
    const existing = this.events.get(event.eventId)
    if (existing !== undefined) {
      const receipt = await this.receipt(existing.receiptId)
      if (receipt === undefined) throw new Error('memory repository invariant failed')
      return { receipt, created: false }
    }
    const now = Date.now()
    let cluster = this.clusters.get(key)
    if (cluster === undefined) {
      cluster = {
        id: crypto.randomUUID(), clusterKey: key, pluginModule: event.pluginModule,
        ...event.pluginVersion === undefined ? {} : { pluginVersion: event.pluginVersion },
        ...event.taskId === undefined ? {} : { taskId: event.taskId },
        symptom, status: 'received', similarReports: 0, updatedAt: now,
      }
    }
    const receiptId = crypto.randomUUID()
    this.events.set(event.eventId, { event, participantHash, receiptId, clusterKey: key })
    this.receipts.set(receiptId, event.eventId)
    const reporters = new Set([...this.events.values()]
      .filter(row => row.clusterKey === key)
      .map(row => row.participantHash))
    cluster = {
      ...cluster,
      similarReports: reporters.size,
      status: cluster.status === 'received' && reporters.size > 1 ? 'clustered' : cluster.status,
      updatedAt: now,
    }
    this.clusters.set(key, cluster)
    return { receipt: { receiptId, eventId: event.eventId, cluster }, created: true }
  }

  async receipt(receiptId: string): Promise<StoredReceipt | undefined> {
    const eventId = this.receipts.get(receiptId)
    if (eventId === undefined) return undefined
    const stored = this.events.get(eventId)
    if (stored === undefined) return undefined
    const cluster = this.clusters.get(stored.clusterKey)
    return cluster === undefined ? undefined : { receiptId, eventId, cluster }
  }

  async markReported(clusterId: string, issueUrl: string): Promise<ClusterRecord> {
    const cluster = [...this.clusters.values()].find(row => row.id === clusterId)
    if (cluster === undefined) throw new Error('cluster not found')
    const next: ClusterRecord = { ...cluster, status: 'reported', githubIssueUrl: issueUrl, updatedAt: Date.now() }
    this.clusters.set(next.clusterKey, next)
    return next
  }

  async release(clusterId: string, update: ReleaseUpdate): Promise<ClusterRecord | undefined> {
    const cluster = [...this.clusters.values()].find(row => row.id === clusterId)
    if (cluster === undefined) return undefined
    const next: ClusterRecord = {
      ...cluster, status: 'retest-requested', recommendedVersion: update.recommendedVersion,
      message: update.message, ...update.trackingUrl === undefined ? {} : { githubIssueUrl: update.trackingUrl },
      updatedAt: Date.now(),
    }
    this.clusters.set(next.clusterKey, next)
    return next
  }

  async evidence(pluginModule: string, since: number): Promise<PluginEvidence> {
    const events = [...this.events.values()].map(row => row.event)
      .filter(event => event.pluginModule === pluginModule && event.occurredAt >= since)
    return {
      pluginModule, windowDays: 30, total: events.length,
      worked: events.filter(event => event.outcome === 'worked').length,
      partial: events.filter(event => event.outcome === 'partial').length,
      failed: events.filter(event => event.outcome === 'failed').length,
      ...events.length === 0 ? {} : { updatedAt: Math.max(...events.map(event => event.occurredAt)) },
    }
  }

  async verifyRetest(receiptId: string, worked: boolean): Promise<ClusterRecord | undefined> {
    const original = await this.receipt(receiptId)
    if (original === undefined) return undefined
    const next: ClusterRecord = {
      ...original.cluster,
      status: worked ? 'verified' : 'confirmed',
      message: worked ? '已有用户使用原任务确认修复。' : '复测仍未通过，问题已重新确认。',
      updatedAt: Date.now(),
    }
    this.clusters.set(next.clusterKey, next)
    return next
  }
}
