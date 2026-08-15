import type { IngestReceipt } from './protocol.js';
import type { ExperienceStore } from './storage.js';
export interface UploaderConfig {
    readonly ingestUrl: string;
    readonly authorizationEnv: string;
    readonly requestTimeoutMs: number;
}
export declare class ExperienceUploader {
    private readonly store;
    private readonly config;
    constructor(store: ExperienceStore, config: UploaderConfig);
    flushPending(targetEventId?: string): Promise<Map<string, IngestReceipt>>;
    refreshReceipts(): Promise<IngestReceipt[]>;
    private send;
}
