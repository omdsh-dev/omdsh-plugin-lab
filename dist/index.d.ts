/** Consent-first plugin trial feedback loop for DeepSeek Harness. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type LoaderHealth, type TrialPluginRef } from './protocol.js';
export declare const name = "omdsh-plugin-lab";
export declare const inject: string[];
export interface Config {
    readonly dataDir?: string;
    readonly ingestUrl?: string;
    readonly allowAnonymousShare?: boolean;
    readonly authorizationEnv?: string;
    readonly profileLabel?: string;
    readonly requestTimeoutMs?: number;
    readonly retryIntervalMs?: number;
}
export declare const Config: z<Config>;
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        'omdsh/trial-started': {
            trialId: string;
            plugin: TrialPluginRef;
            taskId?: string;
            retestOfReceiptId?: string;
            startedAt: number;
            loaderHealth: LoaderHealth;
        };
        'omdsh/feedback-recorded': {
            eventId: string;
            trialId: string;
            outcome: 'worked' | 'partial' | 'failed';
            retention: 'keep' | 'unsure' | 'remove';
            requestedShare: boolean;
            noteShared: boolean;
        };
    }
}
export declare function apply(ctx: Context, rawConfig: Config): void;
declare const _default: {
    name: string;
    inject: string[];
    Config: z<Config>;
    apply: typeof apply;
};
export default _default;
export type * from './protocol.js';
