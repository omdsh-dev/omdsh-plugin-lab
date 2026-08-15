import type { ExperienceEventV1, RetentionIntent, TrialOutcome } from './protocol.js';
export interface Diagnosis {
    readonly headline: string;
    readonly actions: readonly string[];
}
export declare function diagnoseExperience(event: ExperienceEventV1, outcome: TrialOutcome, retention: RetentionIntent): Diagnosis;
