/** Closed, task-agnostic summary protocol shared by the DSH plugin and ingest backend. */
export declare const FEEDBACK_SCHEMA_VERSION: 3;
export type HealthStatus = 'ok' | 'unavailable' | 'error' | 'unknown';
export type ExperienceVerdict = 'good' | 'mixed' | 'bad';
export declare const FEEDBACK_CATEGORIES: readonly ["installation", "startup", "invocation", "compatibility", "reliability", "performance", "result_quality", "general"];
export type FeedbackCategory = typeof FEEDBACK_CATEGORIES[number];
/** Silent panel response; unlike slash commands, this is never appended to the Session. */
export interface PluginLabPanelProbe {
    readonly active: boolean;
    readonly health: HealthStatus;
    readonly text: string;
}
/** Closed panel action result with no free-text input or Session event side effect. */
export interface PluginLabPanelAction {
    readonly ok: boolean;
    readonly text: string;
}
export interface TrialPluginRef {
    /** Public DSH marketplace/package identifier; never a local path or user label. */
    readonly moduleName: string;
    readonly version?: string;
}
/** The only value exposed to the Agent-facing analysis tool. */
export interface SafeExperienceAssessment {
    readonly health: HealthStatus;
    readonly experience: 'unknown';
    readonly feedbackCategories: readonly FeedbackCategory[];
    readonly summaryIsTemplateOnly: true;
    readonly userConfirmationRequired: true;
}
/** Preview generated only from public plugin coordinates and finite enums. */
export interface FeedbackPreview {
    readonly plugin: TrialPluginRef;
    readonly health: HealthStatus;
    readonly experience: ExperienceVerdict;
    readonly category: FeedbackCategory;
    readonly summary: string;
    readonly willUpload: false;
    readonly userConfirmationRequired: true;
}
/**
 * Exact upload envelope. It intentionally contains no timestamp, stable user or
 * install identifier, task/session identifier, metrics, notes, error or log data.
 */
export interface FeedbackEventV3 {
    readonly schemaVersion: typeof FEEDBACK_SCHEMA_VERSION;
    readonly type: 'feedback.signal';
    /** Random per-report id used only for idempotency. */
    readonly eventId: string;
    readonly plugin: TrialPluginRef;
    readonly health: HealthStatus;
    readonly experience: ExperienceVerdict;
    /** Task-agnostic category selected from the closed vocabulary above. */
    readonly category: FeedbackCategory;
    readonly source: 'user_confirmed';
    /** Optional, report-scoped link used only when the user explicitly starts a retest. */
    readonly retestOfReceiptId?: string;
}
export interface LocalFeedbackRecord {
    readonly event: FeedbackEventV3;
    readonly requestedShare: boolean;
}
export type ReceiptStatus = 'received' | 'clustered' | 'reported' | 'fix-released' | 'retest-requested' | 'verified' | 'confirmed' | 'closed';
export interface IngestReceipt {
    readonly eventId: string;
    readonly receiptId?: string;
    readonly caseId?: string;
    readonly status?: ReceiptStatus;
    readonly similarReports?: number;
    readonly recommendedVersion?: string;
    readonly trackingUrl?: string;
    /** Random per-report bearer secret; it stays in the local receipt store. */
    readonly followToken?: string;
    readonly updatesUrl?: string;
    readonly updatedAt?: number;
}
export interface ShareRequest {
    readonly eventId: string;
}
export interface ReceiptSeen {
    readonly receiptId: string;
    readonly status?: ReceiptStatus;
    readonly updatedAt?: number;
}
/** The local record is already the exact network packet; no projection can add fields. */
export declare function uploadPayload(record: LocalFeedbackRecord): FeedbackEventV3;
