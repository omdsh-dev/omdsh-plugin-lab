export type Outcome = 'worked' | 'partial' | 'failed'
export type ClusterStatus =
  | 'received'
  | 'clustered'
  | 'confirmed'
  | 'reported'
  | 'fix-released'
  | 'retest-requested'
  | 'verified'
  | 'closed'

export interface RuntimeCrashSignal {
  readonly fingerprint: string
  readonly name: string
  readonly origin: 'uncaughtException' | 'unhandledRejection'
  readonly code?: string
  readonly frame?: string
}

export interface AcceptedEvent {
  readonly eventId: string
  readonly participantId: string
  readonly occurredAt: number
  readonly trialId: string
  readonly pluginModule: string
  readonly pluginVersion?: string
  readonly taskId?: string
  readonly retestOfReceiptId?: string
  readonly dshVersion: string
  readonly outcome: Outcome
  readonly retention: 'keep' | 'unsure' | 'remove'
  readonly loaderHealth: string
  readonly assistantMessages: number
  readonly toolErrors: number
  readonly agentErrors: number
  readonly processCrashes: number
  readonly crashes: readonly RuntimeCrashSignal[]
  readonly durationMs: number
  readonly firstReplyMs?: number
  readonly note?: string
}

export interface ClusterRecord {
  readonly id: string
  readonly clusterKey: string
  readonly pluginModule: string
  readonly pluginVersion?: string
  readonly taskId?: string
  readonly symptom: string
  readonly status: ClusterStatus
  readonly similarReports: number
  readonly githubIssueUrl?: string
  readonly recommendedVersion?: string
  readonly message?: string
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
  readonly message: string
  readonly trackingUrl?: string
}

export interface PluginEvidence {
  readonly pluginModule: string
  readonly windowDays: number
  readonly total: number
  readonly worked: number
  readonly partial: number
  readonly failed: number
  readonly latestVerifiedVersion?: string
  readonly updatedAt?: number
}

export interface ExperienceRepository {
  ingest(event: AcceptedEvent, participantHash: string, clusterKey: string, symptom: string): Promise<Ingested>
  receipt(receiptId: string): Promise<StoredReceipt | undefined>
  markReported(clusterId: string, issueUrl: string): Promise<ClusterRecord>
  release(clusterId: string, update: ReleaseUpdate): Promise<ClusterRecord | undefined>
  verifyRetest(receiptId: string, worked: boolean): Promise<ClusterRecord | undefined>
  evidence(pluginModule: string, since: number): Promise<PluginEvidence>
}
