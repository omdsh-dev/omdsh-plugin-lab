import { type ExperienceVerdict, type FeedbackCategory, type TrialPluginRef } from './protocol.js';
export interface StartInput {
    readonly plugin: TrialPluginRef;
}
export declare const START_USAGE = "Usage: /omdsh-start <public-module-name>[#version]";
export declare const RESULT_USAGE: string;
export declare const JOIN_USAGE = "Usage: /omdsh-join <latest|event-id>";
export declare const RETEST_USAGE = "Usage: /omdsh-retest <receipt-id> <public-module-name>[#version]";
export declare function parseStartInput(rawInput: string): StartInput;
export declare function parseResultInput(rawInput: string): {
    readonly verdict: ExperienceVerdict;
    readonly category: FeedbackCategory;
};
export declare function parseJoinTarget(rawInput: string): string;
export declare function parseReceiptId(value: string): string;
