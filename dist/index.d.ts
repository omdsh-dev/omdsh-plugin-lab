/** Task-agnostic plugin health and user-confirmed feedback loop for DeepSeek Harness. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "omdsh-plugin-lab";
export declare const inject: string[];
export interface Config {
    readonly dataDir?: string;
    readonly ingestUrl?: string;
    readonly allowShare?: boolean;
    /** Deprecated deployment alias retained only so existing rc.6 configs keep working. */
    readonly allowAnonymousShare?: boolean;
    readonly authorizationEnv?: string;
    readonly requestTimeoutMs?: number;
    readonly retryIntervalMs?: number;
}
export declare const Config: z<Config>;
export declare function apply(ctx: Context, rawConfig: Config): void;
declare const _default: {
    name: string;
    inject: string[];
    Config: z<Config>;
    apply: typeof apply;
};
export default _default;
export type * from './protocol.js';
