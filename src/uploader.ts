import type { IngestReceipt, LocalFeedbackRecord, ReceiptStatus } from './protocol.js'
import { uploadPayload } from './protocol.js'
import type { FeedbackStore } from './storage.js'

export interface UploaderConfig {
  readonly ingestUrl: string
  readonly authorizationEnv: string
  readonly requestTimeoutMs: number
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function parseReceipt(eventId: string, value: unknown): IngestReceipt {
  const row = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const receiptId = optionalString(row.receiptId)
  const recommendedVersion = optionalString(row.recommendedVersion)
  const trackingUrl = optionalString(row.trackingUrl)
  const caseId = optionalString(row.caseId)
  const followToken = optionalString(row.followToken)
  const updatesUrl = optionalString(row.updatesUrl)
  const similarReports = typeof row.similarReports === 'number'
    && Number.isSafeInteger(row.similarReports) && row.similarReports >= 0
    ? row.similarReports
    : undefined
  const statuses = new Set<ReceiptStatus>([
    'received', 'clustered', 'confirmed', 'reported', 'fix-released',
    'retest-requested', 'verified', 'closed',
  ])
  const status = statuses.has(row.status as ReceiptStatus) ? row.status as ReceiptStatus : undefined
  const updatedAt = typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt)
    ? row.updatedAt
    : undefined
  return {
    eventId,
    ...receiptId === undefined ? {} : { receiptId },
    ...status === undefined ? {} : { status },
    ...similarReports === undefined ? {} : { similarReports },
    ...recommendedVersion === undefined ? {} : { recommendedVersion },
    ...trackingUrl === undefined ? {} : { trackingUrl },
    ...caseId === undefined ? {} : { caseId },
    ...followToken === undefined ? {} : { followToken },
    ...updatesUrl === undefined ? {} : { updatesUrl },
    ...updatedAt === undefined ? {} : { updatedAt },
  }
}

export class ExperienceUploader {
  constructor(
    private readonly store: FeedbackStore,
    private readonly config: UploaderConfig,
  ) {}

  async flushPending(targetEventId?: string): Promise<Map<string, IngestReceipt>> {
    const delivered = new Map<string, IngestReceipt>()
    for (const record of this.store.pending()) {
      if (targetEventId !== undefined && record.event.eventId !== targetEventId) continue
      const receipt = await this.send(record)
      this.store.appendReceipt(receipt)
      delivered.set(record.event.eventId, receipt)
    }
    return delivered
  }

  async refreshReceipts(): Promise<IngestReceipt[]> {
    const changed: IngestReceipt[] = []
    for (const previous of this.store.latestReceipts()) {
      if (previous.followToken === undefined || previous.updatesUrl === undefined) continue
      const response = await fetch(previous.updatesUrl, {
        headers: { 'x-omdsh-follow-token': previous.followToken },
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      })
      if (!response.ok) {
        if (response.status === 404 || response.status === 410) continue
        throw new Error(`receipt refresh returned HTTP ${response.status}`)
      }
      const next = parseReceipt(previous.eventId, await response.json())
      const merged: IngestReceipt = {
        ...previous,
        ...next,
        followToken: previous.followToken,
        updatesUrl: previous.updatesUrl,
      }
      if (merged.status !== previous.status
        || merged.updatedAt !== previous.updatedAt
        || merged.recommendedVersion !== previous.recommendedVersion) {
        this.store.appendReceipt(merged)
        changed.push(merged)
      }
    }
    return changed
  }

  private async send(record: LocalFeedbackRecord): Promise<IngestReceipt> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'idempotency-key': record.event.eventId,
      'x-omdsh-schema-version': String(record.event.schemaVersion),
    }
    const token = process.env[this.config.authorizationEnv]
    if (token !== undefined && token.length > 0) headers.authorization = `Bearer ${token}`
    const response = await fetch(this.config.ingestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(uploadPayload(record)),
      signal: AbortSignal.timeout(this.config.requestTimeoutMs),
    })
    if (!response.ok) {
      throw new Error('feedback service did not accept the closed packet')
    }
    const contentType = response.headers.get('content-type') ?? ''
    const body: unknown = contentType.includes('application/json') ? await response.json() : undefined
    return parseReceipt(record.event.eventId, body)
  }
}
