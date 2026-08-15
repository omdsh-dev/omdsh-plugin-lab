import type { RetentionIntent, TrialOutcome, TrialPluginRef } from './protocol.js';
export interface StartInput {
    readonly plugin: TrialPluginRef;
    readonly taskId?: string;
}
export interface FeedbackInput {
    readonly outcome: TrialOutcome;
    readonly retention: RetentionIntent;
    readonly note?: string;
    readonly share: boolean;
    readonly shareNote: boolean;
    readonly dryRun: boolean;
}
export interface ResultInput {
    readonly outcome: TrialOutcome;
    readonly note?: string;
}
export declare const START_USAGE = "Usage: /omdsh-start <module-name>[#version] [task-id]";
export declare const FEEDBACK_USAGE = "Usage: /omdsh-feedback <worked|partial|failed> <keep|unsure|remove> [--share] [--share-note] [--dry-run] [note]";
export declare const RESULT_USAGE = "Usage: /omdsh-result <worked|partial|failed> [note]";
export declare const JOIN_USAGE = "Usage: /omdsh-join <latest|event-id> [--share-note]";
export declare const RETEST_USAGE = "Usage: /omdsh-retest <receipt-id> <module-name>[#version] [task-id]";
export declare function parseStartInput(rawInput: string): StartInput;
export declare function parseFeedbackInput(rawInput: string): FeedbackInput;
export declare function parseResultInput(rawInput: string): ResultInput;
export declare function retentionForOutcome(outcome: TrialOutcome): RetentionIntent;
