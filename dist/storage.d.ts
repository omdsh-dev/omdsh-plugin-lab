import type { IngestReceipt, LocalCrashRecord, LocalExperienceRecord } from './protocol.js';
export declare function defaultDataDir(): string;
export declare class ExperienceStore {
    readonly dataDir: string;
    readonly eventsPath: string;
    readonly crashesPath: string;
    readonly receiptsPath: string;
    readonly shareRequestsPath: string;
    readonly receiptSeenPath: string;
    private readonly identityPath;
    constructor(dataDir?: string);
    participantId(): string;
    resetParticipantId(): string;
    append(record: LocalExperienceRecord): void;
    /** This deliberately uses synchronous append: the process may exit immediately afterward. */
    appendCrash(record: LocalCrashRecord): void;
    crashRecords(trialId?: string): LocalCrashRecord[];
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
