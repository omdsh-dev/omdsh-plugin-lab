import { timingSafeEqual } from 'node:crypto'
import { acceptEvent } from './validation.js'
import { clusterKey, followToken, symptomFor } from './fingerprint.js'
import type { IssuePublisher } from './github.js'
import type {
  ClusterRecord, ExperienceRepository, PluginEvidence, ReleaseUpdate, StoredReceipt,
} from './types.js'

export interface ServiceConfig {
  readonly followSecret: string
  readonly publicBaseUrl: string
  readonly githubThreshold: number
}

export interface ReceiptResponse {
  readonly receiptId: string
  readonly caseId: string
  readonly eventId: string
  readonly status: ClusterRecord['status']
  readonly similarReports: number
  readonly recommendedVersion?: string
  readonly trackingUrl?: string
  readonly followToken?: string
  readonly updatesUrl: string
  readonly updatedAt: number
}

export class FeedbackService {
  constructor(
    private readonly repository: ExperienceRepository,
    private readonly config: ServiceConfig,
    private readonly publisher?: IssuePublisher,
  ) {}

  async ingest(value: unknown): Promise<ReceiptResponse> {
    const event = acceptEvent(value)
    const accepted = await this.repository.ingest(
      event,
      clusterKey(event),
      symptomFor(event),
    )
    let receipt = accepted.receipt
    if (event.retestOfReceiptId !== undefined) {
      await this.repository.verifyRetest(event.retestOfReceiptId, event.experience === 'good')
    }
    const cluster = receipt.cluster
    const actionable = cluster.symptom !== 'experience-good'
      && cluster.similarReports >= this.config.githubThreshold
      && cluster.githubIssueUrl === undefined
    if (actionable && this.publisher !== undefined) {
      try {
        const issueUrl = await this.publisher.publish(cluster)
        receipt = { ...receipt, cluster: await this.repository.markReported(cluster.id, issueUrl) }
      } catch {
        // The user's feedback remains accepted. A later event or operator retry
        // can publish the aggregate without making ingestion unreliable.
      }
    }
    return this.response(receipt, true)
  }

  async follow(receiptId: string, token: string): Promise<ReceiptResponse | undefined> {
    const receipt = await this.repository.receipt(receiptId)
    if (receipt === undefined) return undefined
    const expected = followToken(this.config.followSecret, receipt.eventId)
    if (!safeEqual(expected, token)) return undefined
    return this.response(receipt, false)
  }

  async release(clusterId: string, update: ReleaseUpdate): Promise<ClusterRecord | undefined> {
    if (update.recommendedVersion.trim().length === 0 || update.recommendedVersion.length > 64) {
      throw new TypeError('recommendedVersion is required')
    }
    return await this.repository.release(clusterId, update)
  }

  async evidence(pluginModule: string): Promise<PluginEvidence> {
    if (pluginModule.length === 0 || pluginModule.length > 214) throw new TypeError('invalid plugin module')
    return await this.repository.evidence(pluginModule, Date.now() - 30 * 24 * 60 * 60 * 1_000)
  }

  private response(receipt: StoredReceipt, includeToken: boolean): ReceiptResponse {
    const cluster = receipt.cluster
    return {
      receiptId: receipt.receiptId,
      caseId: `PL-${cluster.id.slice(0, 8).toUpperCase()}`,
      eventId: receipt.eventId,
      status: cluster.status,
      similarReports: cluster.similarReports,
      ...cluster.recommendedVersion === undefined ? {} : { recommendedVersion: cluster.recommendedVersion },
      ...cluster.githubIssueUrl === undefined ? {} : { trackingUrl: cluster.githubIssueUrl },
      ...includeToken ? { followToken: followToken(this.config.followSecret, receipt.eventId) } : {},
      updatesUrl: `${this.config.publicBaseUrl.replace(/\/$/u, '')}/v1/receipts/${receipt.receiptId}`,
      updatedAt: cluster.updatedAt,
    }
  }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
