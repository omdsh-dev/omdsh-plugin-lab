export type HealthStatus = 'ok' | 'unavailable' | 'error' | 'unknown'
export type ExperienceVerdict = 'good' | 'mixed' | 'bad'
export type FeedbackCategory =
  | 'installation'
  | 'startup'
  | 'invocation'
  | 'compatibility'
  | 'reliability'
  | 'performance'
  | 'result_quality'
  | 'general'
export type ClusterStatus =
  | 'received'
  | 'clustered'
  | 'reported'
  | 'fix-released'
  | 'retest-requested'
  | 'verified'
  | 'confirmed'
  | 'closed'

/** Exact accepted v3 packet after fail-closed validation. */
export interface AcceptedEvent {
  readonly eventId: string
  readonly pluginModule: string
  readonly pluginVersion?: string
  readonly health: HealthStatus
  readonly experience: ExperienceVerdict
  readonly category: FeedbackCategory
  readonly source: 'user_confirmed'
  readonly retestOfReceiptId?: string
}

export interface ClusterRecord {
  readonly id: string
  readonly clusterKey: string
  readonly pluginModule: string
  readonly pluginVersion?: string
  readonly health: HealthStatus
  readonly experience: ExperienceVerdict
  readonly category: FeedbackCategory
  readonly symptom: string
  readonly status: ClusterStatus
  /** Number of reports, not unique users: strict v3 has no stable participant id. */
  readonly similarReports: number
  readonly githubIssueUrl?: string
  readonly recommendedVersion?: string
  readonly updatedAt: number
}

export interface StoredReceipt {
  readonly receiptId: string
  readonly eventId: string
  readonly cluster: ClusterRecord
}

export interface Ingested {
  readonly receipt: StoredReceipt
  readonly created: boolean
}

export interface ReleaseUpdate {
  readonly recommendedVersion: string
  readonly trackingUrl?: string
}

export interface PluginEvidence {
  readonly pluginModule: string
  readonly windowDays: number
  readonly total: number
  readonly good: number
  readonly mixed: number
  readonly bad: number
  readonly latestVerifiedVersion?: string
  readonly updatedAt?: number
}

export interface ExperienceRepository {
  ingest(event: AcceptedEvent, clusterKey: string, symptom: string): Promise<Ingested>
  receipt(receiptId: string): Promise<StoredReceipt | undefined>
  markReported(clusterId: string, issueUrl: string): Promise<ClusterRecord>
  release(clusterId: string, update: ReleaseUpdate): Promise<ClusterRecord | undefined>
  verifyRetest(receiptId: string, successful: boolean): Promise<ClusterRecord | undefined>
  evidence(pluginModule: string, since: number): Promise<PluginEvidence>
}
