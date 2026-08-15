/** Public, versioned protocol shared by the DSH plugin and an ingest backend. */

export const EXPERIENCE_SCHEMA_VERSION = 1 as const

export type TrialOutcome = 'worked' | 'partial' | 'failed'
export type RetentionIntent = 'keep' | 'unsure' | 'remove'
export type LoaderHealth =
  | 'active'
  | 'disabled'
  | 'failed'
  | 'loading'
  | 'missing'
  | 'pending'
  | 'unloading'
  | 'unknown'

export interface TrialPluginRef {
  readonly moduleName: string
  readonly version?: string
}

/** Privacy-preserving process crash evidence; no raw message, stack, or absolute path. */
export interface RuntimeCrashSignal {
  readonly fingerprint: string
  readonly name: string
  readonly origin: 'uncaughtException' | 'unhandledRejection'
  readonly code?: string
  readonly frame?: string
}

/** Synchronously persisted local crash journal entry. It is merged into a Trial after restart. */
export interface LocalCrashRecord {
  readonly crashId: string
  readonly trialId: string
  readonly occurredAt: number
  readonly crash: RuntimeCrashSignal
}

export interface TrialMetrics {
  readonly assistantMessages: number
  readonly turnsStarted: number
  readonly turnsCompleted: number
  readonly toolCalls: number
  readonly toolErrors: number
  readonly agentErrors: number
  readonly processCrashes: number
  readonly crashes?: readonly RuntimeCrashSignal[]
  readonly firstReplyMs?: number
  readonly lastTurnReason?: string
}

export interface ExperienceEventV1 {
  readonly schemaVersion: typeof EXPERIENCE_SCHEMA_VERSION
  readonly type: 'feedback.submitted'
  readonly eventId: string
  readonly occurredAt: number
  /** Random identity scoped only to this plugin's data directory. */
  readonly participantId: string
  readonly trial: {
    readonly id: string
    readonly plugin: TrialPluginRef
    readonly taskId?: string
    readonly startedAt: number
    readonly durationMs: number
    /** Receipt that invited this run, when the user is verifying a fix. */
    readonly retestOfReceiptId?: string
  }
  readonly environment: {
    readonly dshVersion: string
    readonly nodeVersion: string
    readonly platform: string
    readonly arch: string
    readonly locale: string
    readonly profileLabel: string
  }
  readonly signals: TrialMetrics & {
    readonly loaderHealth: LoaderHealth
  }
  readonly feedback: {
    readonly outcome: TrialOutcome
    readonly retention: RetentionIntent
    readonly note?: string
  }
  readonly sharing: {
    readonly transcript: 'none'
    readonly noteIncluded: boolean
  }
}

export interface LocalExperienceRecord {
  readonly event: ExperienceEventV1
  readonly requestedShare: boolean
  readonly shareNote: boolean
}

export interface IngestReceipt {
  readonly eventId: string
  readonly receivedAt: number
  readonly receiptId?: string
  readonly status?: ReceiptStatus
  readonly similarReports?: number
  readonly message?: string
  readonly recommendedVersion?: string
  readonly trackingUrl?: string
  readonly caseId?: string
  /** Random bearer secret. It stays in the local private receipt store. */
  readonly followToken?: string
  readonly updatesUrl?: string
  readonly updatedAt?: number
}

export type ReceiptStatus =
  | 'received'
  | 'clustered'
  | 'confirmed'
  | 'reported'
  | 'fix-released'
  | 'retest-requested'
  | 'verified'
  | 'closed'

export interface ShareRequest {
  readonly eventId: string
  readonly requestedAt: number
  readonly shareNote: boolean
}

export interface ReceiptSeen {
  readonly receiptId: string
  readonly status?: ReceiptStatus
  readonly updatedAt?: number
  readonly seenAt: number
}

/** Remove the local-only note unless the user explicitly chose --share-note. */
export function uploadPayload(record: LocalExperienceRecord): ExperienceEventV1 {
  if (record.shareNote || record.event.feedback.note === undefined) return record.event
  const { note: _localOnlyNote, ...feedback } = record.event.feedback
  return {
    ...record.event,
    feedback,
    sharing: { transcript: 'none', noteIncluded: false },
  }
}
