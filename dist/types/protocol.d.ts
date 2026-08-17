/** Bounded, user-previewed summary protocol shared by the DSH plugin and ingest backend. */
export declare const FEEDBACK_SCHEMA_VERSION: 4;
export declare const MAX_FEEDBACK_SUMMARY_LENGTH: 320;
export type HealthStatus = 'ok' | 'unavailable' | 'error' | 'unknown';
export type ExperienceVerdict = 'good' | 'mixed' | 'bad';
export declare const FEEDBACK_CATEGORIES: readonly ["installation", "startup", "invocation", "compatibility", "reliability", "performance", "result_quality", "general"];
export type FeedbackCategory = typeof FEEDBACK_CATEGORIES[number];
export type FeedbackSummarySource = 'template' | 'user_edited';
/** Normalize and reject common pasted-secret, path, log and stack shapes before storage or upload. */
export declare function normalizeFeedbackSummary(value: string): string;
/** Silent panel response; unlike slash commands, this is never appended to the Session. */
export interface PluginLabPanelProbe {
    readonly active: boolean;
    /** Public marketplace coordinate only; never a local path or user label. */
    readonly plugin?: TrialPluginRef;
    readonly health: HealthStatus;
    readonly suggestedCategory: FeedbackCategory;
    readonly draft?: PluginLabPanelDraft;
    readonly text: string;
}
export interface PluginLabPanelDraft {
    readonly eventId: string;
    readonly verdict: ExperienceVerdict;
    readonly category: FeedbackCategory;
    readonly summary: string;
    readonly text: string;
}
/** User-editable feedback content. Plugin identity and Host health stay factual and read-only. */
export interface PluginLabRevision {
    readonly verdict: ExperienceVerdict;
    readonly category: FeedbackCategory;
    readonly summary: string;
}
/** Silent panel action result; it never appends the submitted summary to Session history. */
export interface PluginLabPanelAction {
    readonly ok: boolean;
    readonly text: string;
    readonly eventId?: string;
    readonly summary?: string;
}
export interface TrialPluginRef {
    /** Public DSH marketplace/package identifier; never a local path or user label. */
    readonly moduleName: string;
    readonly version?: string;
}
/** The only value exposed to the Agent-facing analysis tool. */
export interface SafeExperienceAssessment {
    readonly plugin?: TrialPluginRef;
    readonly health: HealthStatus;
    readonly experience: 'unknown';
    readonly feedbackCategories: readonly FeedbackCategory[];
    /** A deterministic suggestion based only on the Host status enum. */
    readonly suggestedCategory: FeedbackCategory;
    readonly analysisScope: 'plugin_identity_and_host_state_only';
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
    readonly schemaVersion: 3;
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
/** v4 adds one user-visible, bounded summary. It is never used for public aggregation. */
export interface FeedbackEventV4 {
    readonly schemaVersion: typeof FEEDBACK_SCHEMA_VERSION;
    readonly type: 'feedback.signal';
    readonly eventId: string;
    readonly plugin: TrialPluginRef;
    readonly health: HealthStatus;
    readonly experience: ExperienceVerdict;
    readonly category: FeedbackCategory;
    readonly summary: string;
    readonly summarySource: FeedbackSummarySource;
    readonly source: 'user_confirmed';
    readonly retestOfReceiptId?: string;
}
export type FeedbackEvent = FeedbackEventV3 | FeedbackEventV4;
export interface LocalFeedbackRecord {
    readonly event: FeedbackEvent;
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
export interface DraftDiscard {
    readonly eventId: string;
}
export type ReceiptLocalState = 'draft' | 'queued' | 'submitted';
/** Safe local projection for the user-owned receipt box. Follow capabilities stay Host-only. */
export interface ReceiptProgressItem {
    readonly eventId: string;
    readonly plugin: TrialPluginRef;
    readonly summary: string;
    readonly localState: ReceiptLocalState;
    readonly status?: ReceiptStatus;
    readonly similarReports?: number;
    readonly recommendedVersion?: string;
    readonly trackingUrl?: string;
    readonly unread: boolean;
}
export interface ReceiptBoxSnapshot {
    readonly items: readonly ReceiptProgressItem[];
    readonly unreadCount: number;
}
/** The local record is already the exact network packet; no projection can add fields. */
export declare function uploadPayload(record: LocalFeedbackRecord): FeedbackEvent;
