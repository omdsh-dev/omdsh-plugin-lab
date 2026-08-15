import type {
  AcceptedEvent, ClusterRecord, ExperienceRepository, Ingested, PluginEvidence, ReleaseUpdate, StoredReceipt,
} from './types.js'

export class MemoryRepository implements ExperienceRepository {
  private readonly clusters = new Map<string, ClusterRecord>()
  private readonly events = new Map<string, {
    event: AcceptedEvent
    receiptId: string
    clusterKey: string
    createdAt: number
  }>()
  private readonly receipts = new Map<string, string>()

  async ingest(event: AcceptedEvent, key: string, symptom: string): Promise<Ingested> {
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
        id: crypto.randomUUID(),
        clusterKey: key,
        pluginModule: event.pluginModule,
        ...event.pluginVersion === undefined ? {} : { pluginVersion: event.pluginVersion },
        health: event.health,
        experience: event.experience,
        symptom,
        status: 'received',
        similarReports: 0,
        updatedAt: now,
      }
    }
    const receiptId = crypto.randomUUID()
    this.events.set(event.eventId, { event, receiptId, clusterKey: key, createdAt: now })
    this.receipts.set(receiptId, event.eventId)
    const reports = [...this.events.values()].filter(row => row.clusterKey === key).length
    cluster = {
      ...cluster,
      similarReports: reports,
      status: cluster.status === 'received' && reports > 1 ? 'clustered' : cluster.status,
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
      ...cluster,
      status: 'retest-requested',
      recommendedVersion: update.recommendedVersion,
      ...update.trackingUrl === undefined ? {} : { githubIssueUrl: update.trackingUrl },
      updatedAt: Date.now(),
    }
    this.clusters.set(next.clusterKey, next)
    return next
  }

  async evidence(pluginModule: string, since: number): Promise<PluginEvidence> {
    const rows = [...this.events.values()]
      .filter(row => row.event.pluginModule === pluginModule && row.createdAt >= since)
    const events = rows.map(row => row.event)
    return {
      pluginModule,
      windowDays: 30,
      total: events.length,
      good: events.filter(event => event.experience === 'good').length,
      mixed: events.filter(event => event.experience === 'mixed').length,
      bad: events.filter(event => event.experience === 'bad').length,
      ...events.length === 0 ? {} : { updatedAt: Math.max(...rows.map(row => row.createdAt)) },
    }
  }

  async verifyRetest(receiptId: string, successful: boolean): Promise<ClusterRecord | undefined> {
    const original = await this.receipt(receiptId)
    if (original === undefined) return undefined
    const next: ClusterRecord = {
      ...original.cluster,
      status: successful ? 'verified' : 'confirmed',
      updatedAt: Date.now(),
    }
    this.clusters.set(next.clusterKey, next)
    return next
  }
}
