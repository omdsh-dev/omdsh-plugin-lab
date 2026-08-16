import type { ExperienceVerdict, FeedbackCategory, FeedbackEvent, HealthStatus, TrialPluginRef } from './protocol.js';
export declare function categoryText(category: FeedbackCategory): string;
export declare function verdictText(verdict: ExperienceVerdict): string;
/** Agent-facing recommendation derived without conversation, logs, or free text. */
export declare function suggestedCategory(health: HealthStatus): FeedbackCategory;
export declare function fixedSummary(plugin: TrialPluginRef, health: HealthStatus, experience: ExperienceVerdict, category: FeedbackCategory): string;
export declare function eventSummary(event: FeedbackEvent): string;
/** The readable preview contains the exact bounded summary that will be uploaded. */
export declare function renderUploadPreview(event: FeedbackEvent): string[];
