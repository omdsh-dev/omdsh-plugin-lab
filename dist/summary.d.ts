import type { ExperienceVerdict, FeedbackCategory, FeedbackEventV3, HealthStatus, TrialPluginRef } from './protocol.js';
export declare function categoryText(category: FeedbackCategory): string;
export declare function verdictText(verdict: ExperienceVerdict): string;
export declare function fixedSummary(plugin: TrialPluginRef, health: HealthStatus, experience: ExperienceVerdict, category: FeedbackCategory): string;
/** Every readable preview line is derived from the exact closed upload packet. */
export declare function renderUploadPreview(event: FeedbackEventV3): string[];
