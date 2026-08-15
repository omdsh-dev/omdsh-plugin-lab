import type { IngestReceipt, LocalExperienceRecord } from './protocol.js';
export declare function defaultDataDir(): string;
export declare class ExperienceStore {
    readonly dataDir: string;
    readonly eventsPath: string;
    readonly receiptsPath: string;
    readonly shareRequestsPath: string;
    readonly receiptSeenPath: string;
    private readonly identityPath;
    constructor(dataDir?: string);
    participantId(): string;
    resetParticipantId(): string;
    append(record: LocalExperienceRecord): void;
    appendReceipt(receipt: IngestReceipt): void;
    requestShare(eventId: string, shareNote?: boolean): void;
    markSeen(receipt: IngestReceipt): void;
    records(): LocalExperienceRecord[];
    receipts(): IngestReceipt[];
    record(eventId: string): LocalExperienceRecord | undefined;
    latestLocalRecord(): LocalExperienceRecord | undefined;
    latestReceipts(): IngestReceipt[];
    unreadReceipts(): IngestReceipt[];
    pending(): LocalExperienceRecord[];
}
