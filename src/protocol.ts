/** Closed, zero-content protocol shared by the DSH plugin and ingest backend. */

export const FEEDBACK_SCHEMA_VERSION = 2 as const

export type HealthStatus = 'ok' | 'unavailable' | 'error' | 'unknown'
export type ExperienceVerdict = 'good' | 'mixed' | 'bad'

export interface TrialPluginRef {
  /** Public DSH marketplace/package identifier; never a local path or user label. */
  readonly moduleName: string
  readonly version?: string
}

/** The only value exposed to the Agent-facing analysis tool. */
export interface SafeExperienceAssessment {
  readonly health: HealthStatus
  readonly experience: 'unknown'
  readonly userConfirmationRequired: true
}

/**
 * Exact upload envelope. It intentionally contains no timestamp, stable user or
 * install identifier, task/session identifier, metrics, notes, error or log data.
 */
export interface FeedbackEventV2 {
  readonly schemaVersion: typeof FEEDBACK_SCHEMA_VERSION
  readonly type: 'feedback.signal'
  /** Random per-report id used only for idempotency. */
  readonly eventId: string
  readonly plugin: TrialPluginRef
  readonly health: HealthStatus
  readonly experience: ExperienceVerdict
  readonly source: 'user_confirmed'
  /** Optional, report-scoped link used only when the user explicitly starts a retest. */
  readonly retestOfReceiptId?: string
}

export interface LocalFeedbackRecord {
  readonly event: FeedbackEventV2
  readonly requestedShare: boolean
}

export type ReceiptStatus =
  | 'received'
  | 'clustered'
  | 'reported'
  | 'fix-released'
  | 'retest-requested'
  | 'verified'
  | 'confirmed'
  | 'closed'

export interface IngestReceipt {
  readonly eventId: string
  readonly receiptId?: string
  readonly caseId?: string
  readonly status?: ReceiptStatus
  readonly similarReports?: number
  readonly recommendedVersion?: string
  readonly trackingUrl?: string
  /** Random per-report bearer secret; it stays in the local receipt store. */
  readonly followToken?: string
  readonly updatesUrl?: string
  readonly updatedAt?: number
}

export interface ShareRequest {
  readonly eventId: string
}

export interface ReceiptSeen {
  readonly receiptId: string
  readonly status?: ReceiptStatus
  readonly updatedAt?: number
}

/** The local record is already the exact network packet; no projection can add fields. */
export function uploadPayload(record: LocalFeedbackRecord): FeedbackEventV2 {
  return record.event
}
