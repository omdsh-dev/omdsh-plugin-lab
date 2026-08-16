import type { IngestReceipt, LocalFeedbackRecord } from './protocol.js';
export declare function defaultDataDir(): string;
/** Local outbox for the same closed packet sent over the wire. It stores no logs or identifiers. */
export declare class FeedbackStore {
    readonly dataDir: string;
    readonly eventsPath: string;
    readonly receiptsPath: string;
    readonly shareRequestsPath: string;
    readonly receiptSeenPath: string;
    constructor(dataDir?: string);
    append(record: LocalFeedbackRecord): void;
    appendReceipt(receipt: IngestReceipt): void;
    requestShare(eventId: string): void;
    markSeen(receipt: IngestReceipt): void;
    records(): LocalFeedbackRecord[];
    receipts(): IngestReceipt[];
    record(eventId: string): LocalFeedbackRecord | undefined;
    latestLocalRecord(): LocalFeedbackRecord | undefined;
    latestReceipts(): IngestReceipt[];
    unreadReceipts(): IngestReceipt[];
    /** Local previews that have never been approved for network sharing. */
    drafts(): LocalFeedbackRecord[];
    pending(): LocalFeedbackRecord[];
}
